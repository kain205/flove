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

export const FPT_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@fpt\.edu\.vn$/;

function toAppUser(fbUser: FirebaseUser, profile: Partial<UserProfile>): User {
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
      try {
        const profile = await authService.fetchProfile(fbUser.uid);
        callback(toAppUser(fbUser, profile ?? {}));
      } catch {
        // Firestore offline or error — still let user in with basic info
        callback(toAppUser(fbUser, {}));
      }
    });
  },

  async loginWithGoogle(): Promise<User> {
    const provider = new GoogleAuthProvider();
    // TODO: restrict to fpt.edu.vn when going live
    let result;
    try {
      result = await signInWithPopup(auth, provider);
    } catch (error) {
      if (
        error instanceof Error
        && (error.message.includes('auth/unauthorized-domain') || error.message.includes('unauthorized-domain'))
      ) {
        return enableMockMode();
      }
      throw error;
    }
    const fbUser = result.user;

    // Return immediately using Google's data — no waiting for Firestore
    const user = toAppUser(fbUser, {
      name: fbUser.displayName ?? '',
      avatar: fbUser.photoURL ?? '',
      bio: '',
      interests: [],
    });

    // Create/update Firestore doc in background
    const userRef = doc(db, 'users', fbUser.uid);
    getDoc(userRef).then((snap) => {
      if (!snap.exists()) {
        setDoc(userRef, {
          email: fbUser.email,
          name: fbUser.displayName ?? '',
          avatar: fbUser.photoURL ?? '',
          age: 0,
          major: 'SE',
          campus: 'HCM',
          bio: '',
          interests: [],
          createdAt: serverTimestamp(),
        });
      }
    });

    return user;
  },

  // kept for compatibility — no-ops since we use Firebase
  async loginMock(): Promise<User> {
    return enableMockMode();
  },

  saveUser(user: User): void {
    localStorage.setItem('flove-user', JSON.stringify(user));
  },
  clearUser(): void {
    disableMockMode();
  },
};
