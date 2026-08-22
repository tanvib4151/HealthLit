/**
 * Auth store (Zustand).
 *
 * Firebase Auth is entirely optional to this app — signing in only
 * enables backup/sync (see services/syncService.ts). Every screen
 * must keep working fully offline whether or not `user` is set.
 *
 * Google sign-in's token exchange happens in the UI layer (it needs
 * expo-auth-session's React hook), which then calls
 * `signInWithGoogleIdToken` here with the resulting id token.
 */

import { create } from 'zustand';
import {
  User,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  deleteUser,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';

import { auth, isFirebaseConfigured } from '../services/firebaseConfig';
import { deleteAllCloudData } from '../services/syncService';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

function toAuthUser(user: User): AuthUser {
  return { uid: user.uid, email: user.email, displayName: user.displayName };
}

interface AuthStoreState {
  user: AuthUser | null;
  /** True until the initial session check completes. */
  authChecked: boolean;
  isBusy: boolean;
  error: string | null;
  /** Wires Firebase's session listener. Call once, at app launch. */
  initAuthListener: () => () => void;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signUpWithEmail: (email: string, password: string) => Promise<boolean>;
  /**
   * Permanently deletes the cloud account and everything in it.
   * Required by App Store Guideline 5.1.1(v) for any app offering
   * account creation, and promised by the privacy policy.
   *
   * Returns a result rather than a boolean so the UI can distinguish
   * "failed" from "needs you to sign in again first" — Firebase
   * refuses account deletion on a stale session, and a generic error
   * there leaves people stuck with no idea what to do.
   */
  deleteAccount: () => Promise<'ok' | 'needs-recent-login' | 'failed'>;
  signInWithGoogleIdToken: (idToken: string) => Promise<boolean>;
  signOutUser: () => Promise<void>;
  clearError: () => void;
}

/** Turns Firebase's error codes into calm, plain-language messages. */
function friendlyAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address doesn\u2019t look right.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email or password is incorrect.';
    case 'auth/email-already-in-use':
      return 'An account already exists with that email.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/network-request-failed':
      return 'Network error \u2014 check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  user: null,
  authChecked: false,
  isBusy: false,
  error: null,

  initAuthListener: () => {
    // Unconfigured builds have no cloud layer at all. Report the auth
    // check as complete so nothing downstream waits forever on a
    // listener that will never fire.
    if (auth === null) {
      set({ user: null, authChecked: true });
      return () => undefined;
    }

    return onAuthStateChanged(auth, (firebaseUser) => {
      set({
        user: firebaseUser ? toAuthUser(firebaseUser) : null,
        authChecked: true,
      });
    });
  },

  signInWithEmail: async (email, password) => {
    set({ isBusy: true, error: null });
    if (auth === null) {
      set({ isBusy: false, error: 'Sync is not available in this build.' });
      return false;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      set({ isBusy: false });
      return true;
    } catch (error) {
      set({ isBusy: false, error: friendlyAuthError(error) });
      return false;
    }
  },

  deleteAccount: async () => {
    const current = auth?.currentUser;
    if (auth === null || !current) return 'failed';

    set({ isBusy: true, error: null });

    // Cloud data FIRST. Deleting the auth account first would leave
    // the documents orphaned and permanently unreachable — the rules
    // key on a uid that would no longer exist, so not even the person
    // who owns them could ever delete them again.
    const dataDeleted = await deleteAllCloudData();
    if (!dataDeleted) {
      set({ isBusy: false, error: 'Could not delete your cloud data. Please try again.' });
      return 'failed';
    }

    try {
      await deleteUser(current);
      set({ isBusy: false, user: null });
      return 'ok';
    } catch (error) {
      set({ isBusy: false });
      const code = (error as { code?: string }).code;
      if (code === 'auth/requires-recent-login') {
        set({ error: 'For security, please sign in again before deleting your account.' });
        return 'needs-recent-login';
      }
      set({ error: 'Could not delete your account. Please try again.' });
      return 'failed';
    }
  },

  signUpWithEmail: async (email, password) => {
    set({ isBusy: true, error: null });
    if (auth === null) {
      set({ isBusy: false, error: 'Sync is not available in this build.' });
      return false;
    }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      set({ isBusy: false });
      return true;
    } catch (error) {
      set({ isBusy: false, error: friendlyAuthError(error) });
      return false;
    }
  },

  signInWithGoogleIdToken: async (idToken) => {
    set({ isBusy: true, error: null });
    if (auth === null) {
      set({ isBusy: false, error: 'Sync is not available in this build.' });
      return false;
    }
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
      set({ isBusy: false });
      return true;
    } catch (error) {
      set({ isBusy: false, error: friendlyAuthError(error) });
      return false;
    }
  },

  signOutUser: async () => {
    await firebaseSignOut(auth);
  },

  clearError: () => set({ error: null }),
}));
