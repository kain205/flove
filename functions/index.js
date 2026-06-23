import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

initializeApp();

const db = getFirestore();
const openaiApiKey = defineSecret('OPENAI_API_KEY');

const DAILY_PICK_LIMIT = 5;
const SHORTLIST_LIMIT = 8;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

function requireUid(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in is required.');
  return uid;
}

function localDateKey(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function batchIdFor(uid, date) {
  return `${uid}_${date}`;
}

function pairKeyFor(uidA, uidB) {
  return [uidA, uidB].sort().join('_');
}

function profileFromDoc(doc) {
  const data = doc.data() || {};
  const profileText = data.profileText || {};
  return {
    id: doc.id,
    email: data.email || '',
    name: data.name || 'FPT Student',
    age: data.age || 0,
    major: data.major || 'SE',
    campus: data.campus || 'HCM',
    avatar: data.avatar || '',
    bio: data.bio || profileText.bio || '',
    interests: data.interests || [],
    personalityTags: data.personalityTags || [],
    datingGoals: data.datingGoals || [],
    preferredVibes: data.preferredVibes || [],
    profileText: {
      bio: profileText.bio || data.bio || '',
      weekendStyle: profileText.weekendStyle || '',
      conversationStyle: profileText.conversationStyle || '',
      memorableThing: profileText.memorableThing || '',
      relationshipIntent: profileText.relationshipIntent || '',
    },
    profileCompleteness: data.profileCompleteness || 0,
    onboardingSource: data.onboardingSource,
    aiSignals: data.aiSignals,
  };
}

function joinVi(items) {
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} va ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} va ${items[items.length - 1]}`;
}

function scoreCandidate(self, candidate, preference) {
  const selfInterests = new Set(self?.interests || []);
  const sharedInterests = candidate.interests.filter(interest => selfInterests.has(interest));
  const preferenceText = [
    preference.summary,
    ...(preference.softPreferences || []),
    ...(preference.feedbackSummary || []),
    ...(self?.preferredVibes || []),
    ...(self?.datingGoals || []),
  ].join(' ').toLowerCase();

  let score = 58;
  score += Math.min(sharedInterests.length * 10, 24);
  if (self?.campus && self.campus === candidate.campus) score += 10;
  if (self?.major && self.major === candidate.major) score += 6;
  (candidate.personalityTags || []).forEach(tag => {
    if (preferenceText.includes(String(tag).toLowerCase())) score += 4;
  });
  (candidate.datingGoals || []).forEach(goal => {
    if (self?.datingGoals?.includes(goal)) score += 5;
  });
  candidate.interests.forEach(interest => {
    if (preferenceText.includes(String(interest).toLowerCase())) score += 4;
  });

  return Math.max(45, Math.min(score, 96));
}

function compatibilityLabel(score) {
  if (score >= 86) return 'High intent fit';
  if (score >= 74) return 'Strong potential';
  if (score >= 64) return 'Worth exploring';
  return 'Fresh perspective';
}

function fallbackReason(self, candidate) {
  const shared = candidate.interests.filter(interest => self?.interests?.includes(interest));
  const reasons = [];
  if (shared.length > 0) reasons.push(`ca hai cung quan tam ${joinVi(shared.slice(0, 2))}`);
  if (self?.campus === candidate.campus) reasons.push(`cung campus ${candidate.campus}`);
  if (self?.major === candidate.major) reasons.push(`cung nganh ${candidate.major}`);
  const goals = (candidate.datingGoals || []).filter(goal => self?.datingGoals?.includes(goal));
  if (goals.length > 0) reasons.push(`cung huong toi ${joinVi(goals.slice(0, 2))}`);
  if (candidate.bio) reasons.push(`profile cua ban ay noi ve: ${candidate.bio.slice(0, 90)}`);
  return `AI chon ${candidate.name} vi ${reasons.join(', ') || 'profile tao mot goc nhin moi nhung van hop voi tin hieu hien tai cua ban'}.`;
}

async function readPreferenceProfile(uid, self) {
  const ref = db.doc(`preferenceProfiles/${uid}`);
  const snap = await ref.get();
  if (snap.exists) return { id: snap.id, ...snap.data() };

  const preference = {
    userId: uid,
    summary: self?.bio
      ? `Interested in people who fit this profile context: ${self.bio}`
      : 'Still learning dating preferences from feedback.',
    hardFilters: [],
    softPreferences: self?.interests || [],
    feedbackSummary: [],
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(preference, { merge: true });
  return { id: uid, ...preference };
}

async function getConnectedUserIds(uid) {
  const snap = await db.collection('matches').where('users', 'array-contains', uid).get();
  const ids = new Set();
  snap.docs.forEach(matchDoc => {
    const users = matchDoc.data().users || [];
    users.filter(userId => userId !== uid).forEach(userId => ids.add(userId));
  });
  return ids;
}

function compactProfile(profile) {
  return {
    id: profile.id,
    name: profile.name,
    age: profile.age,
    major: profile.major,
    campus: profile.campus,
    bio: profile.bio,
    interests: profile.interests,
    personalityTags: profile.personalityTags,
    datingGoals: profile.datingGoals,
    preferredVibes: profile.preferredVibes,
    profileText: profile.profileText,
  };
}

function normalizeAiMatches(parsed, shortlist) {
  const byId = new Map(shortlist.map(item => [item.candidate.id, item]));
  const matches = Array.isArray(parsed.matches) ? parsed.matches : [];

  return matches
    .filter(item => byId.has(item.candidateId))
    .map(item => {
      const base = byId.get(item.candidateId);
      const score = Number.isFinite(item.score) ? Math.round(item.score) : base.score;
      return {
        candidate: base.candidate,
        score: Math.max(45, Math.min(score, 96)),
        reason: typeof item.reason === 'string' && item.reason.trim()
          ? item.reason.trim()
          : fallbackReason(base.self, base.candidate),
      };
    })
    .slice(0, DAILY_PICK_LIMIT);
}

async function rankWithOpenAi(self, preference, shortlist) {
  const key = openaiApiKey.value();
  if (!key) throw new Error('OPENAI_API_KEY is not configured.');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: [
            'You are the matching engine for F-Love, an FPT student dating app.',
            'Rank candidates for romantic compatibility using only provided profile fields.',
            'Return JSON only. Reasons must be concise Vietnamese, warm, specific, and not creepy.',
            'Do not mention private data, embeddings, or that this is a fallback.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify({
            currentUser: compactProfile(self),
            preferenceProfile: {
              summary: preference.summary || '',
              hardFilters: preference.hardFilters || [],
              softPreferences: preference.softPreferences || [],
              feedbackSummary: preference.feedbackSummary || [],
            },
            candidates: shortlist.map(item => ({
              ...compactProfile(item.candidate),
              baseScore: item.score,
              baseReason: item.reason,
            })),
            outputShape: {
              matches: [
                {
                  candidateId: 'string',
                  score: 'number 45-96',
                  reason: 'Vietnamese sentence explaining why this candidate fits',
                },
              ],
            },
          }),
        },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || response.statusText);
  }

  const text = data.choices?.[0]?.message?.content || '';
  const parsed = JSON.parse(text);
  const ranked = normalizeAiMatches(parsed, shortlist);
  if (ranked.length === 0) throw new Error('OpenAI returned no usable matches.');
  return ranked;
}

async function readCuratedMatch(matchId) {
  const snap = await db.doc(`curatedMatches/${matchId}`).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Curated match not found.');
  return { id: snap.id, ...snap.data() };
}

async function recordFeedback(uid, matchId, decision, tags = [], note = '') {
  const matchRef = db.doc(`curatedMatches/${matchId}`);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) throw new HttpsError('not-found', 'Curated match not found.');

  const match = matchSnap.data();
  if (match.userId !== uid) throw new HttpsError('permission-denied', 'Cannot update another user match.');

  const feedbackRef = db.collection('matchFeedback').doc();
  const batch = db.batch();
  batch.set(feedbackRef, {
    matchId,
    userId: uid,
    candidateId: match.candidateId,
    decision,
    tags,
    note,
    createdAt: FieldValue.serverTimestamp(),
  });
  batch.update(matchRef, {
    status: decision === 'accepted' ? 'accepted' : decision,
    feedbackTags: tags,
    feedbackNote: note,
    decidedAt: FieldValue.serverTimestamp(),
  });
  batch.set(db.doc(`preferenceProfiles/${uid}`), {
    userId: uid,
    feedbackSummary: FieldValue.arrayUnion(`${decision}: ${tags.join(', ') || 'no tags'}`),
    updatedAt: FieldValue.serverTimestamp(),
    ...(decision === 'accepted' && match.candidateSnapshot?.interests?.length
      ? { softPreferences: FieldValue.arrayUnion(...match.candidateSnapshot.interests.slice(0, 3)) }
      : {}),
  }, { merge: true });

  await batch.commit();
  return readCuratedMatch(matchId);
}

export const generateDailyMatches = onCall({ secrets: [openaiApiKey] }, async request => {
  const uid = requireUid(request);
  const date = typeof request.data?.date === 'string' ? request.data.date : localDateKey();
  const batchId = batchIdFor(uid, date);
  const existing = await db.doc(`dailyMatchBatches/${batchId}`).get();
  if (existing.exists && (existing.data().matchIds || []).length > 0) {
    return { ok: true, batchId, reused: true };
  }

  const selfSnap = await db.doc(`users/${uid}`).get();
  if (!selfSnap.exists) throw new HttpsError('failed-precondition', 'Complete your profile before AI Picks.');

  const self = profileFromDoc(selfSnap);
  const [preference, connectedIds, usersSnap] = await Promise.all([
    readPreferenceProfile(uid, self),
    getConnectedUserIds(uid),
    db.collection('users').limit(40).get(),
  ]);

  const shortlist = usersSnap.docs
    .filter(userDoc => userDoc.id !== uid && !connectedIds.has(userDoc.id))
    .map(userDoc => profileFromDoc(userDoc))
    .filter(candidate => candidate.interests.length > 0 || candidate.bio)
    .map(candidate => {
      const score = scoreCandidate(self, candidate, preference);
      return {
        self,
        candidate,
        score,
        reason: fallbackReason(self, candidate),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, SHORTLIST_LIMIT);

  let selected = shortlist.slice(0, DAILY_PICK_LIMIT).map(item => ({
    candidate: item.candidate,
    score: item.score,
    reason: item.reason,
  }));
  let generatedBy = 'local-curation-fallback';

  if (shortlist.length > 0) {
    try {
      selected = await rankWithOpenAi(self, preference, shortlist);
      generatedBy = `openai-${OPENAI_MODEL}`;
    } catch (error) {
      console.error('OpenAI matching failed, using fallback.', error);
    }
  }

  const batch = db.batch();
  const matchIds = [];
  selected.forEach(({ candidate, score, reason }) => {
    const matchId = `${batchId}_${candidate.id}`;
    matchIds.push(matchId);
    batch.set(db.doc(`curatedMatches/${matchId}`), {
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
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  batch.set(db.doc(`dailyMatchBatches/${batchId}`), {
    userId: uid,
    date,
    matchIds,
    targetCount: Math.min(DAILY_PICK_LIMIT, selected.length),
    generatedBy,
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
  return { ok: true, batchId, generatedBy, matchCount: selected.length };
});

export const submitMatchFeedback = onCall(async request => {
  const uid = requireUid(request);
  const { matchId, decision, tags = [], note = '' } = request.data || {};
  if (!matchId || !['declined', 'skipped', 'reported'].includes(decision)) {
    throw new HttpsError('invalid-argument', 'Invalid match feedback payload.');
  }
  await recordFeedback(uid, matchId, decision, tags, note);
  return { ok: true };
});

export const acceptCuratedMatch = onCall(async request => {
  const uid = requireUid(request);
  const { matchId, tags = [], note = '' } = request.data || {};
  if (!matchId) throw new HttpsError('invalid-argument', 'matchId is required.');

  const accepted = await recordFeedback(uid, matchId, 'accepted', tags, note);
  const pairSnap = await db.collection('curatedMatches').where('pairKey', '==', accepted.pairKey).get();
  const pairDocs = pairSnap.docs.map(doc => ({ id: doc.id, data: doc.data() }));
  const acceptedUsers = new Set(
    pairDocs
      .filter(({ data }) => data.status === 'accepted' || data.status === 'matched')
      .map(({ data }) => data.userId)
  );
  const pairUsers = [accepted.userId, accepted.candidateId];
  const isMutual = pairUsers.every(userId => acceptedUsers.has(userId));
  if (!isMutual) return { ok: true, isMutual: false };

  const batch = db.batch();
  const matchRef = db.doc(`matches/${accepted.pairKey}`);
  const conversationRef = db.doc(`conversations/conversation_${accepted.pairKey}`);
  batch.set(matchRef, {
    users: pairUsers,
    pairKey: accepted.pairKey,
    source: 'ai-curated',
    matchedAt: FieldValue.serverTimestamp(),
    isRevealed: true,
  }, { merge: true });
  batch.set(conversationRef, {
    users: pairUsers,
    matchId: matchRef.id,
    pairKey: accepted.pairKey,
    isAnonymous: false,
    lastMessage: null,
    updatedAt: FieldValue.serverTimestamp(),
    unreadCounts: { [pairUsers[0]]: 0, [pairUsers[1]]: 0 },
  }, { merge: true });
  pairDocs.forEach(({ id }) => {
    batch.update(db.doc(`curatedMatches/${id}`), {
      status: 'matched',
      decidedAt: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();

  return { ok: true, isMutual: true, conversationId: conversationRef.id };
});

export const sendPreferenceChatMessage = onCall(async request => {
  const uid = requireUid(request);
  const content = String(request.data?.content || '').trim();
  if (!content) throw new HttpsError('invalid-argument', 'content is required.');

  const chatRef = db.collection(`preferenceChats/${uid}/messages`);
  const hints = content
    .split(/[,.!?;\n]/)
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 4);

  await Promise.all([
    chatRef.add({ sender: 'user', content, createdAt: FieldValue.serverTimestamp() }),
    chatRef.add({
      sender: 'assistant',
      content: hints.length > 0
        ? `Saved. Future picks will account for: ${hints.join('; ')}.`
        : 'Saved. Tell me more when you want to tune future AI Picks.',
      createdAt: FieldValue.serverTimestamp(),
    }),
    db.doc(`preferenceProfiles/${uid}`).set({
      userId: uid,
      summary: content,
      softPreferences: hints,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }),
  ]);

  return { ok: true };
});
