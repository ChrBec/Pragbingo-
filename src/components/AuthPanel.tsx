import { useState } from "react";
import {
  signInWithGoogle,
  signInWithApple,
  signInWithEmail,
  signUpWithEmail,
} from "../firebase";

export function AuthPanel() {
  const [mode, setMode] = useState<"choose" | "email-signup" | "email-signin">("choose");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  if (mode === "choose") {
    return (
      <div className="auth-panel">
        <button
          className="secondary-btn"
          disabled={busy}
          onClick={() => withBusy(signInWithGoogle)}
        >
          🔵 Mit Google anmelden
        </button>
        <button
          className="secondary-btn"
          disabled={busy}
          onClick={() => withBusy(signInWithApple)}
        >
           Mit Apple anmelden
        </button>
        <button className="ghost-btn" onClick={() => setMode("email-signin")}>
          ✉️ Mit E-Mail anmelden
        </button>
        <button className="ghost-btn" onClick={() => setMode("email-signup")}>
          ✉️ Neues Konto per E-Mail erstellen
        </button>
        {error && <div className="error-box">{error}</div>}
      </div>
    );
  }

  const isSignup = mode === "email-signup";

  return (
    <div className="auth-panel">
      <button type="button" className="back-link" onClick={() => setMode("choose")}>
        ← Andere Anmeldeoption
      </button>
      {isSignup && (
        <label className="field">
          <span>Dein Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      )}
      <label className="field">
        <span>E-Mail</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Passwort {isSignup ? "(neu vergeben, mind. 6 Zeichen)" : ""}</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <div className="error-box">{error}</div>}
      <button
        className="primary-btn"
        disabled={busy || !email.trim() || password.length < 6 || (isSignup && !name.trim())}
        onClick={() =>
          withBusy(() =>
            isSignup
              ? signUpWithEmail(email.trim(), password, name.trim())
              : signInWithEmail(email.trim(), password),
          )
        }
      >
        {busy ? "…" : isSignup ? "Konto erstellen" : "Anmelden"}
      </button>
    </div>
  );
}
