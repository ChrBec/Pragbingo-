import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, ensureAnonymousAuth } from "../firebase";

interface AuthContextValue {
  ready: boolean;
  user: User | null;
  isAnonymous: boolean;
  displayLabel: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    ensureAnonymousAuth().finally(() => setReady(true));
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  const isAnonymous = !user || user.isAnonymous;
  const displayLabel = user && !user.isAnonymous ? user.displayName || user.email || "Konto" : null;

  const value: AuthContextValue = { ready, user, isAnonymous, displayLabel };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthState(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthState must be used within AuthProvider");
  return ctx;
}
