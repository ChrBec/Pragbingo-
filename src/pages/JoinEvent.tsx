import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useEvent } from "../state/EventContext";

export function JoinEvent() {
  const { joinEvent } = useEvent();
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
      <p className="muted">Gib den Code vom Gastgeber ein und leg los.</p>

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
        <span>Passwort (mind. 4 Zeichen)</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Neu vergeben oder vorhandenes eingeben"
        />
      </label>
      <p className="hint">
        Beim ersten Beitritt legst du mit diesem Namen + Passwort dein Profil
        an. Schließt du die App oder wechselst das Handy, meldest du dich mit
        genau demselben Namen + Passwort wieder an – dein Fortschritt bleibt
        erhalten.
      </p>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={isGroom}
          onChange={(e) => setIsGroom(e.target.checked)}
        />
        <span>Ich bin der Bräutigam 🤵</span>
      </label>

      {error && <div className="error-box">{error}</div>}

      <button
        className="primary-btn"
        disabled={!canSubmit || submitting}
        onClick={handleSubmit}
      >
        {submitting ? "Trete bei…" : "Beitreten / Anmelden 🙌"}
      </button>
    </div>
  );
}
