import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User, UserProfile } from '@/types';
import { disableMockMode, enableMockMode, getMockUser, isMockMode, MOCK_USER } from './mockService';
import { normalizeProfileText } from './profileService';

export const FPT_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@fpt\.edu\.vn$/;

function toAppUser(fbUser: FirebaseUser, profile: Partial<UserProfile>): User {
  const profileText = normalizeProfileText(profile);

  return {
    id: fbUser.uid,
    email: fbUser.email ?? '',
    name: profile.name ?? fbUser.email?.split('@')[0] ?? '',
    age: profile.age ?? 0,
    major: profile.major ?? 'SE',
    campus: profile.campus ?? 'HCM',
    avatar: profile.avatar ?? '',
    bio: profile.bio ?? '',
    interests: profile.interests ?? [],
    personalityTags: profile.personalityTags ?? [],
    datingGoals: profile.datingGoals ?? [],
    preferredVibes: profile.preferredVibes ?? [],
    profileText,
    profileCompleteness: profile.profileCompleteness ?? 0,
    onboardingSource: profile.onboardingSource,
    aiSignals: profile.aiSignals,
  };
}

export const authService = {
  async login(credentials: { email: string; password: string }): Promise<User> {
    if (isMockMode()) {
      return enableMockMode();
    }

    if (!FPT_EMAIL_REGEX.test(credentials.email)) {
      throw new Error('Chỉ chấp nhận email FPT (@fpt.edu.vn)');
    }
    const result = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
    const profile = await authService.fetchProfile(result.user.uid);
    return toAppUser(result.user, profile ?? {});
  },

  async logout(): Promise<void> {
    if (isMockMode()) {
      disableMockMode();
      return;
    }

    await signOut(auth);
  },

  async getCurrentUser(): Promise<User | null> {
    if (isMockMode()) {
      return getMockUser();
    }

    const fbUser = auth.currentUser;
    if (!fbUser) return null;
    const profile = await authService.fetchProfile(fbUser.uid);
    return toAppUser(fbUser, profile ?? {});
  },

  async signup(
    credentials: { email: string; password: string },
    profile: Omit<UserProfile, 'id' | 'email' | 'createdAt'>
  ): Promise<User> {
    if (isMockMode()) {
      return enableMockMode();
    }

    if (!FPT_EMAIL_REGEX.test(credentials.email)) {
      throw new Error('Chỉ chấp nhận email FPT (@fpt.edu.vn)');
    }
    const result = await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
    const userDoc: Omit<UserProfile, 'id'> & { createdAt: unknown } = {
      email: credentials.email,
      name: profile.name,
      age: profile.age,
      major: profile.major,
      campus: profile.campus,
      avatar: profile.avatar,
      bio: profile.bio,
      interests: profile.interests,
      personalityTags: profile.personalityTags ?? [],
      datingGoals: profile.datingGoals ?? [],
      preferredVibes: profile.preferredVibes ?? [],
      profileText: normalizeProfileText(profile),
      profileCompleteness: profile.profileCompleteness ?? 0,
      onboardingSource: profile.onboardingSource ?? 'manual',
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'users', result.user.uid), userDoc);
    return toAppUser(result.user, profile);
  },

  async fetchProfile(uid: string): Promise<UserProfile | null> {
    if (isMockMode()) {
      return {
        ...MOCK_USER,
        id: uid,
        createdAt: new Date(),
      };
    }

    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: uid,
      email: data.email ?? '',
      name: data.name ?? '',
      age: data.age ?? 0,
      major: data.major ?? 'SE',
      campus: data.campus ?? 'HCM',
      avatar: data.avatar ?? '',
      bio: data.bio ?? '',
      interests: data.interests ?? [],
      personalityTags: data.personalityTags ?? [],
      datingGoals: data.datingGoals ?? [],
      preferredVibes: data.preferredVibes ?? [],
      profileText: normalizeProfileText({
        bio: data.bio ?? '',
        profileText: data.profileText as User['profileText'],
      }),
      profileCompleteness: data.profileCompleteness ?? 0,
      onboardingSource: data.onboardingSource,
      aiSignals: data.aiSignals
        ? {
            ...data.aiSignals,
            lastProcessedAt: data.aiSignals.lastProcessedAt?.toDate?.() ?? data.aiSignals.lastProcessedAt,
          }
        : undefined,
      createdAt: data.createdAt?.toDate?.() ?? new Date(),
    };
  },

  onAuthChanged(callback: (user: User | null) => void): () => void {
    if (isMockMode()) {
      callback(getMockUser());
      return () => {};
    }

    return onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        callback(null);
        return;
      }

      callback(toAppUser(fbUser, {
        name: fbUser.displayName ?? '',
        avatar: fbUser.photoURL ?? '',
        bio: '',
        interests: [],
      }));

      void (async () => {
        try {
          const profile = await authService.fetchProfile(fbUser.uid);
          callback(toAppUser(fbUser, profile ?? {}));
        } catch {
          // Firestore offline or error — still let user in with basic info
          callback(toAppUser(fbUser, {
            name: fbUser.displayName ?? '',
            avatar: fbUser.photoURL ?? '',
            bio: '',
            interests: [],
          }));
        }
      })();
    });
  },

  async loginWithGoogle(): Promise<User> {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const fbUser = result.user;

    const fallbackUser = toAppUser(fbUser, {
      name: fbUser.displayName ?? '',
      avatar: fbUser.photoURL ?? '',
      bio: '',
      interests: [],
    });

    // Keep login responsive; Firestore can be slow on mobile/Tailscale.
    void (async () => {
      try {
        const userRef = doc(db, 'users', fbUser.uid);
        const snap = await getDoc(userRef);
        await setDoc(userRef, {
          email: fbUser.email,
          name: fbUser.displayName ?? '',
          avatar: fbUser.photoURL ?? '',
          createdAt: snap.exists() ? snap.data().createdAt ?? serverTimestamp() : serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (error) {
        console.error('Failed to initialize Google profile', error);
      }
    })();

    return fallbackUser;
  },

  // kept for compatibility — no-ops since we use Firebase
  async loginMock(): Promise<User> {
    return enableMockMode();
  },

  clearUser(): void {
    disableMockMode();
  },
};
