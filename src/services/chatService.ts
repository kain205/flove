import {
  collection,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Conversation, Message, BlindDateSession } from '@/types';
import { isMockMode, mockService } from './mockService';

const anonymousNames = [
  'Anonymous Fox 🦊',
  'Anonymous Panda 🐼',
  'Anonymous Cat 🐱',
  'Anonymous Dog 🐕',
  'Anonymous Rabbit 🐰',
  'Anonymous Bear 🐻',
  'Anonymous Tiger 🐯',
  'Anonymous Lion 🦁',
];

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
}

async function convDocToConversation(
  convId: string,
  data: Record<string, unknown>
): Promise<Conversation> {
  const uid = currentUid();
  const otherUid = (data.users as string[])?.find(u => u !== uid) ?? '';
  const isAnonymous = (data.isAnonymous as boolean) ?? false;

  let participant = {
    id: otherUid,
    email: '',
    name: isAnonymous ? (data.partnerMaskedName as string) ?? 'Anonymous' : 'User',
    age: 0,
    major: 'SE' as const,
    campus: 'HCM' as const,
    avatar: '',
    bio: '',
    interests: [] as string[],
  };

  if (!isAnonymous && otherUid) {
    const userSnap = await getDoc(doc(db, 'users', otherUid));
    if (userSnap.exists()) {
      const d = userSnap.data();
      participant = {
        id: otherUid,
        email: d.email ?? '',
        name: d.name ?? '',
        age: d.age ?? 0,
        major: d.major ?? 'SE',
        campus: d.campus ?? 'HCM',
        avatar: d.avatar ?? '',
        bio: d.bio ?? '',
        interests: d.interests ?? [],
      };
    }
  }

  const lastMsgData = data.lastMessage as Record<string, unknown> | null;
  const lastMessage: Message | null = lastMsgData
    ? {
        id: lastMsgData.id as string ?? '',
        senderId: lastMsgData.senderId as string ?? '',
        content: lastMsgData.content as string ?? '',
        timestamp: (lastMsgData.timestamp as { toDate?: () => Date })?.toDate?.() ?? new Date(),
        isRead: lastMsgData.isRead as boolean ?? false,
      }
    : null;

  const unreadCounts = (data.unreadCounts as Record<string, number>) ?? {};

  return {
    id: convId,
    participant,
    lastMessage,
    isAnonymous,
    unreadCount: unreadCounts[uid] ?? 0,
    updatedAt: (data.updatedAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
  };
}

export const chatService = {
  subscribeConversations(
    callback: (conversations: Conversation[]) => void
  ): Unsubscribe {
    if (isMockMode()) {
      return mockService.subscribeConversations(callback);
    }

    const uid = currentUid();
    const q = query(
      collection(db, 'conversations'),
      where('users', 'array-contains', uid),
      orderBy('updatedAt', 'desc'),
      limit(50)
    );

    return onSnapshot(q, async (snap) => {
      const convs = await Promise.all(
        snap.docs.map(d => convDocToConversation(d.id, d.data() as Record<string, unknown>))
      );
      callback(convs);
    });
  },

  // Backward compat promise version
  async getConversations(): Promise<Conversation[]> {
    if (isMockMode()) {
      return mockService.getConversations();
    }

    const uid = currentUid();
    const snap = await getDocs(
      query(
        collection(db, 'conversations'),
        where('users', 'array-contains', uid),
        orderBy('updatedAt', 'desc'),
        limit(50)
      )
    );
    return Promise.all(
      snap.docs.map(d => convDocToConversation(d.id, d.data() as Record<string, unknown>))
    );
  },

  subscribeMessages(
    conversationId: string,
    callback: (messages: Message[]) => void
  ): Unsubscribe {
    if (isMockMode()) {
      return mockService.subscribeMessages(conversationId, callback);
    }

    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    return onSnapshot(q, (snap) => {
      const messages: Message[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          senderId: data.senderId ?? '',
          content: data.content ?? '',
          timestamp: data.timestamp?.toDate?.() ?? new Date(),
          isRead: data.isRead ?? false,
        };
      });
      callback(messages);
    });
  },

  async getMessages(conversationId: string): Promise<Message[]> {
    if (isMockMode()) {
      return mockService.getMessages(conversationId);
    }

    const snap = await getDocs(
      query(
        collection(db, 'conversations', conversationId, 'messages'),
        orderBy('timestamp', 'asc'),
        limit(100)
      )
    );
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        senderId: data.senderId ?? '',
        content: data.content ?? '',
        timestamp: data.timestamp?.toDate?.() ?? new Date(),
        isRead: data.isRead ?? false,
      };
    });
  },

  async sendMessage(conversationId: string, content: string): Promise<Message> {
    if (isMockMode()) {
      return mockService.sendMessage(conversationId, content);
    }

    const uid = currentUid();
    const msgRef = await addDoc(
      collection(db, 'conversations', conversationId, 'messages'),
      {
        senderId: uid,
        content,
        timestamp: serverTimestamp(),
        isRead: false,
      }
    );

    const lastMessage = {
      id: msgRef.id,
      senderId: uid,
      content,
      timestamp: serverTimestamp(),
      isRead: false,
    };

    // Get conversation to find other user for unread count
    const convSnap = await getDoc(doc(db, 'conversations', conversationId));
    const convData = convSnap.data();
    const otherUid = (convData?.users as string[])?.find(u => u !== uid) ?? '';

    await updateDoc(doc(db, 'conversations', conversationId), {
      lastMessage,
      updatedAt: serverTimestamp(),
      [`unreadCounts.${otherUid}`]: ((convData?.unreadCounts as Record<string, number>)?.[otherUid] ?? 0) + 1,
    });

    return {
      id: msgRef.id,
      senderId: uid,
      content,
      timestamp: new Date(),
      isRead: false,
    };
  },

  async markAsRead(conversationId: string): Promise<void> {
    if (isMockMode()) {
      mockService.markAsRead(conversationId);
      return;
    }

    const uid = currentUid();
    await updateDoc(doc(db, 'conversations', conversationId), {
      [`unreadCounts.${uid}`]: 0,
    });
  },

  // Blind Date Functions
  async findBlindDatePartner(): Promise<BlindDateSession> {
    if (isMockMode()) {
      return {
        id: `mock-blind-${Date.now()}`,
        partnerId: 'mock-anonymous',
        partnerMaskedName: 'Anonymous FPT Student',
        isRevealed: false,
        revealRequested: false,
        createdAt: new Date(),
      };
    }

    const uid = currentUid();
    const randomName = anonymousNames[Math.floor(Math.random() * anonymousNames.length)];
    const sessionId = `blind-${uid}-${Date.now()}`;

    // Check for waiting user in queue
    const queueSnap = await getDocs(
      query(
        collection(db, 'blindDateQueue'),
        where('status', '==', 'waiting'),
        limit(1)
      )
    );

    let partnerId: string;
    let convId: string;

    if (!queueSnap.empty && queueSnap.docs[0].id !== uid) {
      // Found a partner — match them
      const partnerDoc = queueSnap.docs[0];
      partnerId = partnerDoc.id;
      await updateDoc(doc(db, 'blindDateQueue', partnerId), { status: 'matched' });

      const convRef = await addDoc(collection(db, 'conversations'), {
        users: [uid, partnerId],
        isAnonymous: true,
        partnerMaskedName: randomName,
        lastMessage: null,
        updatedAt: serverTimestamp(),
        unreadCounts: { [uid]: 0, [partnerId]: 0 },
      });
      convId = convRef.id;
    } else {
      // Add self to queue
      await setDoc(doc(db, 'blindDateQueue', uid), {
        uid,
        maskedName: randomName,
        status: 'waiting',
        queuedAt: serverTimestamp(),
      });
      partnerId = `anon-${Date.now()}`;
      convId = sessionId;
    }

    const session: BlindDateSession = {
      id: convId,
      partnerId,
      partnerMaskedName: randomName,
      isRevealed: false,
      revealRequested: false,
      createdAt: new Date(),
    };

    await setDoc(doc(db, 'blindDateSessions', convId), {
      ...session,
      createdAt: serverTimestamp(),
    });

    return session;
  },

  async requestReveal(sessionId: string): Promise<{ accepted: boolean }> {
    if (isMockMode()) {
      return { accepted: sessionId.startsWith('mock-blind') };
    }

    const uid = currentUid();
    const sessionRef = doc(db, 'blindDateSessions', sessionId);
    const snap = await getDoc(sessionRef);

    if (!snap.exists()) return { accepted: false };
    const data = snap.data();

    // Mark this user as requesting reveal
    await updateDoc(sessionRef, {
      [`revealRequests.${uid}`]: true,
    });

    // Check if both sides requested
    const revealRequests = { ...(data.revealRequests ?? {}), [uid]: true };
    const users: string[] = data.users ?? [];
    const bothRevealed = users.length >= 2 && users.every(u => revealRequests[u]);

    if (bothRevealed) {
      await updateDoc(sessionRef, { isRevealed: true });
      return { accepted: true };
    }

    return { accepted: false };
  },

  getBlindDateSession(): BlindDateSession | null {
    return null;
  },

  clearBlindDateSession(): void {
    // no-op
  },
};
