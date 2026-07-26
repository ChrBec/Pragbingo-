import { useState } from "react";
import { Link } from "react-router-dom";
import { signInAsAppAdmin, signOut } from "../firebase";
import { useAuthState } from "../state/AuthContext";
import { AdminDashboard } from "../components/admin/AdminDashboard";

export function AdminPage() {
  const { ready, isAppAdmin } = useAuthState();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready) return null;

  if (!isAppAdmin) {
    const handleSubmit = async () => {
      if (!password) return;
      setBusy(true);
      setError(null);
      try {
        await signInAsAppAdmin(password);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Anmeldung fehlgeschlagen.");
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="screen">
        <Link to="/" className="back-link">
          ← Zurück
        </Link>
        <h1>Admin-Bereich</h1>
        <p className="muted">Nur für die App-Verwaltung, nicht für Event-Gastgeber:innen.</p>
        <label className="field">
          <span>Benutzername</span>
          <input value="admin" disabled />
        </label>
        <label className="field">
          <span>Passwort</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
          />
        </label>
        {error && <div className="error-box">{error}</div>}
        <button
          className="primary-btn"
          disabled={busy || !password}
          onClick={handleSubmit}
        >
          {busy ? "…" : "Anmelden"}
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="tab-header-row">
        <h1>Admin-Dashboard</h1>
        <button className="ghost-btn small" onClick={() => signOut()}>
          Abmelden
        </button>
      </div>
      <AdminDashboard />
    </div>
  );
}
