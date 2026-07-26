import { useEffect, useState } from "react";
import {
  deleteEntireEvent,
  deleteUserFromEvent,
  formatBytes,
  listAdminEvents,
  loadEventUsage,
  type AdminEventSummary,
  type AdminEventUsage,
} from "../../lib/admin";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("de-DE");
}

export function AdminDashboard() {
  const [events, setEvents] = useState<AdminEventSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminEventSummary | null>(null);
  const [usage, setUsage] = useState<AdminEventUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [busyPlayerId, setBusyPlayerId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refreshEvents = () => {
    setEvents(null);
    setLoadError(null);
    listAdminEvents()
      .then(setEvents)
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Laden fehlgeschlagen."));
  };

  useEffect(refreshEvents, []);

  const openEvent = (event: AdminEventSummary) => {
    setSelected(event);
    setUsage(null);
    setActionError(null);
    setUsageLoading(true);
    loadEventUsage(event)
      .then(setUsage)
      .catch((e) => setActionError(e instanceof Error ? e.message : "Laden fehlgeschlagen."))
      .finally(() => setUsageLoading(false));
  };

  const handleDeleteUser = async (playerId: string, authUid: string, name: string) => {
    if (!selected) return;
    if (
      !confirm(
        `Alle Daten von „${name}" in „${selected.name}" (${selected.code}) unwiderruflich löschen? Fotos, Punkte, Missionen, Stimmen - alles weg.`,
      )
    ) {
      return;
    }
    setBusyPlayerId(playerId);
    setActionError(null);
    try {
      await deleteUserFromEvent(selected.code, playerId, authUid);
      openEvent(selected);
      refreshEvents();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusyPlayerId(null);
    }
  };

  const handleDeleteEvent = async () => {
    if (!selected) return;
    if (
      !confirm(
        `Das komplette Event „${selected.name}" (${selected.code}) mit allen Teilnehmer:innen, Fotos und Punkten unwiderruflich löschen?`,
      )
    ) {
      return;
    }
    setBusyPlayerId("__event__");
    setActionError(null);
    try {
      await deleteEntireEvent(selected.code);
      setSelected(null);
      setUsage(null);
      refreshEvents();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusyPlayerId(null);
    }
  };

  if (loadError) {
    return <div className="error-box">{loadError}</div>;
  }

  if (!events) {
    return <p className="muted">Lädt…</p>;
  }

  return (
    <div>
      <h3 className="section-title">Events ({events.length})</h3>
      {events.length === 0 && <p className="muted">Noch keine Events angelegt.</p>}
      <div className="manage-list">
        {events.map((event) => (
          <div
            className="manage-row"
            key={event.code}
            style={{ cursor: "pointer" }}
            onClick={() => openEvent(event)}
          >
            <span>
              <strong>{event.name}</strong>{" "}
              <span className="muted">
                · {event.code} · Bräutigam {event.groomName} · {event.playerCount} Teilnehmer:innen
                · {formatDate(event.createdAt)}
              </span>
            </span>
            <button className="ghost-btn small" onClick={() => openEvent(event)}>
              Öffnen
            </button>
          </div>
        ))}
      </div>

      {selected && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="tab-header-row">
            <h3 className="section-title">
              {selected.name} ({selected.code})
            </h3>
            <button
              className="ghost-btn small danger"
              disabled={busyPlayerId === "__event__"}
              onClick={handleDeleteEvent}
            >
              {busyPlayerId === "__event__" ? "…" : "Ganzes Event löschen"}
            </button>
          </div>

          {actionError && <div className="error-box">{actionError}</div>}

          {usageLoading && <p className="muted">Speicherverbrauch wird berechnet…</p>}

          {usage && (
            <>
              <p className="hint">
                Gesamt: {formatBytes(usage.totalBytes)} in {usage.totalFiles} Datei(en)
              </p>
              <div className="manage-list">
                {usage.players.map((p) => (
                  <div className="manage-row" key={p.playerId}>
                    <span>
                      {p.name}
                      {p.isHost ? " 👑" : ""}
                      {!p.approved ? " (wartet)" : ""}
                      <br />
                      <span className="muted small">
                        {p.points} P · {p.fileCount} Datei(en) · {formatBytes(p.bytes)} ·
                        beigetreten {formatDate(p.joinedAt)}
                        <br />
                        UID: {p.authUid}
                      </span>
                    </span>
                    <button
                      className="ghost-btn small danger"
                      disabled={busyPlayerId === p.playerId}
                      onClick={() => handleDeleteUser(p.playerId, p.authUid, p.name)}
                    >
                      {busyPlayerId === p.playerId ? "…" : "Nutzerdaten löschen"}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
