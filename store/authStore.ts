import { create } from 'zustand';
import { User as FirebaseUser } from 'firebase/auth';
import { User } from '@/types';

export interface SignupCompliance {
  acceptedTerms: boolean;
  confirmedAge: boolean;
}

interface AuthState {
  firebaseUser: FirebaseUser | null;
  profile: User | null;
  pendingSignupCompliance: SignupCompliance | null;
  isLoading: boolean;
  isInitialized: boolean;
  setFirebaseUser: (user: FirebaseUser | null) => void;
  setProfile: (profile: User | null) => void;
  setPendingSignupCompliance: (compliance: SignupCompliance | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  profile: null,
  pendingSignupCompliance: null,
  isLoading: true,
  isInitialized: false,
  setFirebaseUser: (firebaseUser) => set({ firebaseUser }),
  setProfile: (profile) => set({ profile }),
  setPendingSignupCompliance: (pendingSignupCompliance) => set({ pendingSignupCompliance }),
  setLoading: (isLoading) => set({ isLoading }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  reset: () =>
    set({
      firebaseUser: null,
      profile: null,
      pendingSignupCompliance: null,
      isLoading: false,
      isInitialized: true,
    }),
}));
