import { useState } from "react";
import { useEvent } from "../../state/EventContext";
import { MediaCaptureInput } from "../MediaCaptureInput";
import type { PlayerMission } from "../../types";

export function MissionsTab() {
  const { currentPlayer, completeMission, skipMission } = useEvent();
  const [activeMission, setActiveMission] = useState<PlayerMission | null>(null);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!currentPlayer) return null;

  const openProof = (mission: PlayerMission) => {
    setActiveMission(mission);
    setCaption("");
    setFile(null);
  };

  const submitProof = async () => {
    if (!activeMission || !file) return;
    setSubmitting(true);
    try {
      await completeMission(activeMission.id, file, caption);
      setActiveMission(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="tab-screen">
      <h2>Deine geheimen Missionen 🕵️</h2>
      <p className="muted">Nur du siehst diese Aufgaben. Beweisfoto hochladen bringt Punkte.</p>

      {currentPlayer.isGroom && (
        <div className="joker-banner">
          Bräutigam-Joker übrig: <strong>{currentPlayer.jokersLeft}</strong> / 3
        </div>
      )}

      <div className="mission-list">
        {currentPlayer.missions.map((m) => (
          <div key={m.id} className={`mission-card status-${m.status}`}>
            <div className="mission-text">{m.text}</div>
            <div className="mission-actions">
              {m.status === "open" && (
                <>
                  <button className="primary-btn small" onClick={() => openProof(m)}>
                    Beweis hochladen
                  </button>
                  {currentPlayer.isGroom && currentPlayer.jokersLeft > 0 && (
                    <button
                      className="ghost-btn small"
                      onClick={() => skipMission(m.id)}
                    >
                      🃏 Joker einsetzen
                    </button>
                  )}
                </>
              )}
              {m.status === "done" && <span className="badge success">✓ Erledigt</span>}
              {m.status === "skipped" && <span className="badge muted-badge">Weitergegeben</span>}
            </div>
          </div>
        ))}
      </div>

      {activeMission && (
        <div className="modal-overlay" onClick={() => setActiveMission(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Beweis hochladen</h3>
            <p className="muted">{activeMission.text}</p>
            <MediaCaptureInput file={file} onChange={setFile} />
            <input
              className="caption-input"
              placeholder="Kurzer Kommentar (optional)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
            <div className="modal-actions">
              <button className="ghost-btn" onClick={() => setActiveMission(null)}>
                Abbrechen
              </button>
              <button
                className="primary-btn"
                disabled={!file || submitting}
                onClick={submitProof}
              >
                {submitting ? "Lädt hoch…" : "Absenden 🚀"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
