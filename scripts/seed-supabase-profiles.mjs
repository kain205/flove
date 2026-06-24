// Seeds mock candidate profiles into Supabase (Cloud) in the notebook-onboarding schema so the
// embedding matching pipeline has a real candidate pool. Creates auth users + confirmed profiles,
// and (when OPENAI_API_KEY is set) generates the five embeddings each profile is matched on.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... OPENAI_API_KEY=... node scripts/seed-supabase-profiles.mjs
// SUPABASE_URL falls back to EXPO_PUBLIC_SUPABASE_URL / apps/app/.env. OPENAI_API_KEY is optional
// (without it, vectors are left null and matching falls back to signal-based scoring).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_PASSWORD, mockProfiles, buildAnalysis, buildVectorTexts } from './mock-profiles.mjs';

function readEnvFile(path) {
  try {
    const out = {};
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) out[match[1]] = match[2].trim();
    }
    return out;
  } catch {
    return {};
  }
}

const appEnv = readEnvFile(resolve(process.cwd(), 'apps/app/.env'));
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || appEnv.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

if (!SUPABASE_URL) {
  console.error('Missing SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL).');
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY. Get it from the Supabase dashboard (Settings → API).');
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.warn('⚠️  OPENAI_API_KEY not set — seeding profiles WITHOUT embeddings (matching uses signal-based fallback).');
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function unique(items) {
  return Array.from(new Set(items.map(i => String(i).trim()).filter(Boolean)));
}
function recordKeys(record = {}) {
  return Object.keys(record).filter(k => (record[k] ?? 0) > 0);
}
function formatVector(values) {
  return values && values.length ? `[${values.join(',')}]` : null;
}

async function embed(text) {
  if (!OPENAI_API_KEY || !text.trim()) return null;
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });
  if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}: ${await res.text().catch(() => '')}`);
  const json = await res.json();
  return json.data?.[0]?.embedding ?? null;
}

async function ensureAuthUser(email, idByEmail) {
  if (idByEmail.has(email)) return idByEmail.get(email);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

async function run() {
  console.log(`Seeding ${mockProfiles.length} mock profiles into ${SUPABASE_URL} ...`);

  const { data: list, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;
  const idByEmail = new Map((list?.users ?? []).map(u => [u.email, u.id]));

  let ok = 0;
  for (const mock of mockProfiles) {
    try {
      const userId = await ensureAuthUser(mock.email, idByEmail);
      const analysis = buildAnalysis(mock);
      const signals = analysis.matchingSignals;

      const interests = unique([...(signals.interests || []), ...(signals.vibeTags || [])]).slice(0, 10);
      const personalityTags = unique([...(signals.selfTraits || []), ...recordKeys(signals.personality)]).slice(0, 10);
      const datingGoals = unique([...(signals.intents || [])]).slice(0, 6);
      const preferredVibes = unique([...(signals.preferredPartnerTraits || []), ...recordKeys(signals.lifestyle)]).slice(0, 10);

      let vectors = { self: null, need: null, preference: null, communication: null, lifestyle: null };
      if (OPENAI_API_KEY) {
        const texts = buildVectorTexts(mock);
        const [self, need, preference, communication, lifestyle] = await Promise.all([
          embed(texts.self), embed(texts.need), embed(texts.preference), embed(texts.communication), embed(texts.lifestyle),
        ]);
        vectors = { self, need, preference, communication, lifestyle };
      }

      const payload = {
        id: userId,
        email: mock.email,
        name: mock.name,
        age: mock.age,
        major: mock.major,
        campus: mock.campus,
        gender: mock.gender,
        looking_for_gender: mock.lookingFor,
        height_cm: mock.heightCm ?? null,
        avatar_url: mock.avatar || '',
        bio: mock.bio,
        interests,
        personality_tags: personalityTags,
        dating_goals: datingGoals,
        preferred_vibes: preferredVibes,
        profile_text: {
          bio: mock.bio,
          school: mock.majorLabel,
          majorLabel: mock.majorLabel,
          weekendStyle: signals.vibeTags.join(', '),
          conversationStyle: '',
          memorableThing: '',
          relationshipIntent: signals.intents.join(', '),
        },
        appearance_preference: signals.appearancePreference,
        dealbreakers: signals.dealbreakers,
        ai_profile_analysis: analysis,
        profile_completeness: 100,
        onboarding_source: 'sample_autofill',
        profile_confirmed: true,
        profile_confirmed_at: new Date().toISOString(),
        self_vector: formatVector(vectors.self),
        need_vector: formatVector(vectors.need),
        preference_vector: formatVector(vectors.preference),
        communication_vector: formatVector(vectors.communication),
        lifestyle_vector: formatVector(vectors.lifestyle),
      };

      const { error } = await admin.from('profiles').upsert(payload);
      if (error) throw error;
      ok += 1;
      console.log(`  ✓ ${mock.name} (${mock.email})${vectors.self ? ' +embeddings' : ''}`);
    } catch (error) {
      console.error(`  ✗ ${mock.email}:`, error.message || error);
    }
  }

  console.log(`Done. ${ok}/${mockProfiles.length} profiles seeded.`);
  console.log(`Mock login password (if you want to sign in as one): ${DEFAULT_PASSWORD}`);
}

run().catch(error => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
