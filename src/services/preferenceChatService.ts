import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { aiBackendService } from './aiBackendService';
import { isMockMode, mockService } from './mockService';
import { PreferenceChatMessage } from '@/types';

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
}

function toDate(value: unknown): Date {
  return (value as { toDate?: () => Date })?.toDate?.() ?? new Date();
}

function extractPreferenceHints(content: string): string[] {
  return content
    .split(/[,.!?;\n]/)
    .map(part => part.trim())
    .filter(part => part.length >= 4)
    .slice(0, 4);
}

function assistantReply(content: string): string {
  const hints = extractPreferenceHints(content);

  if (hints.length === 0) {
    return 'Got it. Tell me a little more about the kind of person, pace, or deal-breakers you want me to consider for future picks.';
  }

  return `I updated your preference profile with: ${hints.join('; ')}. I will use this to improve tomorrow's curated matches.`;
}

export const preferenceChatService = {
  subscribeMessages(callback: (messages: PreferenceChatMessage[]) => void): Unsubscribe {
    if (isMockMode()) {
      return mockService.subscribePreferenceMessages(callback);
    }

    let uid: string;
    try {
      uid = currentUid();
    } catch (error) {
      console.error('Preference chat falling back to local messages', error);
      return mockService.subscribePreferenceMessages(callback);
    }

    const q = query(
      collection(db, 'preferenceChats', uid, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    return onSnapshot(
      q,
      snap => {
        callback(
          snap.docs.map(messageDoc => {
            const data = messageDoc.data();
            return {
              id: messageDoc.id,
              sender: data.sender ?? 'assistant',
              content: data.content ?? '',
              createdAt: toDate(data.createdAt),
            };
          })
        );
      },
      error => {
        console.error('Preference chat falling back to local messages', error);
        mockService.subscribePreferenceMessages(callback);
      }
    );
  },

  async sendMessage(content: string): Promise<void> {
    if (isMockMode()) {
      mockService.sendPreferenceMessage(content);
      return;
    }

    const trimmed = content.trim();
    if (!trimmed) return;

    let uid: string;
    try {
      uid = currentUid();
    } catch (error) {
      console.error('Preference chat send falling back to local messages', error);
      mockService.sendPreferenceMessage(trimmed);
      return;
    }

    try {
      await addDoc(collection(db, 'preferenceChats', uid, 'messages'), {
        sender: 'user',
        content: trimmed,
        createdAt: serverTimestamp(),
      });

      if (aiBackendService.isEnabled()) {
        await aiBackendService.sendPreferenceChatMessage(trimmed);
        return;
      }

      const hints = extractPreferenceHints(trimmed);
      const preferenceUpdate: Record<string, unknown> = {
        userId: uid,
        summary: trimmed,
        feedbackSummary: arrayUnion(`preference chat: ${hints.join(', ') || trimmed}`),
        updatedAt: serverTimestamp(),
      };

      if (hints.length > 0) {
        preferenceUpdate.softPreferences = arrayUnion(...hints);
      }

      await setDoc(doc(db, 'preferenceProfiles', uid), preferenceUpdate, { merge: true });

      await addDoc(collection(db, 'preferenceChats', uid, 'messages'), {
        sender: 'assistant',
        content: assistantReply(trimmed),
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Preference chat send falling back to local messages', error);
      mockService.sendPreferenceMessage(trimmed);
    }
  },
};
