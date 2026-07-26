import { useEffect, useMemo, useState } from "react";
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

export function AdminEventsTab() {
  const [events, setEvents] = useState<AdminEventSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
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

  const filteredEvents = useMemo(() => {
    if (!events) return null;
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (e) => e.code.toLowerCase().includes(q) || e.name.toLowerCase().includes(q),
    );
  }, [events, search]);

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
      <label className="field">
        <span>Suche nach Event-Code oder -Name</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="z.B. AB3XZ"
        />
      </label>

      <h3 className="section-title">
        Events ({filteredEvents!.length}
        {filteredEvents!.length !== events.length ? ` von ${events.length}` : ""})
      </h3>
      {filteredEvents!.length === 0 && (
        <p className="muted">
          {events.length === 0 ? "Noch keine Events angelegt." : "Keine Treffer."}
        </p>
      )}
      <div className="manage-list">
        {filteredEvents!.map((event) => (
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
