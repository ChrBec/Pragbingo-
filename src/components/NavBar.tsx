import { NavLink } from "react-router-dom";
import { useEvent } from "../state/EventContext";

const TABS = [
  { to: "/app/missions", label: "Missionen", icon: "🕵️" },
  { to: "/app/bingo", label: "Bingo", icon: "🎯" },
  { to: "/app/feed", label: "Feed", icon: "📸" },
  { to: "/app/leaderboard", label: "Rang", icon: "🏆" },
  { to: "/app/chaos", label: "Chaos", icon: "🎲" },
  { to: "/app/challenges", label: "Challenges", icon: "💰" },
  { to: "/app/voting", label: "Voting", icon: "🗳️" },
  { to: "/app/report", label: "Bericht", icon: "📋" },
  { to: "/app/hangover", label: "Kater", icon: "🤕" },
];

export function NavBar() {
  const { event, currentPlayer, players } = useEvent();
  const isHost = Boolean(event && currentPlayer && currentPlayer.id === event.hostPlayerId);
  const pendingCount = players.filter((p) => !p.approved).length;

  const tabs = isHost
    ? [
        ...TABS,
        {
          to: "/app/manage",
          label: "Verwalten",
          icon: "⚙️",
          badge: pendingCount > 0 ? pendingCount : undefined,
        },
      ]
    : TABS;

  return (
    <nav className="nav-bar">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) => "nav-tab" + (isActive ? " active" : "")}
        >
          <span className="nav-icon">
            {tab.icon}
            {"badge" in tab && tab.badge ? <span className="nav-badge">{tab.badge}</span> : null}
          </span>
          <span className="nav-label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
