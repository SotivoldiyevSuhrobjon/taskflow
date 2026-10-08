import { STATUS_LABEL } from "../constants";
import TaskActions from "./TaskActions";

export function DueDate({ task }) {
  if (!task.due_date) return null;
  const overdue = task.status !== "completed" && task.due_date < new Date().toISOString().slice(0, 10);
  return (
    <span className={`due ${overdue ? "overdue" : ""}`}>
      {overdue ? "Overdue · " : "Due "}
      {task.due_date}
    </span>
  );
}

export default function TaskCard({ task }) {
  const who = task.assigned_to_user?.username ?? "Unassigned";
  return (
    <article className={`card status-${task.status}`}>
      <h3>{task.title}</h3>
      {task.description && <p className="desc">{task.description}</p>}
      <p className="meta">
        From {task.created_by.username} to {who}
      </p>
      <div className="card-foot">
        <DueDate task={task} />
        <span className={`pill ${task.status}`}>{STATUS_LABEL[task.status]}</span>
      </div>
      <TaskActions task={task} />
    </article>
  );
}
