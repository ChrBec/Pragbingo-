import { useEffect, useState } from "react";
import { useEvent } from "../../state/EventContext";
import { hangoverVoteKey } from "../../lib/session";

export function HangoverTab() {
  const { event, players, currentPlayer, setHangoverRating } = useEvent();
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (!event) return;
    setAlreadyVoted(localStorage.getItem(hangoverVoteKey(event.code)) === "1");
  }, [event]);

  if (!event || !currentPlayer) return null;

  const submit = async () => {
    if (selected == null) return;
    await setHangoverRating(selected);
    localStorage.setItem(hangoverVoteKey(event.code), "1");
    setAlreadyVoted(true);
  };

  const ratings = players
    .map((p) => p.hangoverRating)
    .filter((r): r is number => typeof r === "number");
  const average =
    ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : "–";
  const histogram = Array.from({ length: 10 }, (_, i) => i + 1).map((val) => ({
    val,
    count: ratings.filter((r) => r === val).length,
  }));
  const maxCount = Math.max(1, ...histogram.map((h) => h.count));

  return (
    <div className="tab-screen">
      <h2>Morgen-danach-Modus 🤕</h2>
      <p className="muted">Bewerte deinen Kater anonym von 1 (fit) bis 10 (Totalschaden).</p>

      {!alreadyVoted ? (
        <>
          <div className="hangover-scale">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                className={"hangover-btn" + (selected === n ? " active" : "")}
                onClick={() => setSelected(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <button className="primary-btn" disabled={selected == null} onClick={submit}>
            Anonym abschicken
          </button>
        </>
      ) : (
        <div className="badge success">Danke, deine Bewertung wurde anonym gezählt ✓</div>
      )}

      <h3 className="section-title">Gruppen-Ergebnis</h3>
      <div className="panel">
        <div className="report-row">
          <span>Durchschnitt</span>
          <strong>{average} / 10</strong>
        </div>
        <div className="hangover-histogram">
          {histogram.map((h) => (
            <div className="hangover-bar-col" key={h.val}>
              <div
                className="hangover-bar"
                style={{ height: `${(h.count / maxCount) * 80 + (h.count ? 6 : 0)}px` }}
              />
              <span className="muted small">{h.val}</span>
            </div>
          ))}
        </div>
        <p className="muted small">{ratings.length} von {players.length} haben abgestimmt.</p>
      </div>
    </div>
  );
}
