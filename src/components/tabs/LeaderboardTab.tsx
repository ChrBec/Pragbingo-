import { useState } from "react";
import { useEvent } from "../../state/EventContext";
import { POINTS } from "../../data/defaults";

const MEDALS = ["🥇", "🥈", "🥉"];

export function LeaderboardTab() {
  const { event, players, awardPoints, tagMoment, currentPlayer } = useEvent();
  const [tagTarget, setTagTarget] = useState("");
  const [pointsTarget, setPointsTarget] = useState("");

  if (!event) return null;

  const ranked = [...players].sort((a, b) => b.points - a.points);

  return (
    <div className="tab-screen">
      <h2>Live-Rangliste 🏆</h2>
      <p className="muted">Punkte aus Missionen, Bingo, Chaos-Knopf und Bonus/Strafe.</p>

      <div className="leaderboard-list">
        {ranked.map((p, i) => (
          <div
            className={"leaderboard-row" + (p.id === currentPlayer?.id ? " me" : "")}
            key={p.id}
          >
            <span className="leaderboard-rank">{MEDALS[i] ?? `${i + 1}.`}</span>
            <span className="leaderboard-name">
              {p.name}
              {p.isGroom ? " 🤵" : ""}
            </span>
            <span className="leaderboard-points">{p.points} P</span>
          </div>
        ))}
      </div>

      <div className="panel">
        <h3>Bonus &amp; Strafpunkte vergeben</h3>
        <select value={pointsTarget} onChange={(e) => setPointsTarget(e.target.value)}>
          <option value="">Person wählen…</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="button-row">
          <button
            className="secondary-btn small"
            disabled={!pointsTarget}
            onClick={() =>
              awardPoints(pointsTarget, POINTS.bonusDefault, "Bonuspunkte", "bonus")
            }
          >
            +{POINTS.bonusDefault} Bonus
          </button>
          <button
            className="ghost-btn small danger"
            disabled={!pointsTarget}
            onClick={() =>
              awardPoints(pointsTarget, -POINTS.penaltyDefault, "Strafpunkte", "penalty")
            }
          >
            -{POINTS.penaltyDefault} Strafe
          </button>
        </div>
      </div>

      <div className="panel">
        <h3>Moment markieren</h3>
        <p className="muted small">Fließt in den Abschlussbericht ein (z.B. „häufigster Zuspätkommer“).</p>
        <select value={tagTarget} onChange={(e) => setTagTarget(e.target.value)}>
          <option value="">Person wählen…</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="tag-chip-row">
          {event.momentTags.map((tag) => (
            <button
              key={tag}
              className="chip-btn"
              disabled={!tagTarget}
              onClick={() => tagMoment(tag, tagTarget)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
