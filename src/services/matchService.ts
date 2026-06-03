import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Match } from '@/types';
import { profileFromFirestore } from './firestoreMappers';

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
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
          ? profileFromFirestore(userSnap.id, userSnap.data())
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
