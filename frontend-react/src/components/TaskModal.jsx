import { useEffect, useRef, useState } from "react";
import { errorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTasks } from "../context/TasksContext";

const EMPTY = { title: "", description: "", assigned_to: "", due_date: "" };

export default function TaskModal({ open, onClose }) {
  const { user } = useAuth();
  const { users, createTask } = useTasks();
  const dialogRef = useRef(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) {
      setForm(EMPTY);
      setError("");
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Give the task a title.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await createTask({
        title: form.title,
        description: form.description,
        assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
        due_date: form.due_date || null,
      });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={dialogRef} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <h2>New task</h2>
        <label>
          Title
          <input name="title" maxLength={200} value={form.title} onChange={change} autoFocus />
        </label>
        <label>
          Description
          <textarea name="description" rows={3} value={form.description} onChange={change} />
        </label>
        <div className="row">
          <label>
            Assign to
            <select name="assigned_to" value={form.assigned_to} onChange={change}>
              <option value="">Nobody yet</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username}
                  {u.id === user.id ? " (me)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Due date
            <input name="due_date" type="date" value={form.due_date} onChange={change} />
          </label>
        </div>
        <p className="form-error" role="alert">
          {error}
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            Create task
          </button>
        </div>
      </form>
    </dialog>
  );
}
