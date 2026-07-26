import { useState } from "react";
import { useEvent } from "../../state/EventContext";
import type { ChallengeDoc } from "../../types";

export function ChallengesTab() {
  const {
    event,
    players,
    challenges,
    currentPlayer,
    addChallenge,
    placeBid,
    forceStartChallenge,
    removeChallenge,
    reportChallengeOutcome,
  } = useEvent();
  const [showAdd, setShowAdd] = useState(false);
  const [newText, setNewText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bidDrafts, setBidDrafts] = useState<Record<string, number>>({});

  if (!event || !currentPlayer) return null;

  const isHost = currentPlayer.id === event.hostPlayerId;
  const approvedCount = players.filter((p) => p.approved).length;
  const bidding = challenges.filter((c) => c.status === "bidding");
  const assigned = challenges.filter((c) => c.status === "assigned");

  const handleAdd = async () => {
    if (!newText.trim()) return;
    setSubmitting(true);
    try {
      await addChallenge(newText.trim());
      setNewText("");
      setShowAdd(false);
    } finally {
      setSubmitting(false);
    }
  };

  const hasVoted = (c: ChallengeDoc) => c.votedPlayerIds.includes(currentPlayer.id);

  return (
    <div className="tab-screen">
      <div className="tab-header-row">
        <h2>Challenges 💰</h2>
        <button className="primary-btn small" onClick={() => setShowAdd(true)}>
          + Challenge
        </button>
      </div>
      <p className="muted">
        Schlag eine Challenge vor. Alle bieten verdeckt Prozentpunkte – wer am
        meisten bietet, muss die Challenge meistern und gewinnt (oder verliert)
        genau diese Punkte.
      </p>

      <h3 className="section-title">Laufende Abstimmungen</h3>
      {bidding.length === 0 && <p className="muted">Gerade keine offene Abstimmung.</p>}
      <div className="challenge-list">
        {bidding.map((c) => {
          const voted = hasVoted(c);
          const remaining = Math.max(0, approvedCount - c.votedPlayerIds.length);
          const draft = bidDrafts[c.id] ?? 50;
          return (
            <div className="challenge-card" key={c.id}>
              <div className="challenge-text">{c.text}</div>
              <div className="challenge-meta muted small">
                von {c.creatorName} · {c.votedPlayerIds.length}/{approvedCount} abgestimmt
                {remaining > 0 ? ` · noch ${remaining} nötig` : ""}
              </div>

              {voted ? (
                <div className="badge muted-badge">
                  ✓ Du hast geboten – Ergebnis folgt, sobald alle abgestimmt haben
                </div>
              ) : (
                <div className="bid-row">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={draft}
                    onChange={(e) =>
                      setBidDrafts((prev) => ({ ...prev, [c.id]: Number(e.target.value) }))
                    }
                  />
                  <span className="bid-value">{draft}%</span>
                  <button
                    className="primary-btn small"
                    onClick={() => placeBid(c.id, draft)}
                  >
                    Bieten
                  </button>
                </div>
              )}

              {isHost && (
                <div className="button-row">
                  <button
                    className="secondary-btn small"
                    disabled={c.votedPlayerIds.length === 0}
                    onClick={() => forceStartChallenge(c.id)}
                  >
                    Sofort starten
                  </button>
                  <button
                    className="ghost-btn small danger"
                    onClick={() => removeChallenge(c.id)}
                  >
                    Entfernen
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="section-title">Zugewiesene Challenges</h3>
      {assigned.length === 0 && <p className="muted">Noch keine zugewiesen.</p>}
      <div className="challenge-list">
        {assigned.map((c) => (
          <div className="challenge-card" key={c.id}>
            <div className="challenge-text">{c.text}</div>
            <div className="challenge-meta muted small">von {c.creatorName}</div>
            <div className="challenge-winners">
              {c.winners.map((w) => (
                <div className="challenge-winner-row" key={w.playerId}>
                  <span>
                    {w.playerName} · {w.bid}%
                  </span>
                  {w.outcome === "pending" && w.playerId === currentPlayer.id ? (
                    <div className="button-row">
                      <button
                        className="secondary-btn small"
                        onClick={() => reportChallengeOutcome(c.id, "done")}
                      >
                        Geschafft ✅
                      </button>
                      <button
                        className="ghost-btn small danger"
                        onClick={() => reportChallengeOutcome(c.id, "failed")}
                      >
                        Nicht geschafft ❌
                      </button>
                    </div>
                  ) : (
                    <span
                      className={
                        "badge " +
                        (w.outcome === "done"
                          ? "success"
                          : w.outcome === "failed"
                            ? "muted-badge"
                            : "muted-badge")
                      }
                    >
                      {w.outcome === "pending"
                        ? "wartet auf Ergebnis"
                        : w.outcome === "done"
                          ? "✓ geschafft"
                          : "✗ nicht geschafft"}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {isHost && (
              <div className="button-row">
                <button
                  className="ghost-btn small danger"
                  onClick={() => removeChallenge(c.id)}
                >
                  Entfernen
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Challenge vorschlagen</h3>
            <input
              className="caption-input"
              placeholder="z.B. Einen Fremden zum Tanzen bringen"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
            />
            <div className="modal-actions">
              <button className="ghost-btn" onClick={() => setShowAdd(false)}>
                Abbrechen
              </button>
              <button
                className="primary-btn"
                disabled={!newText.trim() || submitting}
                onClick={handleAdd}
              >
                {submitting ? "…" : "Starten 🚀"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
