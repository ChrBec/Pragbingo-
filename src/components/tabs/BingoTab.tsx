import { useEvent } from "../../state/EventContext";

export function BingoTab() {
  const { event, currentPlayer, toggleBingoCell } = useEvent();
  if (!event || !currentPlayer) return null;

  const marked = new Set(currentPlayer.bingoMarked);
  const linesDone = currentPlayer.bingoBonusAwarded.filter((k) => k !== "full").length;
  const fullDone = currentPlayer.bingoBonusAwarded.includes("full");

  return (
    <div className="tab-screen">
      <h2>JGA-Bingo 🎯</h2>
      <p className="muted">
        Tippe ein Feld an, sobald ihr es live erlebt. Reihen, Spalten &amp; Diagonalen
        bringen Bonuspunkte.
      </p>
      <div className="bingo-stats">
        <span>Reihen geschafft: {linesDone}</span>
        {fullDone && <span className="badge success">🏆 Volles Board!</span>}
      </div>

      <div className="bingo-grid">
        {currentPlayer.bingoOrder.map((taskIndex, cell) => {
          const isMarked = marked.has(cell);
          return (
            <button
              key={cell}
              className={"bingo-cell" + (isMarked ? " marked" : "")}
              onClick={() => toggleBingoCell(cell)}
            >
              {event.bingoTasks[taskIndex]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
