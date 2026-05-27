import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Match, Profile } from '@/types';

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
}

function docToProfile(id: string, data: Record<string, unknown>): Profile {
  return {
    id,
    email: (data.email as string) ?? '',
    name: (data.name as string) ?? 'FPT Student',
    age: (data.age as number) ?? 0,
    major: (data.major as Profile['major']) ?? 'SE',
    campus: (data.campus as Profile['campus']) ?? 'HCM',
    avatar: (data.avatar as string) ?? '',
    bio: (data.bio as string) ?? '',
    interests: (data.interests as string[]) ?? [],
    isOnline: false,
  };
}

export const matchService = {
  async getMatches(): Promise<Match[]> {
    const uid = currentUid();
    const snap = await getDocs(
      query(collection(db, 'matches'), where('users', 'array-contains', uid))
    );

    const matches: Match[] = [];
    for (const matchDoc of snap.docs) {
      const data = matchDoc.data();
      const otherUid = ((data.users as string[]) ?? []).find(userId => userId !== uid) ?? '';
      const userSnap = otherUid ? await getDoc(doc(db, 'users', otherUid)) : null;

      matches.push({
        id: matchDoc.id,
        matchedUser: userSnap?.exists()
          ? docToProfile(userSnap.id, userSnap.data() as Record<string, unknown>)
          : {
              id: otherUid,
              email: '',
              name: 'FPT Student',
              age: 0,
              major: 'SE',
              campus: 'HCM',
              avatar: '',
              bio: '',
              interests: [],
            },
        matchedAt: data.matchedAt?.toDate?.() ?? new Date(),
        isRevealed: data.isRevealed ?? true,
      });
    }

    return matches;
  },
};
