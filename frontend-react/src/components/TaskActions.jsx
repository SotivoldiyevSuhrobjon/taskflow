import { useState } from "react";
import { MOVES } from "../constants";
import { useAuth } from "../context/AuthContext";
import { useTasks } from "../context/TasksContext";

export default function TaskActions({ task }) {
  const { user } = useAuth();
  const { moveTask, deleteTask } = useTasks();
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    await fn();
    setBusy(false);
  };

  const onDelete = () => {
    if (window.confirm("Delete this task? This cannot be undone.")) run(() => deleteTask(task.id));
  };

  return (
    <div className="actions">
      {(MOVES[task.status] || []).map((m) => (
        <button
          key={m.to}
          className={`btn sm ${m.cls}`}
          disabled={busy}
          onClick={() => run(() => moveTask(task.id, m.to))}
        >
          {m.text}
        </button>
      ))}
      {task.created_by.id === user.id && (
        <button className="btn sm danger" disabled={busy} onClick={onDelete}>
          Delete
        </button>
      )}
    </div>
  );
}
