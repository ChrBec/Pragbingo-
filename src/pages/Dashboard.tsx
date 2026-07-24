import { useEffect, useState } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { useEvent } from "../state/EventContext";
import { NavBar } from "../components/NavBar";

export function Dashboard() {
  const { ready, event, currentPlayer, loading, leaveEvent, rejoin } = useEvent();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!event || !currentPlayer) {
      rejoin().finally(() => setChecked(true));
    } else {
      setChecked(true);
    }
  }, [ready, event, currentPlayer, rejoin]);

  if (!ready || (!checked && loading)) {
    return (
      <div className="screen center-screen">
        <p className="muted">Lade Event…</p>
      </div>
    );
  }

  if (checked && (!event || !currentPlayer)) {
    return <Navigate to="/" replace />;
  }

  if (!event || !currentPlayer) {
    return (
      <div className="screen center-screen">
        <p className="muted">Lade Event…</p>
      </div>
    );
  }

  const handleLeave = () => {
    leaveEvent();
    navigate("/");
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <div className="app-header-title">{event.name}</div>
          <div className="app-header-sub">
            Code <strong>{event.code}</strong> · {currentPlayer.name}
            {currentPlayer.isGroom ? " 🤵" : ""}
          </div>
        </div>
        <div className="app-header-right">
          <div className="points-pill">⭐ {currentPlayer.points}</div>
          <button className="icon-btn" onClick={handleLeave} title="Event verlassen">
            ⏻
          </button>
        </div>
      </header>
      <main className="app-content">
        <Outlet />
      </main>
      <NavBar />
    </div>
  );
}
