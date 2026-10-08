import { STATUS_LABEL, STATUSES } from "../constants";
import { useTasks } from "../context/TasksContext";
import TaskActions from "./TaskActions";
import TaskCard, { DueDate } from "./TaskCard";

function Table({ tasks }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>From</th>
            <th>Assigned to</th>
            <th>Due</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <td>
                <strong>{t.title}</strong>
                {t.description && <div className="muted small">{t.description}</div>}
              </td>
              <td>
                <span className={`pill ${t.status}`}>{STATUS_LABEL[t.status]}</span>
              </td>
              <td>{t.created_by.username}</td>
              <td>{t.assigned_to_user?.username ?? "—"}</td>
              <td>{t.due_date ? <DueDate task={t} /> : "—"}</td>
              <td>
                <TaskActions task={t} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TaskBoard({ view }) {
  const { tasks, loading } = useTasks();

  if (loading) return <p className="loading">Loading tasks…</p>;
  if (tasks.length === 0) {
    return (
      <div className="empty">
        <p>No tasks here yet.</p>
        <p className="muted">Create one and assign it to a teammate.</p>
      </div>
    );
  }

  if (view === "table") return <Table tasks={tasks} />;
  if (view === "cards") {
    return (
      <div className="grid">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} />
        ))}
      </div>
    );
  }
  return (
    <div className="kanban">
      {STATUSES.map((s) => {
        const items = tasks.filter((t) => t.status === s.key);
        return (
          <section key={s.key} className={`column status-${s.key}`}>
            <h2>
              {s.label} <span className="count">{items.length}</span>
            </h2>
            {items.length === 0 && <p className="muted col-empty">Nothing here</p>}
            {items.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
