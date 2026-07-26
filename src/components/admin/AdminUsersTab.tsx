import { useEffect, useMemo, useState } from "react";
import {
  deleteUserEverywhere,
  listAllAdminUsers,
  updatePlayerInEvent,
  type AdminUserSummary,
} from "../../lib/admin";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("de-DE");
}

interface EditState {
  eventCode: string;
  playerId: string;
  name: string;
  points: string;
}

export function AdminUsersTab() {
  const [users, setUsers] = useState<AdminUserSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedUid, setExpandedUid] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refreshUsers = () => {
    setUsers(null);
    setLoadError(null);
    listAllAdminUsers()
      .then(setUsers)
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Laden fehlgeschlagen."));
  };

  useEffect(refreshUsers, []);

  const filteredUsers = useMemo(() => {
    if (!users) return null;
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.authUid.toLowerCase().includes(q),
    );
  }, [users, search]);

  const startEdit = (m: { eventCode: string; playerId: string; playerName: string; points: number }) => {
    setActionError(null);
    setEdit({ eventCode: m.eventCode, playerId: m.playerId, name: m.playerName, points: String(m.points) });
  };

  const saveEdit = async () => {
    if (!edit) return;
    const points = Number(edit.points);
    if (!edit.name.trim() || Number.isNaN(points)) {
      setActionError("Name darf nicht leer sein, Punkte müssen eine Zahl sein.");
      return;
    }
    const key = `${edit.eventCode}:${edit.playerId}`;
    setBusyKey(key);
    setActionError(null);
    try {
      await updatePlayerInEvent(edit.eventCode, edit.playerId, {
        name: edit.name.trim(),
        points,
      });
      setEdit(null);
      refreshUsers();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusyKey(null);
    }
  };

  const handleDeleteEverywhere = async (user: AdminUserSummary) => {
    if (
      !confirm(
        `Alle Daten von „${user.name}" (UID ${user.authUid}) in allen ${user.memberships.length} Event(s) unwiderruflich löschen? Events, in denen diese Person Host ist, werden dabei komplett gelöscht.`,
      )
    ) {
      return;
    }
    setBusyKey(user.authUid);
    setActionError(null);
    try {
      await deleteUserEverywhere(user);
      setExpandedUid(null);
      refreshUsers();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusyKey(null);
    }
  };

  if (loadError) {
    return <div className="error-box">{loadError}</div>;
  }

  if (!users) {
    return <p className="muted">Lädt…</p>;
  }

  return (
    <div>
      <label className="field">
        <span>Suche nach Name oder UID</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="z.B. Tom oder UZ1LEK…"
        />
      </label>

      <h3 className="section-title">
        Nutzer:innen ({filteredUsers!.length}
        {filteredUsers!.length !== users.length ? ` von ${users.length}` : ""})
      </h3>
      {actionError && <div className="error-box">{actionError}</div>}
      {filteredUsers!.length === 0 && (
        <p className="muted">{users.length === 0 ? "Noch keine Nutzer:innen." : "Keine Treffer."}</p>
      )}

      <div className="manage-list">
        {filteredUsers!.map((user) => (
          <div key={user.authUid}>
            <div
              className="manage-row"
              style={{ cursor: "pointer" }}
              onClick={() => {
                setExpandedUid(expandedUid === user.authUid ? null : user.authUid);
                setEdit(null);
              }}
            >
              <span>
                <strong>{user.name}</strong>{" "}
                <span className="muted">
                  · {user.memberships.length} Event(s) · {user.totalPoints} P gesamt
                  <br />
                  UID: {user.authUid}
                </span>
              </span>
              <div className="button-row">
                <button
                  className="ghost-btn small danger"
                  disabled={busyKey === user.authUid}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteEverywhere(user);
                  }}
                >
                  {busyKey === user.authUid ? "…" : "Überall löschen"}
                </button>
                <button className="ghost-btn small">
                  {expandedUid === user.authUid ? "Zuklappen" : "Details"}
                </button>
              </div>
            </div>

            {expandedUid === user.authUid && (
              <div className="manage-list" style={{ marginLeft: 16 }}>
                {user.memberships.map((m) => {
                  const key = `${m.eventCode}:${m.playerId}`;
                  const isEditing = edit?.eventCode === m.eventCode && edit?.playerId === m.playerId;
                  return (
                    <div className="manage-row" key={key}>
                      {isEditing && edit ? (
                        <>
                          <div className="button-row" style={{ flexWrap: "wrap" }}>
                            <input
                              value={edit.name}
                              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                              style={{ maxWidth: 160 }}
                            />
                            <input
                              type="number"
                              value={edit.points}
                              onChange={(e) => setEdit({ ...edit, points: e.target.value })}
                              style={{ maxWidth: 90 }}
                            />
                          </div>
                          <div className="button-row">
                            <button
                              className="secondary-btn small"
                              disabled={busyKey === key}
                              onClick={saveEdit}
                            >
                              {busyKey === key ? "…" : "Speichern"}
                            </button>
                            <button className="ghost-btn small" onClick={() => setEdit(null)}>
                              Abbrechen
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span>
                            {m.playerName}
                            {m.isHost ? " 👑" : ""}
                            {!m.approved ? " (wartet)" : ""}
                            <br />
                            <span className="muted small">
                              {m.eventName} ({m.eventCode}) · {m.points} P · beigetreten{" "}
                              {formatDate(m.joinedAt)}
                            </span>
                          </span>
                          <button className="ghost-btn small" onClick={() => startEdit(m)}>
                            Bearbeiten
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
