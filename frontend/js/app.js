/* Holat (store) + render. Context API'ga o'xshash: bitta state, subscribe orqali yangilanadi. */
const store = {
  state: {
    user: null,
    users: [],
    tasks: [],
    notifications: [],
    filter: "",
    search: "",
    view: localStorage.getItem("view") || "kanban",
    notifOpen: false,
  },
  listeners: [],
  set(patch) {
    Object.assign(this.state, patch);
    this.listeners.forEach((fn) => fn(this.state));
  },
  subscribe(fn) { this.listeners.push(fn); },
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const STATUSES = [
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" },
];
const LABEL = Object.fromEntries(STATUSES.map((s) => [s.key, s.label]));
// Status faqat bir qadam o'zgaradi (backend ham shuni talab qiladi)
const MOVES = {
  pending: [{ to: "in_progress", text: "Start", cls: "primary" }],
  in_progress: [
    { to: "pending", text: "Back", cls: "ghost" },
    { to: "completed", text: "Complete", cls: "primary" },
  ],
  completed: [{ to: "in_progress", text: "Reopen", cls: "ghost" }],
};

/* ---------- toast / xatolar ---------- */
function toast(message, type = "error") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), 5000);
}
const fail = (err) => toast(err.message || "Something went wrong.");

/* ---------- render: vazifalar ---------- */
function dueInfo(task) {
  if (!task.due_date) return "";
  const overdue = task.status !== "completed" && task.due_date < new Date().toISOString().slice(0, 10);
  return `<span class="due ${overdue ? "overdue" : ""}">${overdue ? "Overdue · " : "Due "}${esc(task.due_date)}</span>`;
}

function actionsFor(task, me) {
  const moves = (MOVES[task.status] || [])
    .map((m) => `<button class="btn sm ${m.cls}" data-act="move" data-id="${task.id}" data-to="${m.to}">${m.text}</button>`)
    .join("");
  const del = task.created_by.id === me.id
    ? `<button class="btn sm danger" data-act="delete" data-id="${task.id}">Delete</button>` : "";
  return moves + del;
}

function cardHtml(task, me) {
  const who = task.assigned_to_user ? task.assigned_to_user.username : "Unassigned";
  return `<article class="card status-${task.status}">
    <h3>${esc(task.title)}</h3>
    ${task.description ? `<p class="desc">${esc(task.description)}</p>` : ""}
    <p class="meta">From ${esc(task.created_by.username)} to ${esc(who)}</p>
    <div class="card-foot">${dueInfo(task)}<span class="pill ${task.status}">${LABEL[task.status]}</span></div>
    <div class="actions">${actionsFor(task, me)}</div>
  </article>`;
}

function renderBoard() {
  const { tasks, view, user } = store.state;
  const board = $("#board");
  if (!tasks.length) {
    board.innerHTML = `<div class="empty"><p>No tasks here yet.</p><p class="muted">Create one and assign it to a teammate.</p></div>`;
    return;
  }
  if (view === "kanban") {
    board.innerHTML = `<div class="kanban">${STATUSES.map((s) => {
      const items = tasks.filter((t) => t.status === s.key);
      return `<section class="column status-${s.key}">
        <h2>${s.label} <span class="count">${items.length}</span></h2>
        ${items.map((t) => cardHtml(t, user)).join("") || '<p class="muted col-empty">Nothing here</p>'}
      </section>`;
    }).join("")}</div>`;
  } else if (view === "cards") {
    board.innerHTML = `<div class="grid">${tasks.map((t) => cardHtml(t, user)).join("")}</div>`;
  } else {
    board.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Title</th><th>Status</th><th>From</th><th>Assigned to</th><th>Due</th><th></th></tr></thead>
      <tbody>${tasks.map((t) => `<tr>
        <td><strong>${esc(t.title)}</strong>${t.description ? `<div class="muted small">${esc(t.description)}</div>` : ""}</td>
        <td><span class="pill ${t.status}">${LABEL[t.status]}</span></td>
        <td>${esc(t.created_by.username)}</td>
        <td>${esc(t.assigned_to_user?.username ?? "—")}</td>
        <td>${dueInfo(t) || "—"}</td>
        <td class="actions">${actionsFor(t, user)}</td></tr>`).join("")}</tbody>
    </table></div>`;
  }
}

/* ---------- render: bildirishnomalar ---------- */
function renderNotifications() {
  const { notifications, notifOpen } = store.state;
  const unread = notifications.filter((n) => !n.is_read).length;
  const badge = $("#badge");
  badge.textContent = unread > 99 ? "99+" : unread;
  badge.classList.toggle("hidden", unread === 0);
  $("#notif-panel").classList.toggle("hidden", !notifOpen);
  $("#bell").setAttribute("aria-expanded", String(notifOpen));
  $("#notif-list").innerHTML = notifications.length
    ? notifications.map((n) => `<li class="${n.is_read ? "" : "unread"}">
        <div><p>${esc(n.message)}</p><time class="muted small">${new Date(n.created_at).toLocaleString()}</time></div>
        ${n.is_read ? "" : `<button class="link-btn" data-act="read" data-id="${n.id}">Mark as read</button>`}
      </li>`).join("")
    : `<li class="empty-note">You're all caught up.</li>`;
}

function renderChrome() {
  const { filter, view, user } = store.state;
  $$("#filters .tab").forEach((b) => b.classList.toggle("active", b.dataset.status === filter));
  $$(".view-switch button").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  if (user) $("#whoami").textContent = user.username;
}

store.subscribe(() => { renderChrome(); renderBoard(); renderNotifications(); });

/* ---------- ma'lumot yuklash ---------- */
async function loadTasks(silent = false) {
  try {
    const { filter, search } = store.state;
    store.set({ tasks: await api.tasks(filter, search) });
  } catch (e) { if (!silent) fail(e); }
}
async function loadNotifications(silent = false) {
  try { store.set({ notifications: await api.notifications() }); }
  catch (e) { if (!silent) fail(e); }
}

let pollTimer = null;
function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => { loadNotifications(true); loadTasks(true); }, POLL_INTERVAL_MS);
}
function stopPolling() { clearInterval(pollTimer); }

/* ---------- ekranlar ---------- */
function showAuth() {
  stopPolling();
  $("#app-screen").classList.add("hidden");
  $("#auth-screen").classList.remove("hidden");
}

async function showApp() {
  try {
    const [user, users] = await Promise.all([api.me(), api.users()]);
    store.set({ user, users });
  } catch (e) { if (e.status !== 401) fail(e); return; }
  $("#auth-screen").classList.add("hidden");
  $("#app-screen").classList.remove("hidden");
  await Promise.all([loadTasks(), loadNotifications()]);
  startPolling();
}

onSessionExpired = () => { store.set({ user: null, tasks: [], notifications: [] }); showAuth(); };

/* ---------- auth formalari ---------- */
function setFormError(form, msg) { form.querySelector(".form-error").textContent = msg || ""; }
async function submitting(form, fn) {
  const btn = form.querySelector("[type=submit]");
  btn.disabled = true;
  setFormError(form, "");
  try { await fn(); } catch (e) { setFormError(form, e.message); } finally { btn.disabled = false; }
}

$$("[data-auth-tab]").forEach((tab) => tab.addEventListener("click", () => {
  $$("[data-auth-tab]").forEach((t) => t.classList.toggle("active", t === tab));
  $("#login-form").classList.toggle("hidden", tab.dataset.authTab !== "login");
  $("#register-form").classList.toggle("hidden", tab.dataset.authTab !== "register");
}));

async function loginWith(username, password) {
  Auth.set(await api.login(username, password));
  await showApp();
}

$("#login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target, d = new FormData(f);
  if (!d.get("username") || !d.get("password")) return setFormError(f, "Enter your username and password.");
  submitting(f, () => loginWith(d.get("username"), d.get("password")));
});

$("#register-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target, d = Object.fromEntries(new FormData(f));
  if (!d.username || !d.password) return setFormError(f, "Choose a username and password.");
  submitting(f, async () => {
    await api.register(d);
    await loginWith(d.username, d.password);
  });
});

$("#logout").addEventListener("click", () => {
  Auth.clear();
  store.set({ user: null, tasks: [], notifications: [], notifOpen: false });
  showAuth();
});

/* ---------- filter, qidiruv, ko'rinish ---------- */
$("#filters").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-status]");
  if (!btn) return;
  store.set({ filter: btn.dataset.status });
  loadTasks();
});

let searchTimer;
$("#search").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { store.set({ search: e.target.value.trim() }); loadTasks(); }, 300);
});

$(".view-switch").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-view]");
  if (!btn) return;
  localStorage.setItem("view", btn.dataset.view);
  store.set({ view: btn.dataset.view });
});

/* ---------- vazifa amallari (status, o'chirish) ---------- */
$("#board").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const id = btn.dataset.id;
  btn.disabled = true;
  try {
    if (btn.dataset.act === "move") await api.setStatus(id, btn.dataset.to);
    if (btn.dataset.act === "delete") {
      if (!confirm("Delete this task? This cannot be undone.")) { btn.disabled = false; return; }
      await api.deleteTask(id);
      toast("Task deleted.", "ok");
    }
    await loadTasks();
  } catch (err) { fail(err); btn.disabled = false; }
});

/* ---------- yangi vazifa ---------- */
const dialog = $("#task-dialog");
const taskForm = $("#task-form");

$("#new-task").addEventListener("click", () => {
  const { users, user } = store.state;
  taskForm.reset();
  setFormError(taskForm, "");
  $("#assignee").innerHTML =
    `<option value="">Nobody yet</option>` +
    users.map((u) => `<option value="${u.id}">${esc(u.username)}${u.id === user.id ? " (me)" : ""}</option>`).join("");
  dialog.showModal();
  taskForm.elements.title.focus();
});
$("#cancel-task").addEventListener("click", () => dialog.close());

taskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(taskForm));
  if (!d.title.trim()) return setFormError(taskForm, "Give the task a title.");
  const payload = {
    title: d.title,
    description: d.description,
    assigned_to: d.assigned_to ? Number(d.assigned_to) : null,
    due_date: d.due_date || null,
  };
  submitting(taskForm, async () => {
    await api.createTask(payload);
    dialog.close();
    toast("Task created.", "ok");
    await loadTasks();
  });
});

/* ---------- bildirishnomalar paneli ---------- */
$("#bell").addEventListener("click", (e) => {
  e.stopPropagation();
  store.set({ notifOpen: !store.state.notifOpen });
});
document.addEventListener("click", (e) => {
  if (store.state.notifOpen && !e.target.closest(".bell-wrap")) store.set({ notifOpen: false });
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && store.state.notifOpen) store.set({ notifOpen: false });
});

$("#notif-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-act=read]");
  if (!btn) return;
  try { await api.markRead(btn.dataset.id); await loadNotifications(); } catch (err) { fail(err); }
});
$("#read-all").addEventListener("click", async () => {
  try { await api.markAllRead(); await loadNotifications(); } catch (err) { fail(err); }
});

/* ---------- start ---------- */
(async function init() {
  renderChrome();
  if (Auth.access || Auth.refresh) await showApp();
  if ($("#app-screen").classList.contains("hidden")) showAuth();
})();
