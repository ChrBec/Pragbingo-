import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId,
);

export const app = isFirebaseConfigured
  ? getApps().length
    ? getApps()[0]!
    : initializeApp(firebaseConfig)
  : null;

export const db = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app) : null;
export const auth = app ? getAuth(app) : null;

let authReadyPromise: Promise<void> | null = null;
let lastAuthError: string | null = null;

export function getLastAuthError(): string | null {
  return lastAuthError;
}

// Always processes any pending Google/Apple redirect result first (see
// signInWithGoogle/signInWithApple below) before deciding whether to fall
// back to an anonymous session - otherwise a redirect return could race
// with a fresh anonymous sign-in and silently discard the real login.
export function ensureAnonymousAuth(): Promise<void> {
  if (!auth) return Promise.resolve();
  if (authReadyPromise) return authReadyPromise;
  authReadyPromise = (async () => {
    try {
      await getRedirectResult(auth!);
    } catch (e) {
      lastAuthError = describeAuthError(e);
    }
    await new Promise<void>((resolve) => {
      const unsub = onAuthStateChanged(auth!, (user) => {
        if (user) {
          unsub();
          resolve();
        } else {
          signInAnonymously(auth!).catch(() => resolve());
        }
      });
    });
  })();
  return authReadyPromise;
}

function requireAuth() {
  if (!auth) throw new Error("Firebase ist nicht konfiguriert.");
  return auth;
}

// Mobile browsers routinely block or silently kill popup-based OAuth
// (third-party cookie restrictions, popup blockers, in-app browsers) - a
// full-page redirect is the flow Firebase itself recommends for mobile web.
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  await signInWithRedirect(requireAuth(), provider);
}

export async function signInWithApple() {
  const provider = new OAuthProvider("apple.com");
  await signInWithRedirect(requireAuth(), provider);
}

function describeAuthError(e: unknown): string {
  const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
  switch (code) {
    case "auth/unauthorized-domain":
      return "Diese Website-Adresse ist in Firebase noch nicht als 'Authorized domain' freigegeben (Authentication → Settings → Authorized domains).";
    case "auth/account-exists-with-different-credential":
      return "Für diese E-Mail existiert bereits ein Konto mit einer anderen Anmeldemethode.";
    case "auth/operation-not-allowed":
      return "Dieser Anmelde-Anbieter ist in Firebase noch nicht aktiviert (Authentication → Sign-in method).";
    case "auth/popup-blocked":
    case "auth/cancelled-popup-request":
      return "Anmeldung wurde vom Browser blockiert oder abgebrochen.";
    default:
      return e instanceof Error ? e.message : "Anmeldung fehlgeschlagen.";
  }
}

export async function signUpWithEmail(email: string, password: string, displayName: string) {
  try {
    const cred = await createUserWithEmailAndPassword(requireAuth(), email, password);
    if (displayName.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    }
  } catch (e) {
    throw new Error(describeAuthError(e));
  }
}

export async function signInWithEmail(email: string, password: string) {
  try {
    await signInWithEmailAndPassword(requireAuth(), email, password);
  } catch (e) {
    throw new Error(describeAuthError(e));
  }
}

export async function signOut() {
  if (!auth) return;
  await firebaseSignOut(auth);
  authReadyPromise = null;
  await ensureAnonymousAuth();
}
