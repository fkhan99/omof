import { create } from 'zustand';
import { Platform } from 'react-native';
import { User as FirebaseUser } from 'firebase/auth';
import { User } from '@/types';
import { clearProfileCache, writeProfileCache } from '@/utils/profileCache';

export interface SignupCompliance {
  acceptedTerms: boolean;
  confirmedAge: boolean;
}

interface AuthState {
  firebaseUser: FirebaseUser | null;
  profile: User | null;
  pendingSignupCompliance: SignupCompliance | null;
  pendingSignupFullName: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  /** True while the Firestore profile read is in flight. */
  isProfileLoading: boolean;
  /** True once the profile read finished (found, missing, or failed with cache). */
  profileLoadComplete: boolean;
  /**
   * True when the most recent profile load failed (error/timeout) rather than
   * the profile genuinely not existing. Used to avoid misrouting an existing
   * user to onboarding on a transient failure.
   */
  profileError: boolean;
  /** Set when a brand-new profile is created; drives the one-time welcome modal. */
  pendingWelcome: boolean;
  setFirebaseUser: (user: FirebaseUser | null) => void;
  setProfile: (profile: User | null) => void;
  setProfileError: (hasError: boolean) => void;
  setPendingWelcome: (pendingWelcome: boolean) => void;
  setPendingSignupCompliance: (compliance: SignupCompliance | null) => void;
  setPendingSignupFullName: (fullName: string | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  setProfileLoading: (loading: boolean) => void;
  setProfileLoadComplete: (complete: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  profile: null,
  pendingSignupCompliance: null,
  pendingSignupFullName: null,
  isLoading: true,
  isInitialized: false,
  isProfileLoading: false,
  profileLoadComplete: false,
  profileError: false,
  pendingWelcome: false,
  setFirebaseUser: (firebaseUser) => set({ firebaseUser }),
  setProfile: (profile) => {
    if (Platform.OS === 'web') {
      if (profile) writeProfileCache(profile.id, profile);
      else clearProfileCache();
    }
    set({ profile, profileError: false });
  },
  setProfileError: (profileError) => set({ profileError }),
  setPendingWelcome: (pendingWelcome) => set({ pendingWelcome }),
  setPendingSignupCompliance: (pendingSignupCompliance) => set({ pendingSignupCompliance }),
  setPendingSignupFullName: (pendingSignupFullName) => set({ pendingSignupFullName }),
  setLoading: (isLoading) => set({ isLoading }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  setProfileLoading: (isProfileLoading) => set({ isProfileLoading }),
  setProfileLoadComplete: (profileLoadComplete) => set({ profileLoadComplete }),
  reset: () => {
    clearProfileCache();
    set({
      firebaseUser: null,
      profile: null,
      pendingSignupCompliance: null,
      pendingSignupFullName: null,
      isLoading: false,
      isInitialized: true,
      isProfileLoading: false,
      profileLoadComplete: false,
      profileError: false,
      pendingWelcome: false,
    });
  },
}));
