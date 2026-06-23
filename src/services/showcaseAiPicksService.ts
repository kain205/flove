import { buildAiReason, compatibilityLabel } from './matching/matchingScoring';
import type { MatchingGateway } from './matching/types';
import type {
  CuratedMatch,
  DailyMatchBatch,
  MatchFeedbackDecision,
  PreferenceProfile,
  Profile,
  User,
} from '@/types';

const SHOWCASE_PROFILES: Array<Profile & { showcaseScore: number }> = [
  {
    id: 'showcase-linh',
    email: 'linh.tran@fpt.edu.vn',
    name: 'Linh Tran',
    age: 20,
    major: 'AI',
    campus: 'HCM',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&h=800&fit=crop&crop=face',
    bio: 'Thích AI, quán cà phê yên tĩnh và các side project có ích.',
    interests: ['AI/ML', 'Coffee', 'Reading', 'Startups'],
    personalityTags: ['Curious', 'Calm'],
    datingGoals: ['Coffee dates', 'Slow burn'],
    preferredVibes: ['Deep talks'],
    showcaseScore: 92,
  },
  {
    id: 'showcase-mai',
    email: 'mai.pham@fpt.edu.vn',
    name: 'Mai Pham',
    age: 21,
    major: 'Design',
    campus: 'HCM',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=800&fit=crop&crop=face',
    bio: 'Design student, hay đi museum, thích playlist và những buổi nói chuyện nhẹ nhàng.',
    interests: ['Design', 'Music', 'Art', 'Travel'],
    personalityTags: ['Creative', 'Warm'],
    datingGoals: ['Start as friends'],
    preferredVibes: ['Creative energy'],
    showcaseScore: 86,
  },
  {
    id: 'showcase-huy',
    email: 'huy.le@fpt.edu.vn',
    name: 'Huy Le',
    age: 22,
    major: 'Biz',
    campus: 'HCM',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&h=800&fit=crop&crop=face',
    bio: 'Quan tâm startup, bóng rổ và những cuộc trò chuyện về kế hoạch tương lai.',
    interests: ['Startups', 'Finance', 'Basketball', 'Coffee'],
    personalityTags: ['Ambitious', 'Direct'],
    datingGoals: ['Intentional dating'],
    preferredVibes: ['High energy'],
    showcaseScore: 79,
  },
  {
    id: 'showcase-thao',
    email: 'thao.vo@fpt.edu.vn',
    name: 'Thao Vo',
    age: 20,
    major: 'Marketing',
    campus: 'Danang',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&h=800&fit=crop&crop=face',
    bio: 'Làm content, thích chụp ảnh, dance practice và đi dạo cuối tuần.',
    interests: ['Marketing', 'Photography', 'Dance', 'Travel'],
    personalityTags: ['Expressive', 'Social'],
    datingGoals: ['Fun dates'],
    preferredVibes: ['Playful'],
    showcaseScore: 73,
  },
];

function localDateKey(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function pairKeyFor(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

function toShowcaseCuratedMatch(
  currentUser: User,
  candidate: Profile & { showcaseScore: number },
  date: string,
  index: number
): CuratedMatch {
  const score = candidate.showcaseScore;
  const createdAt = new Date(Date.now() - index * 60_000);

  return {
    id: `showcase-${candidate.id}`,
    batchId: `${currentUser.id}_${date}_showcase`,
    userId: currentUser.id,
    candidateId: candidate.id,
    candidate,
    pairKey: pairKeyFor(currentUser.id, candidate.id),
    aiReason: buildAiReason(currentUser, candidate, score),
    compatibilityLabel: compatibilityLabel(score),
    compatibilityScore: score,
    status: 'pending',
    feedbackTags: [],
    createdAt,
  };
}

function readShowcaseBatch(currentUser: User): DailyMatchBatch {
  const date = localDateKey();

  return {
    id: `${currentUser.id}_${date}_showcase`,
    userId: currentUser.id,
    date,
    matches: SHOWCASE_PROFILES.map((profile, index) =>
      toShowcaseCuratedMatch(currentUser, profile, date, index)
    ),
    createdAt: new Date(),
  };
}

export function createShowcaseAiPicksService(currentUser: User): MatchingGateway {
  const readMatch = async (matchId: string): Promise<CuratedMatch> => {
    const batch = await readShowcaseBatch(currentUser);
    const match = batch.matches.find(item => item.id === matchId);
    if (!match) throw new Error('Showcase match not found');
    return match;
  };

  return {
    getTodayMatches() {
      return Promise.resolve(readShowcaseBatch(currentUser));
    },

    submitFeedback(
      matchId: string,
      _decision: Exclude<MatchFeedbackDecision, 'accepted'>,
      _tags: string[],
      _note?: string
    ) {
      return readMatch(matchId);
    },

    async acceptMatch(matchId: string) {
      return {
        isMutual: true,
        conversationId: matchId.replace(/^showcase-/, 'conversation_'),
        match: await readMatch(matchId),
      };
    },

    getPreferenceProfile(): Promise<PreferenceProfile> {
      return Promise.resolve({
        id: currentUser.id,
        userId: currentUser.id,
        summary: currentUser.bio || 'Showcasing existing matches while AI Picks is disabled.',
        hardFilters: [],
        softPreferences: currentUser.interests,
        feedbackSummary: [],
        updatedAt: new Date(),
      });
    },
  };
}
