import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuthState } from "../state/AuthContext";
import { useEvent } from "../state/EventContext";
import { AuthPanel } from "../components/AuthPanel";
import type { MembershipDoc, PlayerDoc } from "../types";

interface EnrichedMembership extends MembershipDoc {
  approved: boolean;
  points: number;
}

export function MyEvents() {
  const { isAnonymous, ready, user } = useAuthState();
  const { openMembership } = useEvent();
  const navigate = useNavigate();
  const [memberships, setMemberships] = useState<EnrichedMembership[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    const database = db;
    if (!ready || isAnonymous || !user || !database) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const snap = await getDocs(collection(database, "users", user.uid, "events"));
      const base = snap.docs.map((d) => d.data() as MembershipDoc);
      const enriched = await Promise.all(
        base.map(async (m): Promise<EnrichedMembership> => {
          try {
            const playerSnap = await getDoc(
              doc(database, "events", m.eventCode, "players", m.playerId),
            );
            const player = playerSnap.exists() ? (playerSnap.data() as PlayerDoc) : null;
            return {
              ...m,
              approved: player?.approved ?? false,
              points: player?.points ?? 0,
            };
          } catch {
            return { ...m, approved: false, points: 0 };
          }
        }),
      );
      if (!cancelled) {
        enriched.sort((a, b) => b.joinedAt - a.joinedAt);
        setMemberships(enriched);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, isAnonymous, user]);

  const handleOpen = async (m: EnrichedMembership) => {
    setOpening(m.eventCode);
    try {
      await openMembership(m.eventCode, m.playerId);
      navigate("/app");
    } finally {
      setOpening(null);
    }
  };

  if (!ready) {
    return (
      <div className="screen center-screen">
        <p className="muted">Lade…</p>
      </div>
    );
  }

  if (isAnonymous) {
    return (
      <div className="screen">
        <Link to="/" className="back-link">
          ← Zurück
        </Link>
        <h1>Meine Events</h1>
        <p className="muted">
          Melde dich mit einem echten Konto an, um deine Events hier
          wiederzufinden und ohne Passwort erneut beizutreten.
        </p>
        <AuthPanel />
      </div>
    );
  }

  return (
    <div className="screen">
      <Link to="/" className="back-link">
        ← Zurück
      </Link>
      <h1>Meine Events</h1>
      <p className="muted">Events, die du erstellt hast oder denen du beigetreten bist.</p>

      {loading && <p className="muted">Lade Events…</p>}

      {!loading && memberships && memberships.length === 0 && (
        <p className="muted">Noch keine Events. Erstelle eins oder tritt einem bei.</p>
      )}

      <div className="my-events-list">
        {memberships?.map((m) => (
          <div className="my-event-card" key={m.eventCode}>
            <div className="my-event-card-title">
              {m.eventName} {m.role === "host" ? "🤵‍♂️ (Gastgeber:in)" : ""}
            </div>
            <div className="my-event-card-meta">
              Code {m.eventCode} · {m.playerName}
              {m.approved ? ` · ⭐ ${m.points} Punkte` : " · wartet auf Bestätigung"}
            </div>
            <button
              className="primary-btn small"
              disabled={opening === m.eventCode}
              onClick={() => handleOpen(m)}
            >
              {opening === m.eventCode ? "Öffne…" : "Öffnen →"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
