import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";

const VIEWS = [
  ["kanban", "Kanban"],
  ["cards", "Cards"],
  ["table", "Table"],
];

export default function Header({ view, onViewChange }) {
  const { user, logout } = useAuth();
  return (
    <header className="topbar">
      <span className="brand small">Taskflow</span>
      <div className="view-switch" role="group" aria-label="Layout">
        {VIEWS.map(([key, label]) => (
          <button key={key} className={view === key ? "active" : ""} onClick={() => onViewChange(key)}>
            {label}
          </button>
        ))}
      </div>
      <div className="topbar-right">
        <NotificationBell />
        <span className="whoami">{user.username}</span>
        <button className="btn ghost" onClick={logout}>
          Log out
        </button>
      </div>
    </header>
  );
}
