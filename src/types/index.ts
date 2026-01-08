// User & Profile Types
export interface User {
  id: string;
  email: string;
  name: string;
  age: number;
  major: 'SE' | 'AI' | 'Biz' | 'Design' | 'Marketing';
  campus: 'HCM' | 'Hanoi' | 'Danang' | 'Cantho';
  avatar: string;
  bio: string;
  interests: string[];
}

export interface Profile extends User {
  distance?: string;
  isOnline?: boolean;
}

// Auth Types
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// Match Types
export interface Match {
  id: string;
  matchedUser: User;
  matchedAt: Date;
  isRevealed: boolean;
}

// Chat Types
export interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: Date;
  isRead: boolean;
}

export interface Conversation {
  id: string;
  participant: User;
  lastMessage: Message | null;
  isAnonymous: boolean;
  unreadCount: number;
  updatedAt: Date;
}

// Blind Date Types
export interface BlindDateSession {
  id: string;
  partnerId: string;
  partnerMaskedName: string;
  isRevealed: boolean;
  revealRequested: boolean;
  createdAt: Date;
}
