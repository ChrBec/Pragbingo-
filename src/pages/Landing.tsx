import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useEvent } from "../state/EventContext";
import { useAuthState } from "../state/AuthContext";
import { signOut } from "../firebase";

export function Landing() {
  const { rejoin, configured } = useEvent();
  const { isAnonymous, displayLabel } = useAuthState();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    rejoin().then((ok) => {
      setHasSession(ok);
      setChecking(false);
    });
  }, [rejoin]);

  return (
    <div className="screen center-screen">
      <div className="brand">
        <div className="brand-emoji">🥂</div>
        <h1>PragBingo</h1>
        <p className="tagline">Der JGA-Begleiter für Prag &amp; jede andere Stadt</p>
      </div>

      {!configured && (
        <div className="warning-box">
          Firebase ist noch nicht konfiguriert. Trage die Umgebungsvariablen aus
          der README ein, damit alle Handys synchron sind.
        </div>
      )}

      {!checking && hasSession && (
        <button className="primary-btn" onClick={() => navigate("/app")}>
          Weiter zu deinem Event →
        </button>
      )}

      <div className="landing-actions">
        <Link className="primary-btn" to="/create">
          🎉 Neues Event erstellen
        </Link>
        <Link className="secondary-btn" to="/join">
          🙋 Event beitreten
        </Link>
        <Link className="ghost-btn" to="/my-events">
          📋 Meine Events
        </Link>
      </div>

      <div className="account-badge">
        {isAnonymous ? (
          <Link to="/login">Anmelden</Link>
        ) : (
          <>
            <span>Angemeldet als {displayLabel}</span>
            <button onClick={() => signOut()}>Abmelden</button>
          </>
        )}
      </div>
    </div>
  );
}
