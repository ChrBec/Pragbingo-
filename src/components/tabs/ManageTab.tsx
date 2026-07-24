import { useEvent } from "../../state/EventContext";

export function ManageTab() {
  const { event, players, currentPlayer, approvePlayer, removePlayer } = useEvent();

  if (!event || !currentPlayer) return null;

  if (currentPlayer.id !== event.hostPlayerId) {
    return (
      <div className="tab-screen">
        <h2>Verwalten ⚙️</h2>
        <p className="muted">Nur die Gastgeber:in kann hier Teilnehmer:innen verwalten.</p>
      </div>
    );
  }

  const pending = players.filter((p) => !p.approved);
  const approved = players
    .filter((p) => p.approved && p.id !== event.hostPlayerId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleReject = (name: string, playerId: string) => {
    if (confirm(`Beitrittsanfrage von „${name}" ablehnen?`)) {
      removePlayer(playerId);
    }
  };

  const handleRemove = (name: string, playerId: string) => {
    if (
      confirm(
        `„${name}" wirklich aus dem Event entfernen? Punkte und Fortschritt gehen verloren.`,
      )
    ) {
      removePlayer(playerId);
    }
  };

  return (
    <div className="tab-screen">
      <h2>Verwalten ⚙️</h2>
      <p className="muted">Beitrittsanfragen bestätigen und Teilnehmer:innen entfernen.</p>

      <h3 className="section-title">Beitrittsanfragen {pending.length > 0 ? `(${pending.length})` : ""}</h3>
      {pending.length === 0 && <p className="muted">Keine offenen Anfragen.</p>}
      <div className="manage-list">
        {pending.map((p) => (
          <div className="manage-row" key={p.id}>
            <span>
              {p.name}
              {p.isGroom ? " 🤵" : ""}
            </span>
            <div className="button-row">
              <button className="secondary-btn small" onClick={() => approvePlayer(p.id)}>
                Annehmen ✓
              </button>
              <button
                className="ghost-btn small danger"
                onClick={() => handleReject(p.name, p.id)}
              >
                Ablehnen ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <h3 className="section-title">Teilnehmer:innen ({approved.length})</h3>
      <div className="manage-list">
        {approved.map((p) => (
          <div className="manage-row" key={p.id}>
            <span>
              {p.name}
              {p.isGroom ? " 🤵" : ""}
              <span className="muted"> · {p.points} P</span>
            </span>
            <button
              className="ghost-btn small danger"
              onClick={() => handleRemove(p.name, p.id)}
            >
              Entfernen
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
