import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSign } from 'node:crypto';

const DEFAULT_PASSWORD = 'FloveMock123!';

const mockProfiles = [
  {
    id: 'mock-linh',
    email: 'linh.tran@fpt.edu.vn',
    name: 'Linh Tran',
    age: 20,
    major: 'AI',
    campus: 'HCM',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=face',
    bio: 'AI enthusiast who enjoys quiet coffee shops and building useful side projects.',
    interests: ['AI/ML', 'Coffee', 'Reading', 'Startups'],
  },
  {
    id: 'mock-mai',
    email: 'mai.pham@fpt.edu.vn',
    name: 'Mai Pham',
    age: 21,
    major: 'Design',
    campus: 'HCM',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=face',
    bio: 'Design student, museum wanderer, and playlist maker.',
    interests: ['Design', 'Music', 'Art', 'Travel'],
  },
  {
    id: 'mock-huy',
    email: 'huy.le@fpt.edu.vn',
    name: 'Huy Le',
    age: 22,
    major: 'Biz',
    campus: 'HCM',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face',
    bio: 'Future founder, basketball fan, and late-night ramen expert.',
    interests: ['Startups', 'Finance', 'Basketball', 'Coffee'],
  },
  {
    id: 'mock-thao',
    email: 'thao.vo@fpt.edu.vn',
    name: 'Thao Vo',
    age: 20,
    major: 'Marketing',
    campus: 'Danang',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=400&fit=crop&crop=face',
    bio: 'Content creator who likes dance practice, photoshoots, and beach walks.',
    interests: ['Marketing', 'Photography', 'Dance', 'Travel'],
  },
  {
    id: 'mock-duc',
    email: 'duc.nguyen@fpt.edu.vn',
    name: 'Duc Nguyen',
    age: 23,
    major: 'SE',
    campus: 'Danang',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=face',
    bio: 'Full-stack developer, open-source contributor, and acoustic guitar learner.',
    interests: ['Coding', 'Music', 'Gaming', 'Coffee'],
  },
];

const profileExtras = {
  Linh: {
    personalityTags: ['Thoughtful', 'Curious', 'Calm'],
    datingGoals: ['Slow connection', 'Coffee dates'],
    preferredVibes: ['Deep talks', 'Career-minded', 'Quiet dates'],
    weekendStyle: 'Coffee shop, reading papers, or polishing a side project.',
    conversationStyle: 'Calm, specific, and a little nerdy.',
    memorableThing: 'People remember me as someone who asks good questions.',
    relationshipIntent: 'Looking for a slow connection with shared curiosity.',
  },
  Mai: {
    personalityTags: ['Creative', 'Chill', 'Funny'],
    datingGoals: ['Weekend hangouts', 'New friends first'],
    preferredVibes: ['Creative energy', 'Easy-going'],
    weekendStyle: 'Museum walks, playlists, and trying a new dessert spot.',
    conversationStyle: 'Light at first, then honest once the vibe is right.',
    memorableThing: 'People remember my taste in music and design details.',
    relationshipIntent: 'Start with fun dates and see if the rhythm works.',
  },
  Huy: {
    personalityTags: ['Ambitious', 'Extrovert', 'Energetic'],
    datingGoals: ['Coffee dates', 'Weekend hangouts'],
    preferredVibes: ['Career-minded', 'Active plans'],
    weekendStyle: 'Basketball, startup talks, or late-night ramen.',
    conversationStyle: 'Direct, upbeat, and full of ideas.',
    memorableThing: 'People remember my energy and follow-through.',
    relationshipIntent: 'Interested in someone driven but easy to laugh with.',
  },
  Thao: {
    personalityTags: ['Creative', 'Energetic', 'Extrovert'],
    datingGoals: ['Weekend hangouts', 'New friends first'],
    preferredVibes: ['Creative energy', 'Active plans'],
    weekendStyle: 'Dance practice, photoshoots, or walking near the beach.',
    conversationStyle: 'Warm, playful, and expressive.',
    memorableThing: 'People remember my photos and positive energy.',
    relationshipIntent: 'Open to something natural that starts with friendship.',
  },
  Duc: {
    personalityTags: ['Curious', 'Thoughtful', 'Introvert'],
    datingGoals: ['Slow connection', 'Study partner'],
    preferredVibes: ['Deep talks', 'Same major', 'Quiet dates'],
    weekendStyle: 'Open-source work, guitar practice, or gaming with friends.',
    conversationStyle: 'Quiet at first, then detailed when we share interests.',
    memorableThing: 'People remember me as reliable and easy to trust.',
    relationshipIntent: 'Looking for a steady connection with shared hobbies.',
  },
};

function readEnvFile(filePath) {
  try {
    return Object.fromEntries(
      readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && line.includes('='))
        .map(line => {
          const [key, ...value] = line.split('=');
          return [key, value.join('=').replace(/^"|"$/g, '')];
        })
    );
  } catch {
    return {};
  }
}

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

function base64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function stringValue(value) {
  return { stringValue: value };
}

function integerValue(value) {
  return { integerValue: String(value) };
}

function arrayValue(values) {
  return { arrayValue: { values: values.map(stringValue) } };
}

function mapValue(value) {
  return {
    mapValue: {
      fields: Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, stringValue(entry)])),
    },
  };
}

function profileToFirestoreFields(uid, profile) {
  const firstName = profile.name.split(' ')[0];
  const extra = profileExtras[firstName];
  const now = new Date().toISOString();

  return {
    email: stringValue(profile.email),
    name: stringValue(profile.name),
    age: integerValue(profile.age),
    major: stringValue(profile.major),
    campus: stringValue(profile.campus),
    avatar: stringValue(profile.avatar),
    bio: stringValue(profile.bio),
    interests: arrayValue(profile.interests),
    personalityTags: arrayValue(extra.personalityTags),
    datingGoals: arrayValue(extra.datingGoals),
    preferredVibes: arrayValue(extra.preferredVibes),
    profileText: mapValue({
      bio: profile.bio,
      weekendStyle: extra.weekendStyle,
      conversationStyle: extra.conversationStyle,
      memorableThing: extra.memorableThing,
      relationshipIntent: extra.relationshipIntent,
    }),
    profileCompleteness: integerValue(100),
    onboardingSource: stringValue('sample_autofill'),
    isSeedProfile: { booleanValue: true },
    seedKey: stringValue(`mock-${uid}`),
    createdAt: { timestampValue: now },
    updatedAt: { timestampValue: now },
  };
}

async function requestJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || response.statusText;
    throw new Error(message);
  }
  return data;
}

function readServiceAccount() {
  const inlineJson = env('FIREBASE_SERVICE_ACCOUNT_JSON');
  if (inlineJson) return JSON.parse(inlineJson);

  const credentialsPath = env('GOOGLE_APPLICATION_CREDENTIALS');
  if (!credentialsPath) return null;
  return JSON.parse(readFileSync(resolve(credentialsPath), 'utf8'));
}

async function getServiceAccountAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const unsignedJwt = `${header}.${payload}`;
  const signature = createSign('RSA-SHA256')
    .update(unsignedJwt)
    .sign(serviceAccount.private_key, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  const jwt = `${unsignedJwt}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error_description || data?.error || response.statusText;
    throw new Error(message);
  }
  return data.access_token;
}

async function authProfile(apiKey, email, password) {
  const signUpUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
  const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

  try {
    return await requestJson(signUpUrl, { email, password, returnSecureToken: true });
  } catch (error) {
    if (!String(error.message).includes('EMAIL_EXISTS')) throw error;
    return requestJson(signInUrl, { email, password, returnSecureToken: true });
  }
}

async function patchUserDocument(projectId, idToken, uid, fields) {
  const fieldMask = Object.keys(fields)
    .map(field => `updateMask.fieldPaths=${encodeURIComponent(field)}`)
    .join('&');
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}?${fieldMask}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || response.statusText;
    throw new Error(message);
  }
}

async function seedWithServiceAccount(projectId, serviceAccount) {
  const accessToken = await getServiceAccountAccessToken(serviceAccount);

  for (const profile of mockProfiles) {
    await patchUserDocument(
      projectId,
      accessToken,
      profile.id,
      profileToFirestoreFields(profile.id, profile)
    );
    console.log(`Seeded users/${profile.id} for ${profile.email}`);
  }
}

async function seedWithClientAuth(apiKey, projectId, password) {
  for (const profile of mockProfiles) {
    const auth = await authProfile(apiKey, profile.email, password);
    await patchUserDocument(
      projectId,
      auth.idToken,
      auth.localId,
      profileToFirestoreFields(auth.localId, profile)
    );
    console.log(`Seeded users/${auth.localId} for ${profile.email}`);
  }
}

async function main() {
  const fileEnv = {
    ...readEnvFile(resolve(process.cwd(), '.env')),
    ...readEnvFile(resolve(process.cwd(), '.env.local')),
  };

  for (const [key, value] of Object.entries(fileEnv)) {
    process.env[key] ||= value;
  }

  const apiKey = env('VITE_FIREBASE_API_KEY');
  const projectId = env('VITE_FIREBASE_PROJECT_ID');
  const password = env('MOCK_SEED_PASSWORD', DEFAULT_PASSWORD);
  const serviceAccount = readServiceAccount();

  if (!projectId) {
    throw new Error('Missing VITE_FIREBASE_PROJECT_ID in .env.local.');
  }

  console.log(`Seeding ${mockProfiles.length} mock users into Firebase project ${projectId}...`);

  if (serviceAccount) {
    await seedWithServiceAccount(projectId, serviceAccount);
  } else {
    if (!apiKey) {
      throw new Error('Missing VITE_FIREBASE_API_KEY in .env.local.');
    }
    await seedWithClientAuth(apiKey, projectId, password);
  }

  console.log('Mock Firestore users are ready.');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
