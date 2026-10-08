import { useState } from "react";
import { errorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) {
      setError("Enter a username and password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (mode === "login") await login(form.username, form.password);
      else await register(form);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <section className="auth-card">
        <h1 className="brand">Taskflow</h1>
        <p className="auth-lead">Assign work, track progress, get told when something changes.</p>
        <div className="tabs" role="tablist">
          <button className={`tab ${mode === "login" ? "active" : ""}`} onClick={() => setMode("login")}>
            Log in
          </button>
          <button
            className={`tab ${mode === "register" ? "active" : ""}`}
            onClick={() => setMode("register")}
          >
            Create account
          </button>
        </div>
        <form className="form" onSubmit={submit} noValidate>
          <label>
            Username
            <input name="username" value={form.username} onChange={change} autoComplete="username" />
          </label>
          {mode === "register" && (
            <label>
              Email <span className="muted">(optional)</span>
              <input name="email" type="email" value={form.email} onChange={change} />
            </label>
          )}
          <label>
            Password
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={change}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
            {mode === "register" && <span className="hint">At least 8 characters.</span>}
          </label>
          <p className="form-error" role="alert">
            {error}
          </p>
          <button className="btn primary" type="submit" disabled={busy}>
            {mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
      </section>
    </main>
  );
}
