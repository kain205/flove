import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import {
  curatedMatchFromFirestore,
  type CuratedMatchDoc,
  type FirestoreRecord,
  profileFromFirestore,
  toDate,
} from '@/services/firestoreMappers';
import type {
  CuratedMatch,
  DailyMatchBatch,
  MatchFeedbackDecision,
  PreferenceProfile,
  Profile,
} from '@/types';
import type { MatchingGateway } from './types';
import { buildAiReason, compatibilityLabel, scoreCandidate } from './matchingScoring';

const DAILY_PICK_LIMIT = 5;
const MIN_DAILY_PICK_TARGET = 3;

export function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
}

export function localDateKey(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function batchIdFor(uid: string, date: string): string {
  return `${uid}_${date}`;
}

export function pairKeyFor(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

async function getCurrentProfile(uid: string): Promise<Profile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return profileFromFirestore(snap.id, snap.data());
}

export async function getPreferenceProfileForUid(uid: string): Promise<PreferenceProfile> {
  const prefRef = doc(db, 'preferenceProfiles', uid);
  const snap = await getDoc(prefRef);
  const now = new Date();

  if (!snap.exists()) {
    const profile = await getCurrentProfile(uid);
    const summary = profile?.bio
      ? `Interested in people who fit this profile context: ${profile.bio}`
      : 'Still learning dating preferences from feedback.';

    await setDoc(prefRef, {
      userId: uid,
      summary,
      hardFilters: [],
      softPreferences: profile?.interests ?? [],
      feedbackSummary: [],
      updatedAt: serverTimestamp(),
    });

    return {
      id: uid,
      userId: uid,
      summary,
      hardFilters: [],
      softPreferences: profile?.interests ?? [],
      feedbackSummary: [],
      updatedAt: now,
    };
  }

  const data = snap.data();
  return {
    id: snap.id,
    userId: (data.userId as string) ?? uid,
    summary: (data.summary as string) ?? 'Still learning dating preferences from feedback.',
    hardFilters: (data.hardFilters as string[]) ?? [],
    softPreferences: (data.softPreferences as string[]) ?? [],
    feedbackSummary: (data.feedbackSummary as string[]) ?? [],
    updatedAt: toDate(data.updatedAt),
  };
}

async function getConnectedUserIds(uid: string): Promise<Set<string>> {
  const snap = await getDocs(
    query(collection(db, 'matches'), where('users', 'array-contains', uid))
  );
  const ids = new Set<string>();

  snap.docs.forEach(matchDoc => {
    const users = (matchDoc.data().users as string[]) ?? [];
    users.filter(userId => userId !== uid).forEach(userId => ids.add(userId));
  });

  return ids;
}

async function readBatchMatches(batchId: string): Promise<CuratedMatch[]> {
  const snap = await getDocs(
    query(collection(db, 'curatedMatches'), where('batchId', '==', batchId))
  );

  return snap.docs
    .map(matchDoc => curatedMatchFromFirestore(matchDoc.id, matchDoc.data() as CuratedMatchDoc))
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore);
}

export async function readCuratedMatch(matchId: string): Promise<CuratedMatch> {
  const snap = await getDoc(doc(db, 'curatedMatches', matchId));
  if (!snap.exists()) throw new Error('Curated match not found');
  return curatedMatchFromFirestore(snap.id, snap.data() as CuratedMatchDoc);
}

export async function readDailyMatchBatch(uid: string, date: string): Promise<DailyMatchBatch | null> {
  const batchId = batchIdFor(uid, date);
  const batchSnap = await getDoc(doc(db, 'dailyMatchBatches', batchId));
  if (!batchSnap.exists()) return null;

  const matches = await readBatchMatches(batchId);
  return {
    id: batchId,
    userId: uid,
    date,
    matches,
    createdAt: toDate(batchSnap.data().createdAt),
  };
}

async function generateLocalDailyMatches(uid: string, date: string): Promise<void> {
  const batchId = batchIdFor(uid, date);
  const [self, preference, connectedIds, usersSnap] = await Promise.all([
    getCurrentProfile(uid),
    getPreferenceProfileForUid(uid),
    getConnectedUserIds(uid),
    getDocs(query(collection(db, 'users'), limit(40))),
  ]);

  const candidates = usersSnap.docs
    .filter(userDoc => userDoc.id !== uid && !connectedIds.has(userDoc.id))
    .map(userDoc => profileFromFirestore(userDoc.id, userDoc.data()))
    .map(candidate => {
      const score = scoreCandidate(self, candidate, preference);
      return {
        candidate,
        score,
        reason: buildAiReason(self, candidate, score),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, DAILY_PICK_LIMIT);

  const batch = writeBatch(db);
  const batchRef = doc(db, 'dailyMatchBatches', batchId);
  const matchIds: string[] = [];

  candidates.forEach(({ candidate, score, reason }) => {
    const matchId = `${batchId}_${candidate.id}`;
    matchIds.push(matchId);
    batch.set(doc(db, 'curatedMatches', matchId), {
      batchId,
      userId: uid,
      candidateId: candidate.id,
      candidateSnapshot: candidate,
      pairKey: pairKeyFor(uid, candidate.id),
      aiReason: reason,
      compatibilityLabel: compatibilityLabel(score),
      compatibilityScore: score,
      status: 'pending',
      feedbackTags: [],
      createdAt: serverTimestamp(),
    });
  });

  batch.set(batchRef, {
    userId: uid,
    date,
    matchIds,
    targetCount: Math.min(DAILY_PICK_LIMIT, Math.max(MIN_DAILY_PICK_TARGET, candidates.length)),
    generatedBy: 'local-curation-fallback',
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}

async function ensureTodayBatch(uid: string, date: string): Promise<DailyMatchBatch> {
  const existing = await readDailyMatchBatch(uid, date);
  if (existing) return existing;

  await generateLocalDailyMatches(uid, date);
  const generated = await readDailyMatchBatch(uid, date);
  if (!generated) throw new Error('Local matching did not create today match batch');
  return generated;
}

async function recordFeedback(
  matchId: string,
  decision: MatchFeedbackDecision,
  tags: string[],
  note?: string
): Promise<CuratedMatch> {
  const uid = currentUid();
  const matchRef = doc(db, 'curatedMatches', matchId);
  const matchSnap = await getDoc(matchRef);
  if (!matchSnap.exists()) throw new Error('Curated match not found');

  const matchData = matchSnap.data() as CuratedMatchDoc;
  if (matchData.userId !== uid) throw new Error('Cannot update another user match');

  const feedbackRef = doc(collection(db, 'matchFeedback'));
  const nextStatus = decision === 'accepted' ? 'accepted' : decision;
  const preferenceUpdate: FirestoreRecord = {
    userId: uid,
    feedbackSummary: arrayUnion(`${decision}: ${tags.join(', ') || 'no tags'}`),
    updatedAt: serverTimestamp(),
  };

  if (decision === 'accepted' && matchData.candidateSnapshot.interests.length > 0) {
    preferenceUpdate.softPreferences = arrayUnion(...matchData.candidateSnapshot.interests.slice(0, 3));
  }

  const batch = writeBatch(db);
  batch.set(feedbackRef, {
    matchId,
    userId: uid,
    candidateId: matchData.candidateId,
    decision,
    tags,
    note: note ?? '',
    createdAt: serverTimestamp(),
  });
  batch.update(matchRef, {
    status: nextStatus,
    feedbackTags: tags,
    feedbackNote: note ?? '',
    decidedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'preferenceProfiles', uid), preferenceUpdate, { merge: true });

  await batch.commit();

  return readCuratedMatch(matchId);
}

export const localFirestoreMatchingGateway: MatchingGateway = {
  async getTodayMatches(): Promise<DailyMatchBatch> {
    const uid = currentUid();
    const date = localDateKey();
    return ensureTodayBatch(uid, date);
  },

  async submitFeedback(
    matchId: string,
    decision: Exclude<MatchFeedbackDecision, 'accepted'>,
    tags: string[],
    note?: string
  ): Promise<CuratedMatch> {
    return recordFeedback(matchId, decision, tags, note);
  },

  async acceptMatch(
    matchId: string,
    tags: string[] = [],
    note?: string
  ): Promise<{ isMutual: boolean; conversationId?: string; match: CuratedMatch }> {
    const accepted = await recordFeedback(matchId, 'accepted', tags, note);

    const pairSnap = await getDocs(
      query(collection(db, 'curatedMatches'), where('pairKey', '==', accepted.pairKey))
    );
    const pairDocs = pairSnap.docs.map(matchDoc => ({
      id: matchDoc.id,
      data: matchDoc.data() as CuratedMatchDoc,
    }));
    const acceptedUsers = new Set(
      pairDocs
        .filter(({ data }) => data.status === 'accepted' || data.status === 'matched')
        .map(({ data }) => data.userId)
    );
    const pairUsers = [accepted.userId, accepted.candidateId];
    const isMutual = pairUsers.every(userId => acceptedUsers.has(userId));

    if (!isMutual) {
      return { isMutual: false, match: accepted };
    }

    const matchRef = doc(db, 'matches', accepted.pairKey);
    const conversationRef = doc(db, 'conversations', `conversation_${accepted.pairKey}`);
    const batch = writeBatch(db);

    batch.set(matchRef, {
      users: pairUsers,
      pairKey: accepted.pairKey,
      source: 'ai-curated',
      matchedAt: serverTimestamp(),
      isRevealed: true,
    }, { merge: true });
    batch.set(conversationRef, {
      users: pairUsers,
      matchId: matchRef.id,
      pairKey: accepted.pairKey,
      isAnonymous: false,
      lastMessage: null,
      updatedAt: serverTimestamp(),
      unreadCounts: { [pairUsers[0]]: 0, [pairUsers[1]]: 0 },
    }, { merge: true });
    pairDocs.forEach(({ id }) => {
      batch.update(doc(db, 'curatedMatches', id), {
        status: 'matched',
        decidedAt: serverTimestamp(),
      });
    });

    await batch.commit();

    return {
      isMutual: true,
      conversationId: conversationRef.id,
      match: { ...accepted, status: 'matched' },
    };
  },

  async getPreferenceProfile(): Promise<PreferenceProfile> {
    return getPreferenceProfileForUid(currentUid());
  },
};
