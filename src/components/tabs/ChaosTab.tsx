import { useState } from "react";
import { useEvent } from "../../state/EventContext";
import type { ChaosEntry } from "../../types";

export function ChaosTab() {
  const { chaos, spinChaos, markChaosDone, players } = useEvent();
  const [spinning, setSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<ChaosEntry | null>(null);

  const handleSpin = async () => {
    setSpinning(true);
    try {
      const result = await spinChaos();
      setLastResult(result);
    } finally {
      setSpinning(false);
    }
  };

  return (
    <div className="tab-screen">
      <h2>Chaos-Knopf 🎲</h2>
      <p className="muted">
        Lost eine Person und eine spontane Aufgabe aus. Erledigt bringt Bonuspunkte.
      </p>

      <button
        className="chaos-button"
        onClick={handleSpin}
        disabled={spinning || players.length === 0}
      >
        {spinning ? "…" : "🎲 CHAOS AUSLÖSEN"}
      </button>

      {lastResult && (
        <div className="chaos-result">
          <strong>{lastResult.targetName}</strong> muss:
          <p>{lastResult.task}</p>
        </div>
      )}

      <h3 className="section-title">Verlauf</h3>
      <div className="chaos-history">
        {chaos.length === 0 && <p className="muted">Noch nichts passiert.</p>}
        {chaos.map((c) => (
          <div className={"chaos-history-row" + (c.done ? " done" : "")} key={c.id}>
            <div>
              <strong>{c.targetName}</strong>
              <p>{c.task}</p>
            </div>
            {!c.done ? (
              <button className="secondary-btn small" onClick={() => markChaosDone(c.id)}>
                Erledigt ✓
              </button>
            ) : (
              <span className="badge success">✓</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
