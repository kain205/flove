import { Conversation, Message, User, BlindDateSession } from '@/types';

// Mock anonymous partners
const anonymousPartners: User[] = [
  {
    id: 'anon-1',
    email: 'anonymous@fpt.edu.vn',
    name: 'Mystery Person',
    age: 0,
    major: 'SE',
    campus: 'HCM',
    avatar: '',
    bio: '',
    interests: [],
  },
];

// Mock conversations
const mockConversations: Conversation[] = [
  {
    id: 'conv-1',
    participant: {
      id: '2',
      email: 'linh.tran@fpt.edu.vn',
      name: 'Linh Tran',
      age: 20,
      major: 'AI',
      campus: 'HCM',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=face',
      bio: 'AI enthusiast',
      interests: ['AI/ML'],
    },
    lastMessage: {
      id: 'msg-1',
      senderId: '2',
      content: 'Hey! Nice to meet you 😊',
      timestamp: new Date(Date.now() - 3600000),
      isRead: true,
    },
    isAnonymous: false,
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 3600000),
  },
  {
    id: 'conv-2',
    participant: {
      id: 'anon-2',
      email: '',
      name: 'Anonymous Fox 🦊',
      age: 0,
      major: 'SE',
      campus: 'HCM',
      avatar: '',
      bio: '',
      interests: [],
    },
    lastMessage: {
      id: 'msg-2',
      senderId: 'anon-2',
      content: 'This blind date thing is fun!',
      timestamp: new Date(Date.now() - 7200000),
      isRead: false,
    },
    isAnonymous: true,
    unreadCount: 2,
    updatedAt: new Date(Date.now() - 7200000),
  },
];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let blindDateSession: BlindDateSession | null = null;

// Animal emojis for anonymous names
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

export const chatService = {
  async getConversations(): Promise<Conversation[]> {
    await delay(500);
    return [...mockConversations];
  },

  async getMessages(conversationId: string): Promise<Message[]> {
    await delay(300);
    // Return mock messages
    return [
      {
        id: 'msg-1',
        senderId: 'other',
        content: 'Hey there! 👋',
        timestamp: new Date(Date.now() - 3600000),
        isRead: true,
      },
      {
        id: 'msg-2',
        senderId: 'me',
        content: 'Hi! Nice to meet you!',
        timestamp: new Date(Date.now() - 3500000),
        isRead: true,
      },
      {
        id: 'msg-3',
        senderId: 'other',
        content: 'What major are you studying?',
        timestamp: new Date(Date.now() - 3400000),
        isRead: true,
      },
    ];
  },

  async sendMessage(conversationId: string, content: string): Promise<Message> {
    await delay(200);
    return {
      id: `msg-${Date.now()}`,
      senderId: 'me',
      content,
      timestamp: new Date(),
      isRead: false,
    };
  },

  // Blind Date Functions
  async findBlindDatePartner(): Promise<BlindDateSession> {
    await delay(2000); // 2 second wait as specified
    
    const randomName = anonymousNames[Math.floor(Math.random() * anonymousNames.length)];
    
    blindDateSession = {
      id: `blind-${Date.now()}`,
      partnerId: `anon-${Date.now()}`,
      partnerMaskedName: randomName,
      isRevealed: false,
      revealRequested: false,
      createdAt: new Date(),
    };

    return blindDateSession;
  },

  async requestReveal(): Promise<{ accepted: boolean }> {
    await delay(1000);
    // Random 50% chance of acceptance
    const accepted = Math.random() < 0.5;
    
    if (blindDateSession && accepted) {
      blindDateSession.isRevealed = true;
    }
    
    return { accepted };
  },

  getBlindDateSession(): BlindDateSession | null {
    return blindDateSession;
  },

  clearBlindDateSession(): void {
    blindDateSession = null;
  },
};
