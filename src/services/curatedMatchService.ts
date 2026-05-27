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
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { aiBackendService } from './aiBackendService';
import { isMockMode, mockService } from './mockService';
import {
  CuratedMatch,
  DailyMatchBatch,
  MatchFeedbackDecision,
  PreferenceProfile,
  Profile,
} from '@/types';

type CuratedMatchDoc = Omit<CuratedMatch, 'candidate' | 'createdAt' | 'decidedAt'> & {
  candidateSnapshot: Profile;
  createdAt?: { toDate?: () => Date };
  decidedAt?: { toDate?: () => Date };
};

const DAILY_PICK_LIMIT = 5;
const MIN_DAILY_PICK_TARGET = 3;

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
}

function localDateKey(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function batchIdFor(uid: string, date: string): string {
  return `${uid}_${date}`;
}

function pairKeyFor(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

function toDate(value: unknown): Date {
  return (value as { toDate?: () => Date })?.toDate?.() ?? new Date();
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

function curatedDocToMatch(id: string, data: CuratedMatchDoc): CuratedMatch {
  return {
    id,
    batchId: data.batchId,
    userId: data.userId,
    candidateId: data.candidateId,
    candidate: data.candidateSnapshot,
    pairKey: data.pairKey,
    aiReason: data.aiReason,
    compatibilityLabel: data.compatibilityLabel,
    compatibilityScore: data.compatibilityScore,
    status: data.status,
    feedbackTags: data.feedbackTags ?? [],
    feedbackNote: data.feedbackNote,
    createdAt: toDate(data.createdAt),
    decidedAt: data.decidedAt ? toDate(data.decidedAt) : undefined,
  };
}

async function getCurrentProfile(uid: string): Promise<Profile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return docToProfile(snap.id, snap.data() as Record<string, unknown>);
}

async function getPreferenceProfile(uid: string): Promise<PreferenceProfile> {
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

function scoreCandidate(
  self: Profile | null,
  candidate: Profile,
  preference: PreferenceProfile
): number {
  const selfInterests = new Set(self?.interests ?? []);
  const sharedInterests = candidate.interests.filter(interest => selfInterests.has(interest));
  const preferenceText = [
    preference.summary,
    ...preference.softPreferences,
    ...preference.feedbackSummary,
  ].join(' ').toLowerCase();

  let score = 58;
  score += Math.min(sharedInterests.length * 10, 24);
  if (self?.campus && self.campus === candidate.campus) score += 10;
  if (self?.major && self.major === candidate.major) score += 6;
  candidate.interests.forEach(interest => {
    if (preferenceText.includes(interest.toLowerCase())) score += 4;
  });

  return Math.max(45, Math.min(score, 96));
}

function compatibilityLabel(score: number): string {
  if (score >= 86) return 'High intent fit';
  if (score >= 74) return 'Strong potential';
  if (score >= 64) return 'Worth exploring';
  return 'Fresh perspective';
}

function aiReason(self: Profile | null, candidate: Profile, score: number): string {
  const shared = candidate.interests.filter(interest => self?.interests.includes(interest));
  const reasons: string[] = [];

  if (shared.length > 0) {
    reasons.push(`You both mention ${shared.slice(0, 2).join(' and ')}`);
  }
  if (self?.campus === candidate.campus) {
    reasons.push(`same FPT ${candidate.campus} campus makes meeting easier`);
  }
  if (self?.major === candidate.major) {
    reasons.push(`similar academic context in ${candidate.major}`);
  }
  if (candidate.bio) {
    reasons.push(`their bio suggests: "${candidate.bio.slice(0, 90)}${candidate.bio.length > 90 ? '...' : ''}"`);
  }

  if (reasons.length === 0) {
    reasons.push('their profile adds a different but compatible perspective to your current preference pattern');
  }

  return `${compatibilityLabel(score)} because ${reasons.join(', ')}.`;
}

async function readBatchMatches(batchId: string): Promise<CuratedMatch[]> {
  const snap = await getDocs(
    query(collection(db, 'curatedMatches'), where('batchId', '==', batchId))
  );

  return snap.docs
    .map(matchDoc => curatedDocToMatch(matchDoc.id, matchDoc.data() as CuratedMatchDoc))
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore);
}

async function readCuratedMatch(matchId: string): Promise<CuratedMatch> {
  const snap = await getDoc(doc(db, 'curatedMatches', matchId));
  if (!snap.exists()) throw new Error('Curated match not found');
  return curatedDocToMatch(snap.id, snap.data() as CuratedMatchDoc);
}

async function generateLocalDailyMatches(uid: string, date: string): Promise<void> {
  const batchId = batchIdFor(uid, date);
  const [self, preference, connectedIds, usersSnap] = await Promise.all([
    getCurrentProfile(uid),
    getPreferenceProfile(uid),
    getConnectedUserIds(uid),
    getDocs(query(collection(db, 'users'), limit(40))),
  ]);

  const candidates = usersSnap.docs
    .filter(userDoc => userDoc.id !== uid && !connectedIds.has(userDoc.id))
    .map(userDoc => docToProfile(userDoc.id, userDoc.data() as Record<string, unknown>))
    .map(candidate => {
      const score = scoreCandidate(self, candidate, preference);
      return {
        candidate,
        score,
        reason: aiReason(self, candidate, score),
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

async function ensureTodayBatch(uid: string, date: string): Promise<string> {
  const batchId = batchIdFor(uid, date);
  const batchRef = doc(db, 'dailyMatchBatches', batchId);
  const snap = await getDoc(batchRef);

  if (snap.exists()) return batchId;

  if (aiBackendService.isEnabled()) {
    await aiBackendService.generateDailyMatches(date);
    const generated = await getDoc(batchRef);
    if (generated.exists()) return batchId;
  }

  await generateLocalDailyMatches(uid, date);
  return batchId;
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
  const preferenceUpdate: Record<string, unknown> = {
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

  const updated = await getDoc(matchRef);
  return curatedDocToMatch(updated.id, updated.data() as CuratedMatchDoc);
}

export const curatedMatchService = {
  async getTodayMatches(): Promise<DailyMatchBatch> {
    if (isMockMode()) {
      return mockService.getTodayMatches();
    }

    const uid = currentUid();
    const date = localDateKey();
    const batchId = await ensureTodayBatch(uid, date);
    const batchSnap = await getDoc(doc(db, 'dailyMatchBatches', batchId));
    const matches = await readBatchMatches(batchId);

    return {
      id: batchId,
      userId: uid,
      date,
      matches,
      createdAt: toDate(batchSnap.data()?.createdAt),
    };
  },

  async submitFeedback(
    matchId: string,
    decision: Exclude<MatchFeedbackDecision, 'accepted'>,
    tags: string[],
    note?: string
  ): Promise<CuratedMatch> {
    if (isMockMode()) {
      return mockService.submitFeedback(matchId, decision, tags, note);
    }

    if (aiBackendService.isEnabled()) {
      await aiBackendService.submitMatchFeedback(matchId, decision, tags, note);
      return readCuratedMatch(matchId);
    }

    return recordFeedback(matchId, decision, tags, note);
  },

  async acceptMatch(
    matchId: string,
    tags: string[] = [],
    note?: string
  ): Promise<{ isMutual: boolean; conversationId?: string; match: CuratedMatch }> {
    if (isMockMode()) {
      return mockService.acceptMatch(matchId, tags, note);
    }

    if (aiBackendService.isEnabled()) {
      await aiBackendService.acceptCuratedMatch(matchId, tags, note);
      const match = await readCuratedMatch(matchId);
      return {
        isMutual: match.status === 'matched',
        conversationId: match.status === 'matched' ? `conversation_${match.pairKey}` : undefined,
        match,
      };
    }

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
    if (isMockMode()) {
      return mockService.getPreferenceProfile();
    }

    return getPreferenceProfile(currentUid());
  },
};
