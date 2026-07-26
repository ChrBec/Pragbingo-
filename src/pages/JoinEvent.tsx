import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useEvent } from "../state/EventContext";
import { useAuthState } from "../state/AuthContext";

export function JoinEvent() {
  const { joinEvent } = useEvent();
  const { isAnonymous } = useAuthState();
  const navigate = useNavigate();
  const params = useParams();

  const [code, setCode] = useState(params.code?.toUpperCase() ?? "");
  const [playerName, setPlayerName] = useState("");
  const [password, setPassword] = useState("");
  const [isGroom, setIsGroom] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    code.trim().length >= 4 &&
    playerName.trim().length >= 2 &&
    password.trim().length >= 4;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await joinEvent(code.trim(), playerName.trim(), isGroom, password.trim());
      navigate("/app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beitritt fehlgeschlagen.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="screen center-screen">
      <Link to="/" className="back-link">
        ← Zurück
      </Link>
      <h1>Event beitreten</h1>
      <p className="muted">
        Frag die Gastgeber:in nach Event-Code und Event-Passwort und gib
        deinen Namen ein.
      </p>

      <label className="field">
        <span>Event-Code</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="z.B. AB3XZ"
          maxLength={8}
          className="code-input"
        />
      </label>
      <label className="field">
        <span>Dein Name</span>
        <input
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="z.B. Julia"
        />
      </label>
      <label className="field">
        <span>Event-Passwort</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Von der Gastgeber:in bekommen"
        />
      </label>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={isGroom}
          onChange={(e) => setIsGroom(e.target.checked)}
        />
        <span>Ich bin der Bräutigam 🤵</span>
      </label>

      {isAnonymous ? (
        <p className="hint">
          Du trittst gerade anonym bei. Auf diesem Gerät bleibt dein
          Fortschritt erhalten, solange du die App nicht zurücksetzt. Möchtest
          du auch von anderen Geräten aus zurück ins Event, ohne das Passwort
          erneut einzugeben? <Link to="/login">Vorher anmelden</Link>.
        </p>
      ) : (
        <p className="hint">
          Du bist angemeldet – dieses Event erscheint danach automatisch unter
          „Meine Events".
        </p>
      )}

      {error && <div className="error-box">{error}</div>}

      <button
        className="primary-btn"
        disabled={!canSubmit || submitting}
        onClick={handleSubmit}
      >
        {submitting ? "Trete bei…" : "Beitreten 🙌"}
      </button>
    </div>
  );
}
