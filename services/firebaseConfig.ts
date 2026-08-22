/**
 * Firebase initialization.
 *
 * ⚠️ SETUP REQUIRED: replace FIREBASE_CONFIG below with your real
 * project's config object (Firebase Console → Project settings →
 * your Web app), and GOOGLE_WEB_CLIENT_ID with the Web client ID that
 * appears once Google sign-in is enabled under Authentication →
 * Sign-in method → Google. Nothing here is secret — this config is
 * normal to ship inside a client app.
 *
 * PLATFORM NOTE: Firebase Auth's React-Native session persistence
 * (`getReactNativePersistence`) only exists in the RN build of
 * `firebase/auth`, not the web build. It's loaded with a runtime
 * `require()` inside a Platform.OS check — not a static `import` —
 * specifically so Metro's web bundle never has to resolve it. A
 * top-level `import` here would run on every platform regardless of
 * any later Platform check, since ES imports are hoisted; only a
 * runtime `require()` genuinely skips on web.
 */

import { Platform } from 'react-native';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth, initializeAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FIREBASE_CONFIG = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

/** Google OAuth Web Client ID, from Firebase Auth → Sign-in method → Google. */
export const GOOGLE_WEB_CLIENT_ID = 'YOUR_GOOGLE_WEB_CLIENT_ID';

/**
 * True only when real credentials have been filled in above.
 *
 * WHY THIS EXISTS: this module previously called `initializeApp()` at
 * import time regardless, and `app/_layout.tsx` starts the auth
 * listener at launch — so a build shipped with placeholder values
 * would initialize a Firebase app pointed at a project that does not
 * exist, then attach a listener to it. Nothing in the app can succeed
 * from there, and the failure surfaces as an opaque auth error rather
 * than anything a user could act on.
 *
 * With this flag, an unconfigured build simply has no cloud layer:
 * sign-in is hidden, sync calls become no-ops, and the app runs
 * exactly as the local-first design intends. Shipping v1 without
 * accounts is now a configuration state rather than a code removal.
 */
export const isFirebaseConfigured: boolean =
  !FIREBASE_CONFIG.apiKey.startsWith('YOUR_') &&
  !FIREBASE_CONFIG.projectId.startsWith('YOUR_') &&
  !FIREBASE_CONFIG.appId.startsWith('YOUR_');

/**
 * Firebase handles are null when unconfigured. Every consumer must
 * check `isFirebaseConfigured` (or null-check these) before use —
 * the sync layer and auth store already do.
 */
export const firebaseApp: FirebaseApp | null = isFirebaseConfigured
  ? getApps().length > 0
    ? getApp()
    : initializeApp(FIREBASE_CONFIG)
  : null;

function createAuth(): Auth | null {
  if (firebaseApp === null) return null;

  if (Platform.OS === 'web') {
    return getAuth(firebaseApp);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getReactNativePersistence } = require('firebase/auth');
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Fast Refresh can re-run this module and call initializeAuth twice,
    // which throws on the second call — fall back to the existing instance.
    return getAuth(firebaseApp);
  }
}

export const auth: Auth | null = createAuth();
export const db: Firestore | null = firebaseApp === null ? null : getFirestore(firebaseApp);
