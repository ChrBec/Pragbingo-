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

// Fixed identity for the single app-wide admin account. Firestore rules
// grant admin access by checking request.auth.token.email against this
// exact address - it never needs to be a real inbox.
export const ADMIN_EMAIL = "app-admin@pragbingo.internal";

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

// Firebase's underlying network calls have no built-in client-side timeout:
// if a request gets silently dropped (blocked script, dead connection, a
// hung reCAPTCHA challenge for the email/password abuse-protection check)
// the returned promise can simply never settle, leaving a button stuck on
// "…" forever with no error to show. Race everything auth-related against
// our own timeout so a failure is always visible.
function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

const TIMEOUT_MESSAGE =
  "Zeitüberschreitung – Firebase hat nicht geantwortet. Prüfe deine Internetverbindung und ob chrbec.github.io in Firebase unter Authentication → Settings → Authorized domains eingetragen ist, dann nochmal versuchen.";

// Always processes any pending Google/Apple redirect result first (see
// signInWithGoogle/signInWithApple below) before deciding whether to fall
// back to an anonymous session - otherwise a redirect return could race
// with a fresh anonymous sign-in and silently discard the real login.
export function ensureAnonymousAuth(): Promise<void> {
  if (!auth) return Promise.resolve();
  if (authReadyPromise) return authReadyPromise;
  authReadyPromise = (async () => {
    try {
      await withTimeout(getRedirectResult(auth!), 10000, TIMEOUT_MESSAGE);
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
    const cred = await withTimeout(
      createUserWithEmailAndPassword(requireAuth(), email, password),
      15000,
      TIMEOUT_MESSAGE,
    );
    if (displayName.trim()) {
      await withTimeout(
        updateProfile(cred.user, { displayName: displayName.trim() }),
        15000,
        TIMEOUT_MESSAGE,
      );
    }
  } catch (e) {
    throw new Error(describeAuthError(e));
  }
}

export async function signInWithEmail(email: string, password: string) {
  try {
    await withTimeout(
      signInWithEmailAndPassword(requireAuth(), email, password),
      15000,
      TIMEOUT_MESSAGE,
    );
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

// Self-bootstrapping admin login: "admin" / "manage". The first successful
// login with the exact bootstrap password creates the fixed admin account
// (nobody else can grab that email afterwards - Firebase enforces unique
// emails), every later login is a normal sign-in against it.
export async function signInAsAppAdmin(password: string): Promise<void> {
  const authInstance = requireAuth();
  try {
    await withTimeout(
      signInWithEmailAndPassword(authInstance, ADMIN_EMAIL, password),
      15000,
      TIMEOUT_MESSAGE,
    );
    return;
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
    const accountMightNotExistYet =
      code === "auth/user-not-found" || code === "auth/invalid-credential";
    if (accountMightNotExistYet && password === "manage") {
      try {
        await withTimeout(
          createUserWithEmailAndPassword(authInstance, ADMIN_EMAIL, password),
          15000,
          TIMEOUT_MESSAGE,
        );
        return;
      } catch (signupError) {
        throw new Error(describeAuthError(signupError));
      }
    }
    if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
      throw new Error("Falsches Admin-Passwort.");
    }
    throw new Error(describeAuthError(e));
  }
}

export function isAppAdminUser(user: { email?: string | null } | null | undefined): boolean {
  return !!user && user.email === ADMIN_EMAIL;
}
