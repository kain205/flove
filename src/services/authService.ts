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
import { appUserFromFirebase, userProfileFromFirestore } from './firestoreMappers';

export const FPT_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@fpt\.edu\.vn$/;

type AuthChangedStatus = 'checking' | 'guest' | 'authenticated' | 'profileHydrating';

function basicFirebaseProfile(fbUser: FirebaseUser): Partial<UserProfile> {
  return {
    name: fbUser.displayName ?? '',
    avatar: fbUser.photoURL ?? '',
    bio: '',
    interests: [],
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
    return appUserFromFirebase(result.user, profile ?? {});
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
    return appUserFromFirebase(fbUser, profile ?? {});
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
    return appUserFromFirebase(result.user, profile);
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
    return userProfileFromFirestore(uid, snap.data());
  },

  onAuthChanged(callback: (user: User | null, status?: AuthChangedStatus) => void): () => void {
    if (isMockMode()) {
      callback(getMockUser(), 'authenticated');
      return () => {};
    }

    return onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        callback(null, 'guest');
        return;
      }

      const basicUser = appUserFromFirebase(fbUser, basicFirebaseProfile(fbUser));
      callback(basicUser, 'profileHydrating');

      void (async () => {
        try {
          const profile = await authService.fetchProfile(fbUser.uid);
          callback(appUserFromFirebase(fbUser, profile ?? {}), 'authenticated');
        } catch {
          // Firestore offline or error — still let user in with basic info
          callback(basicUser, 'authenticated');
        }
      })();
    });
  },

  async loginWithGoogle(): Promise<User> {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const fbUser = result.user;

    const fallbackUser = appUserFromFirebase(fbUser, basicFirebaseProfile(fbUser));

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
