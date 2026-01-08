import { Profile, Match } from '@/types';

// Mock profiles data
const mockProfiles: Profile[] = [
  {
    id: '2',
    email: 'linh.tran@fpt.edu.vn',
    name: 'Linh Tran',
    age: 20,
    major: 'AI',
    campus: 'HCM',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=face',
    bio: 'AI enthusiast 🤖 Love exploring new technologies and building cool stuff!',
    interests: ['AI/ML', 'Reading', 'Yoga'],
    distance: '2 km',
    isOnline: true,
  },
  {
    id: '3',
    email: 'huy.le@fpt.edu.vn',
    name: 'Huy Le',
    age: 22,
    major: 'Biz',
    campus: 'HCM',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face',
    bio: 'Future entrepreneur 💼 Building the next big thing!',
    interests: ['Startups', 'Finance', 'Basketball'],
    distance: '5 km',
    isOnline: false,
  },
  {
    id: '4',
    email: 'mai.pham@fpt.edu.vn',
    name: 'Mai Pham',
    age: 21,
    major: 'Design',
    campus: 'Hanoi',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=face',
    bio: 'Creative soul 🎨 UI/UX designer who loves minimalism',
    interests: ['Design', 'Art', 'Travel'],
    distance: '3 km',
    isOnline: true,
  },
  {
    id: '5',
    email: 'duc.nguyen@fpt.edu.vn',
    name: 'Duc Nguyen',
    age: 23,
    major: 'SE',
    campus: 'Danang',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=face',
    bio: 'Full-stack developer 💻 Open source contributor',
    interests: ['Coding', 'Music', 'Coffee'],
    distance: '1 km',
    isOnline: true,
  },
  {
    id: '6',
    email: 'thao.vo@fpt.edu.vn',
    name: 'Thao Vo',
    age: 20,
    major: 'Marketing',
    campus: 'HCM',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=face',
    bio: 'Digital marketer 📱 Content creator & social media enthusiast',
    interests: ['Marketing', 'Photography', 'Dance'],
    distance: '4 km',
    isOnline: false,
  },
];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let currentProfileIndex = 0;
const matches: Match[] = [];

export const matchService = {
  async getProfiles(): Promise<Profile[]> {
    await delay(500);
    return [...mockProfiles];
  },

  async getNextProfile(): Promise<Profile | null> {
    await delay(300);
    if (currentProfileIndex >= mockProfiles.length) {
      currentProfileIndex = 0; // Reset for demo
    }
    return mockProfiles[currentProfileIndex++] || null;
  },

  async swipeRight(profileId: string): Promise<{ isMatch: boolean; match?: Match }> {
    await delay(500);
    
    // Random 40% chance of match for demo
    const isMatch = Math.random() < 0.4;
    
    if (isMatch) {
      const matchedProfile = mockProfiles.find(p => p.id === profileId);
      if (matchedProfile) {
        const match: Match = {
          id: `match-${Date.now()}`,
          matchedUser: matchedProfile,
          matchedAt: new Date(),
          isRevealed: true,
        };
        matches.push(match);
        return { isMatch: true, match };
      }
    }
    
    return { isMatch: false };
  },

  async swipeLeft(profileId: string): Promise<void> {
    await delay(200);
    // Just pass, no action needed
  },

  async getMatches(): Promise<Match[]> {
    await delay(500);
    return [...matches];
  },

  resetProfiles(): void {
    currentProfileIndex = 0;
  },
};
