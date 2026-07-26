import { useState } from "react";
import { AdminEventsTab } from "./AdminEventsTab";
import { AdminUsersTab } from "./AdminUsersTab";

type AdminTab = "events" | "users";

export function AdminDashboard() {
  const [tab, setTab] = useState<AdminTab>("events");

  return (
    <div>
      <div className="category-tabs">
        <button
          className={`category-tab${tab === "events" ? " active" : ""}`}
          onClick={() => setTab("events")}
        >
          Events
        </button>
        <button
          className={`category-tab${tab === "users" ? " active" : ""}`}
          onClick={() => setTab("users")}
        >
          Nutzer:innen
        </button>
      </div>

      {tab === "events" ? <AdminEventsTab /> : <AdminUsersTab />}
    </div>
  );
}
