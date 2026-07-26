import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthState } from "../state/AuthContext";
import { AuthPanel } from "../components/AuthPanel";

export function Login() {
  const { isAnonymous, displayLabel } = useAuthState();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAnonymous) {
      navigate("/", { replace: true });
    }
  }, [isAnonymous, navigate]);

  return (
    <div className="screen center-screen">
      <Link to="/" className="back-link">
        ← Zurück
      </Link>
      <div className="brand">
        <div className="brand-emoji">👤</div>
        <h1>Anmelden</h1>
        <p className="tagline">
          Mit einem echten Konto findest du deine Events später unter „Meine
          Events" wieder – ohne Passwort erneut einzugeben.
        </p>
      </div>
      {displayLabel && <p className="hint">Aktuell angemeldet als {displayLabel}.</p>}
      <AuthPanel />
    </div>
  );
}
