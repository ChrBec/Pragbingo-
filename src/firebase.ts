import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  signInAnonymously,
  onAuthStateChanged,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithRedirect,
  signInWithCredential,
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";

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
// Inside the Capacitor app shell, the default in-memory/localStorage
// persistence doesn't reliably survive the WebView being torn down between
// app launches - indexedDBLocalPersistence is what the plugin's own docs
// recommend to keep people signed in across app restarts on Android/iOS.
export const auth = app
  ? Capacitor.isNativePlatform()
    ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
    : getAuth(app)
  : null;

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

// signInWithGoogle/signInWithApple set this in sessionStorage right before
// navigating away, so that on return we can tell "a redirect sign-in was in
// flight" apart from "nobody ever tried". sessionStorage survives the
// round-trip (it's tied to the tab, not affected by third-party storage
// blocking) even when Firebase's own redirect-result bookkeeping - which
// does rely on storage shared with the authDomain (…firebaseapp.com), a
// different origin than a GitHub Pages app - gets silently wiped by
// Safari/Chrome tracking protections. That silent loss is the single most
// common way Google/Apple sign-in "does the consent screen, then dumps you
// back at the picker with no error" on hosting setups like this one.
const PENDING_REDIRECT_KEY = "pragbingo_pending_oauth_redirect";

// Always processes any pending Google/Apple redirect result first (see
// signInWithGoogle/signInWithApple below) before deciding whether to fall
// back to an anonymous session - otherwise a redirect return could race
// with a fresh anonymous sign-in and silently discard the real login.
export function ensureAnonymousAuth(): Promise<void> {
  if (!auth) return Promise.resolve();
  if (authReadyPromise) return authReadyPromise;
  authReadyPromise = (async () => {
    let pendingProvider: string | null = null;
    try {
      pendingProvider = sessionStorage.getItem(PENDING_REDIRECT_KEY);
    } catch {
      // sessionStorage can throw in locked-down privacy modes - ignore
    }
    try {
      const result = await withTimeout(getRedirectResult(auth!), 10000, TIMEOUT_MESSAGE);
      if (pendingProvider && (!result || !result.user || result.user.isAnonymous)) {
        lastAuthError =
          "Die Anmeldung wurde nicht abgeschlossen: dein Browser hat die Rückkehr von Google/Apple offenbar blockiert oder die Sitzung dabei verworfen (z. B. Safari 'Cross-Website-Tracking verhindern' oder ein anderer Tracking-Schutz - das betrifft speziell diese Weiterleitung über eine andere Domain). Bitte nochmal versuchen, einen anderen Browser probieren, oder stattdessen mit E-Mail anmelden.";
      }
    } catch (e) {
      lastAuthError = describeAuthError(e);
    } finally {
      try {
        sessionStorage.removeItem(PENDING_REDIRECT_KEY);
      } catch {
        // ignore
      }
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
function markPendingRedirect(provider: string) {
  try {
    sessionStorage.setItem(PENDING_REDIRECT_KEY, provider);
  } catch {
    // ignore - worst case we just lose the extra diagnostic on return
  }
}

// Inside the Capacitor app shell (App Store/Play Store builds) there is no
// browser redirect at all: the native Google/Apple SDK signs the user in
// directly and hands back an ID token, which we then exchange for a
// Firebase credential. This sidesteps the whole cross-origin
// storage/cookie problem the web redirect flow has, since nothing ever
// navigates away from the app. auth.currentUser/onAuthStateChanged behave
// identically afterwards - the rest of the app never needs to know which
// path was used.
export async function signInWithGoogle() {
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await FirebaseAuthentication.signInWithGoogle();
      const idToken = result.credential?.idToken;
      if (!idToken) throw new Error("Google-Anmeldung fehlgeschlagen (kein Token erhalten).");
      const credential = GoogleAuthProvider.credential(idToken, result.credential?.accessToken);
      await signInWithCredential(requireAuth(), credential);
    } catch (e) {
      throw new Error(describeAuthError(e));
    }
    return;
  }
  const provider = new GoogleAuthProvider();
  markPendingRedirect("google");
  await signInWithRedirect(requireAuth(), provider);
}

export async function signInWithApple() {
  if (Capacitor.isNativePlatform()) {
    try {
      // skipNativeAuth: the plugin's own docs call this out as required for
      // Apple specifically - without it the native layer and the Firebase
      // JS SDK end up signed in as two different sessions.
      const result = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true });
      const idToken = result.credential?.idToken;
      if (!idToken) throw new Error("Apple-Anmeldung fehlgeschlagen (kein Token erhalten).");
      const provider = new OAuthProvider("apple.com");
      const credential = provider.credential({
        idToken,
        rawNonce: result.credential?.nonce,
      });
      await signInWithCredential(requireAuth(), credential);
    } catch (e) {
      throw new Error(describeAuthError(e));
    }
    return;
  }
  const provider = new OAuthProvider("apple.com");
  markPendingRedirect("apple");
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
  if (Capacitor.isNativePlatform()) {
    // Also clears the native Google/Apple SDK's cached account, otherwise
    // the next "Mit Google anmelden" silently reuses it without an account
    // picker instead of actually letting the person choose/re-authenticate.
    await FirebaseAuthentication.signOut().catch(() => {});
  }
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
