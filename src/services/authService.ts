import { User, LoginCredentials } from '@/types';

// Mock user data
const mockUser: User = {
  id: '1',
  email: 'student@fpt.edu.vn',
  name: 'Minh Nguyen',
  age: 21,
  major: 'SE',
  campus: 'HCM',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
  bio: 'Software Engineering student who loves coding and coffee ☕',
  interests: ['Coding', 'Gaming', 'Photography'],
};

// Simulated delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const authService = {
  async login(credentials: LoginCredentials): Promise<User> {
    await delay(1000); // Simulate network delay
    
    // For MVP: Accept any valid email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(credentials.email)) {
      throw new Error('Invalid email format');
    }
    
    if (!credentials.password || credentials.password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    
    // Return mock user with the provided email
    return {
      ...mockUser,
      email: credentials.email,
      name: credentials.email.split('@')[0].replace(/[._]/g, ' '),
    };
  },

  async logout(): Promise<void> {
    await delay(500);
    // Clear any stored data
  },

  async getCurrentUser(): Promise<User | null> {
    await delay(500);
    const stored = localStorage.getItem('f-connect-user');
    return stored ? JSON.parse(stored) : null;
  },

  saveUser(user: User): void {
    localStorage.setItem('f-connect-user', JSON.stringify(user));
  },

  clearUser(): void {
    localStorage.removeItem('f-connect-user');
  },
};
