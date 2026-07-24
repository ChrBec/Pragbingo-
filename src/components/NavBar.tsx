import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/app/missions", label: "Missionen", icon: "🕵️" },
  { to: "/app/bingo", label: "Bingo", icon: "🎯" },
  { to: "/app/feed", label: "Feed", icon: "📸" },
  { to: "/app/leaderboard", label: "Rang", icon: "🏆" },
  { to: "/app/chaos", label: "Chaos", icon: "🎲" },
  { to: "/app/voting", label: "Voting", icon: "🗳️" },
  { to: "/app/report", label: "Bericht", icon: "📋" },
  { to: "/app/hangover", label: "Kater", icon: "🤕" },
];

export function NavBar() {
  return (
    <nav className="nav-bar">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) => "nav-tab" + (isActive ? " active" : "")}
        >
          <span className="nav-icon">{tab.icon}</span>
          <span className="nav-label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
