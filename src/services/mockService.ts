import {
  Conversation,
  CuratedMatch,
  DailyMatchBatch,
  MatchFeedbackDecision,
  Message,
  PreferenceChatMessage,
  PreferenceProfile,
  Profile,
  User,
} from '@/types';
import { buildAiReason } from './matching/matchingScoring';

const MOCK_AUTH_KEY = 'flove-auth-mode';
const USER_KEY = 'flove-user';
const MOCK_AUTH_VALUE = 'mock';
const MOCK_USER_ID = 'mock-user';

export const MOCK_USER: User = {
  id: MOCK_USER_ID,
  email: 'demo@fpt.edu.vn',
  name: 'Demo FPT',
  age: 21,
  major: 'SE',
  campus: 'HCM',
  avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=face',
  bio: 'I like thoughtful conversations, coffee, product ideas, and calm weekend plans.',
  interests: ['Coding', 'Coffee', 'Music', 'Startups'],
};

const MOCK_PROFILES: Profile[] = [
  {
    id: 'mock-linh',
    email: 'linh.tran@fpt.edu.vn',
    name: 'Linh Tran',
    age: 20,
    major: 'AI',
    campus: 'HCM',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=face',
    bio: 'AI enthusiast who enjoys quiet coffee shops and building useful side projects.',
    interests: ['AI/ML', 'Coffee', 'Reading', 'Startups'],
  },
  {
    id: 'mock-mai',
    email: 'mai.pham@fpt.edu.vn',
    name: 'Mai Pham',
    age: 21,
    major: 'Design',
    campus: 'HCM',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=face',
    bio: 'Design student, museum wanderer, and playlist maker.',
    interests: ['Design', 'Music', 'Art', 'Travel'],
  },
  {
    id: 'mock-huy',
    email: 'huy.le@fpt.edu.vn',
    name: 'Huy Le',
    age: 22,
    major: 'Biz',
    campus: 'HCM',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face',
    bio: 'Future founder, basketball fan, and late-night ramen expert.',
    interests: ['Startups', 'Finance', 'Basketball', 'Coffee'],
  },
  {
    id: 'mock-thao',
    email: 'thao.vo@fpt.edu.vn',
    name: 'Thao Vo',
    age: 20,
    major: 'Marketing',
    campus: 'Danang',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=400&fit=crop&crop=face',
    bio: 'Content creator who likes dance practice, photoshoots, and beach walks.',
    interests: ['Marketing', 'Photography', 'Dance', 'Travel'],
  },
  {
    id: 'mock-duc',
    email: 'duc.nguyen@fpt.edu.vn',
    name: 'Duc Nguyen',
    age: 23,
    major: 'SE',
    campus: 'Danang',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=face',
    bio: 'Full-stack developer, open-source contributor, and acoustic guitar learner.',
    interests: ['Coding', 'Music', 'Gaming', 'Coffee'],
  },
];

function storageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readJson<T>(key: string, fallback: T): T {
  if (!storageAvailable()) return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!storageAvailable()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function todayKey(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function batchStorageKey(date = todayKey()): string {
  return `flove-mock-ai-picks-${date}`;
}

function preferenceStorageKey(): string {
  return 'flove-mock-preferences';
}

function preferenceChatStorageKey(): string {
  return 'flove-mock-preference-chat';
}

function conversationsStorageKey(): string {
  return 'flove-mock-conversations';
}

function messagesStorageKey(conversationId: string): string {
  return `flove-mock-messages-${conversationId}`;
}

function pairKeyFor(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

function createMatch(profile: Profile, index: number, date: string, self = getMockUser()): CuratedMatch {
  const score = [92, 84, 78, 71, 68][index] ?? 66;
  const batchId = `${self.id}_${date}`;

  return {
    id: `mock-${date}-${profile.id}`,
    batchId,
    userId: self.id,
    candidateId: profile.id,
    candidate: profile,
    pairKey: pairKeyFor(self.id, profile.id),
    aiReason: buildAiReason(self, profile, score),
    compatibilityLabel: score >= 86 ? 'High intent fit' : score >= 76 ? 'Strong potential' : 'Worth exploring',
    compatibilityScore: score,
    status: 'pending',
    feedbackTags: [],
    createdAt: new Date(),
  };
}

function getStoredBatch(date = todayKey()): DailyMatchBatch {
  const self = getMockUser();
  const stored = readJson<DailyMatchBatch | null>(batchStorageKey(date), null);
  if (stored) {
    const batchId = `${self.id}_${date}`;
    const hydrated = {
      ...stored,
      id: batchId,
      userId: self.id,
      createdAt: new Date(stored.createdAt),
      matches: stored.matches.map(match => ({
        ...match,
        batchId,
        userId: self.id,
        pairKey: pairKeyFor(self.id, match.candidateId),
        aiReason: buildAiReason(self, match.candidate, match.compatibilityScore),
        createdAt: new Date(match.createdAt),
        decidedAt: match.decidedAt ? new Date(match.decidedAt) : undefined,
      })),
    };
    writeJson(batchStorageKey(date), hydrated);
    return hydrated;
  }

  const batch: DailyMatchBatch = {
    id: `${self.id}_${date}`,
    userId: self.id,
    date,
    matches: MOCK_PROFILES.map((profile, index) => createMatch(profile, index, date, self)),
    createdAt: new Date(),
  };
  writeJson(batchStorageKey(date), batch);
  return batch;
}

function saveBatch(batch: DailyMatchBatch): void {
  writeJson(batchStorageKey(batch.date), batch);
}

function upsertMockConversation(match: CuratedMatch): string {
  const conversationId = `mock-conversation-${match.pairKey}`;
  const conversations = readJson<Conversation[]>(conversationsStorageKey(), []);
  const existing = conversations.find(conversation => conversation.id === conversationId);

  if (!existing) {
    conversations.unshift({
      id: conversationId,
      participant: match.candidate,
      lastMessage: {
        id: `mock-message-${Date.now()}`,
        senderId: match.candidateId,
        content: `Hey ${MOCK_USER.name}, glad we both accepted this AI pick.`,
        timestamp: new Date(),
        isRead: false,
      },
      isAnonymous: false,
      unreadCount: 1,
      updatedAt: new Date(),
    });
    writeJson(conversationsStorageKey(), conversations);
  }

  const messages = readJson<Message[]>(messagesStorageKey(conversationId), []);
  if (messages.length === 0) {
    writeJson(messagesStorageKey(conversationId), [
      {
        id: `mock-message-${Date.now()}`,
        senderId: match.candidateId,
        content: `Hey ${MOCK_USER.name}, glad we both accepted this AI pick.`,
        timestamp: new Date(),
        isRead: false,
      },
    ]);
  }

  return conversationId;
}

function mockPartnerAccepted(match: CuratedMatch): boolean {
  return match.compatibilityScore >= 86;
}

export function isMockMode(): boolean {
  return import.meta.env.VITE_USE_MOCKS === 'true';
}

export function enableMockMode(): User {
  const user = getMockUser();
  if (storageAvailable()) {
    window.localStorage.setItem(MOCK_AUTH_KEY, MOCK_AUTH_VALUE);
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  return user;
}

export function disableMockMode(): void {
  if (!storageAvailable()) return;
  window.localStorage.removeItem(MOCK_AUTH_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function getMockUser(): User {
  return readJson<User>(USER_KEY, MOCK_USER);
}

export function saveMockUser(user: User): void {
  writeJson(USER_KEY, user);
}

export const mockService = {
  getTodayMatches(): DailyMatchBatch {
    return getStoredBatch();
  },

  submitFeedback(
    matchId: string,
    decision: MatchFeedbackDecision,
    tags: string[],
    note?: string
  ): CuratedMatch {
    const batch = getStoredBatch();
    const matches = batch.matches.map(match => {
      if (match.id !== matchId) return match;
      return {
        ...match,
        status: decision === 'accepted' ? 'accepted' : decision,
        feedbackTags: tags,
        feedbackNote: note,
        decidedAt: new Date(),
      };
    });
    const nextBatch = { ...batch, matches };
    saveBatch(nextBatch);
    return matches.find(match => match.id === matchId) ?? batch.matches[0];
  },

  acceptMatch(matchId: string, tags: string[], note?: string): { isMutual: boolean; conversationId?: string; match: CuratedMatch } {
    const accepted = this.submitFeedback(matchId, 'accepted', tags, note);
    if (!mockPartnerAccepted(accepted)) {
      return { isMutual: false, match: accepted };
    }

    const batch = getStoredBatch();
    const matches = batch.matches.map(match =>
      match.id === matchId ? { ...match, status: 'matched' as const, decidedAt: new Date() } : match
    );
    const matched = matches.find(match => match.id === matchId) ?? accepted;
    saveBatch({ ...batch, matches });
    const conversationId = upsertMockConversation(matched);
    return { isMutual: true, conversationId, match: matched };
  },

  getPreferenceProfile(): PreferenceProfile {
    const user = getMockUser();
    return readJson<PreferenceProfile>(preferenceStorageKey(), {
      id: user.id,
      userId: user.id,
      summary: user.bio,
      hardFilters: ['FPT student'],
      softPreferences: user.interests,
      feedbackSummary: [],
      updatedAt: new Date(),
    });
  },

  subscribePreferenceMessages(callback: (messages: PreferenceChatMessage[]) => void): () => void {
    callback(readJson<PreferenceChatMessage[]>(preferenceChatStorageKey(), []));
    return () => {};
  },

  sendPreferenceMessage(content: string): void {
    const messages = readJson<PreferenceChatMessage[]>(preferenceChatStorageKey(), []);
    const hints = content
      .split(/[,.!?;\n]/)
      .map(part => part.trim())
      .filter(Boolean)
      .slice(0, 4);
    const nextMessages: PreferenceChatMessage[] = [
      ...messages,
      { id: `mock-user-${Date.now()}`, sender: 'user', content, createdAt: new Date() },
      {
        id: `mock-ai-${Date.now()}`,
        sender: 'assistant',
        content: hints.length > 0
          ? `Saved. Future picks will account for: ${hints.join('; ')}.`
          : 'Saved. Tell me more when you want to tune future AI Picks.',
        createdAt: new Date(),
      },
    ];
    writeJson(preferenceChatStorageKey(), nextMessages);
    writeJson(preferenceStorageKey(), {
      ...this.getPreferenceProfile(),
      summary: content,
      softPreferences: hints.length > 0 ? hints : this.getPreferenceProfile().softPreferences,
      updatedAt: new Date(),
    });
  },

  subscribeConversations(callback: (conversations: Conversation[]) => void): () => void {
    const conversations = readJson<Conversation[]>(conversationsStorageKey(), []).map(conversation => ({
      ...conversation,
      updatedAt: new Date(conversation.updatedAt),
      lastMessage: conversation.lastMessage
        ? { ...conversation.lastMessage, timestamp: new Date(conversation.lastMessage.timestamp) }
        : null,
    }));
    callback(conversations);
    return () => {};
  },

  getConversations(): Conversation[] {
    const conversations = readJson<Conversation[]>(conversationsStorageKey(), []);
    return conversations.map(conversation => ({
      ...conversation,
      updatedAt: new Date(conversation.updatedAt),
      lastMessage: conversation.lastMessage
        ? { ...conversation.lastMessage, timestamp: new Date(conversation.lastMessage.timestamp) }
        : null,
    }));
  },

  subscribeMessages(conversationId: string, callback: (messages: Message[]) => void): () => void {
    callback(this.getMessages(conversationId));
    return () => {};
  },

  getMessages(conversationId: string): Message[] {
    return readJson<Message[]>(messagesStorageKey(conversationId), []).map(message => ({
      ...message,
      timestamp: new Date(message.timestamp),
    }));
  },

  sendMessage(conversationId: string, content: string): Message {
    const message: Message = {
      id: `mock-message-${Date.now()}`,
      senderId: MOCK_USER_ID,
      content,
      timestamp: new Date(),
      isRead: false,
    };
    const messages = [...this.getMessages(conversationId), message];
    writeJson(messagesStorageKey(conversationId), messages);

    const conversations = this.getConversations().map(conversation =>
      conversation.id === conversationId
        ? { ...conversation, lastMessage: message, updatedAt: new Date(), unreadCount: 0 }
        : conversation
    );
    writeJson(conversationsStorageKey(), conversations);
    return message;
  },

  markAsRead(conversationId: string): void {
    const conversations = this.getConversations().map(conversation =>
      conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
    );
    writeJson(conversationsStorageKey(), conversations);
  },
};
