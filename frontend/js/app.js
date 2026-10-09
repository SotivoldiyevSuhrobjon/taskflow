/* Holat (store) + render. Context API'ga o'xshash: bitta state, subscribe orqali yangilanadi. */
const store = {
  state: {
    user: null,
    users: [],
    tasks: [],
    labels: [],
    notifications: [],
    filter: "",
    labelFilter: "",
    search: "",
    view: localStorage.getItem("view") || "kanban",
    notifOpen: false,
    detailId: null,
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
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const STATUSES = [
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" },
];
const LABEL = Object.fromEntries(STATUSES.map((s) => [s.key, s.label]));
const MOVES = {
  pending: [{ to: "in_progress", text: "Start", cls: "primary" }],
  in_progress: [
    { to: "pending", text: "Back", cls: "ghost" },
    { to: "completed", text: "Complete", cls: "primary" },
  ],
  completed: [{ to: "in_progress", text: "Reopen", cls: "ghost" }],
};

let dragging = false;       // sudrash paytida doska qayta chizilmaydi
let sortables = [];
let detailCache = null;     // filtr tufayli ro'yxatdan chiqib ketgan vazifani ham ko'rsatish uchun
let commentsHtml = "";
const createLabelIds = new Set();

/* ---------- toast / xatolar ---------- */
function toast(message, type = "error") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), 5000);
}
const fail = (err) => toast(err.message || "Something went wrong.");

/* ---------- render: yordamchilar ---------- */
function dueInfo(task) {
  if (!task.due_date) return "";
  const overdue = task.status !== "completed" && task.due_date < new Date().toISOString().slice(0, 10);
  return `<span class="due ${overdue ? "overdue" : ""}">${overdue ? "Overdue · " : "Due "}${esc(task.due_date)}</span>`;
}

function chipsHtml(labels) {
  return labels.map((l) => `<span class="chip" style="--c:${esc(l.color)}">${esc(l.name)}</span>`).join("");
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
  return `<article class="card status-${task.status}" data-task="${task.id}" tabindex="0">
    ${task.labels.length ? `<div class="chips">${chipsHtml(task.labels)}</div>` : ""}
    <h3 class="clamp-2">${esc(task.title)}</h3>
    ${task.description ? `<p class="desc clamp-3">${esc(task.description)}</p>` : ""}
    <p class="meta clamp-1">From ${esc(task.created_by.username)} to ${esc(who)}</p>
    <div class="card-foot">
      <span class="foot-left">${dueInfo(task)}${task.comments_count ? `<span class="count-note" title="Comments">💬 ${task.comments_count}</span>` : ""}</span>
      <span class="pill ${task.status}">${LABEL[task.status]}</span>
    </div>
    <div class="actions">${actionsFor(task, me)}</div>
  </article>`;
}

/* ---------- render: doska ---------- */
function renderBoard() {
  if (dragging) return;
  const { tasks, view, user } = store.state;
  const board = $("#board");
  const scrolls = $$(".col-body").map((el) => el.scrollTop);
  if (!tasks.length) {
    board.innerHTML = `<div class="empty"><p>No tasks here yet.</p><p class="muted">Create one and assign it to a teammate.</p></div>`;
    return;
  }
  if (view === "kanban") {
    board.innerHTML = `<div class="kanban">${STATUSES.map((s) => {
      const items = tasks.filter((t) => t.status === s.key);
      return `<section class="column status-${s.key}">
        <h2>${s.label} <span class="count">${items.length}</span></h2>
        <div class="col-body" data-status="${s.key}">
          ${items.map((t) => cardHtml(t, user)).join("")}
          ${items.length ? "" : '<p class="muted col-empty">Drop tasks here</p>'}
        </div>
      </section>`;
    }).join("")}</div>`;
    $$(".col-body").forEach((el, i) => { el.scrollTop = scrolls[i] || 0; });
    initSortable();
  } else if (view === "cards") {
    board.innerHTML = `<div class="grid">${tasks.map((t) => cardHtml(t, user)).join("")}</div>`;
  } else {
    board.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Title</th><th>Status</th><th>From</th><th>Assigned to</th><th>Due</th><th></th></tr></thead>
      <tbody>${tasks.map((t) => `<tr data-task="${t.id}" tabindex="0">
        <td data-label="Task"><strong class="clamp-2">${esc(t.title)}</strong>
          ${t.labels.length ? `<div class="chips">${chipsHtml(t.labels)}</div>` : ""}
          ${t.description ? `<div class="muted small clamp-2">${esc(t.description)}</div>` : ""}</td>
        <td data-label="Status"><span class="pill ${t.status}">${LABEL[t.status]}</span></td>
        <td data-label="From">${esc(t.created_by.username)}</td>
        <td data-label="Assigned to">${esc(t.assigned_to_user?.username ?? "—")}</td>
        <td data-label="Due">${dueInfo(t) || "—"}</td>
        <td class="actions">${actionsFor(t, user)}</td></tr>`).join("")}</tbody>
    </table></div>`;
  }
}

/* ---------- drag & drop (SortableJS: sichqoncha va touch) ---------- */
function initSortable() {
  sortables.forEach((s) => s.destroy());
  sortables = [];
  if (!window.Sortable) return; // CDN yuklanmasa ham tugmalar ishlaydi
  sortables = $$(".col-body").map((el) => new Sortable(el, {
    group: "tasks",
    draggable: ".card",
    animation: 150,
    delay: 150,
    delayOnTouchOnly: true,
    touchStartThreshold: 6,
    ghostClass: "ghost",
    chosenClass: "chosen",
    onStart: () => { dragging = true; },
    onEnd: onDragEnd,
  }));
}

async function onDragEnd(evt) {
  dragging = false;
  if (evt.from === evt.to && evt.oldIndex === evt.newIndex) return;
  const id = Number(evt.item.dataset.task);
  const status = evt.to.dataset.status;
  const items = [...evt.to.querySelectorAll(".card")];
  const idx = items.indexOf(evt.item);
  const posOf = (el) => store.state.tasks.find((t) => t.id === Number(el.dataset.task))?.position;
  const prev = items[idx - 1] ? posOf(items[idx - 1]) : null;
  const next = items[idx + 1] ? posOf(items[idx + 1]) : null;
  let position;
  if (prev != null && next != null) position = (prev + next) / 2;
  else if (prev != null) position = prev + 1;
  else if (next != null) position = next - 1;
  else position = Date.now() / 1000;

  // optimistik yangilash, so'ng serverga yuborish
  const tasks = store.state.tasks
    .map((t) => (t.id === id ? { ...t, status, position } : t))
    .sort((a, b) => a.position - b.position || a.id - b.id);
  store.set({ tasks });
  try {
    await api.patchTask(id, { status, position });
  } catch (e) {
    fail(e);
  }
  await loadTasks(true);
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

let labelFilterHtml = "";
function renderLabelFilter() {
  const { labels, labelFilter } = store.state;
  const html = `<option value="">All labels</option>` +
    labels.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join("");
  if (html !== labelFilterHtml) {
    labelFilterHtml = html;
    $("#label-filter").innerHTML = html;
  }
  $("#label-filter").value = labelFilter;
}

/* ---------- render: vazifa tafsiloti ---------- */
const detailDialog = $("#detail-dialog");

function currentDetailTask() {
  const { tasks, detailId } = store.state;
  const found = tasks.find((t) => t.id === detailId);
  if (found) detailCache = found;
  return found || (detailCache && detailCache.id === detailId ? detailCache : null);
}

function renderDetail() {
  const task = currentDetailTask();
  if (!task) return;
  const { user, labels } = store.state;
  const who = task.assigned_to_user ? task.assigned_to_user.username : "Unassigned";
  $("#d-title").textContent = task.title;
  $("#d-meta").innerHTML = `<span class="pill ${task.status}">${LABEL[task.status]}</span>
    <span class="muted">From ${esc(task.created_by.username)} to ${esc(who)}</span> ${dueInfo(task)}`;
  $("#d-desc").textContent = task.description || "No description.";
  $("#d-desc").classList.toggle("muted", !task.description);
  $("#d-actions").innerHTML = actionsFor(task, user);
  const picked = new Set(task.labels.map((l) => l.id));
  $("#d-labels").innerHTML = labels.length
    ? labels.map((l) => `<button type="button" class="chip toggle ${picked.has(l.id) ? "on" : ""}" style="--c:${esc(l.color)}" data-label="${l.id}" aria-pressed="${picked.has(l.id)}">${esc(l.name)}</button>`).join("")
    : `<span class="muted small">No labels yet.</span>`;
}

async function loadComments(silent = false) {
  const id = store.state.detailId;
  if (!id) return;
  try {
    const list = await api.comments(id);
    if (store.state.detailId !== id) return;
    const html = list.length
      ? list.map((c) => `<li><div class="comment-head"><strong>${esc(c.author.username)}</strong>
          <time class="muted small">${new Date(c.created_at).toLocaleString()}</time></div>
          <p>${esc(c.text)}</p></li>`).join("")
      : `<li class="muted">No comments yet.</li>`;
    if (html !== commentsHtml) {
      commentsHtml = html;
      $("#d-comments").innerHTML = html;
    }
  } catch (e) { if (!silent) fail(e); }
}

function openDetail(id) {
  store.set({ detailId: id });
  commentsHtml = "";
  $("#d-comments").innerHTML = "";
  $("#comment-form").reset();
  $("#comment-form .form-error").textContent = "";
  renderDetail();
  if (!detailDialog.open) detailDialog.showModal();
  loadComments();
}

detailDialog.addEventListener("close", () => { store.state.detailId = null; detailCache = null; });
$("#d-close").addEventListener("click", () => detailDialog.close());
detailDialog.addEventListener("click", (e) => { if (e.target === detailDialog) detailDialog.close(); });

store.subscribe(() => {
  renderChrome();
  renderBoard();
  renderNotifications();
  renderLabelFilter();
  if (store.state.detailId) renderDetail();
});

/* ---------- ma'lumot yuklash ---------- */
async function loadTasks(silent = false) {
  try {
    const { filter, search, labelFilter } = store.state;
    const tasks = await api.tasks({ status: filter, title: search, label: labelFilter });
    if (!same(tasks, store.state.tasks)) store.set({ tasks });
  } catch (e) { if (!silent) fail(e); }
}
async function loadNotifications(silent = false) {
  try {
    const notifications = await api.notifications();
    if (!same(notifications, store.state.notifications)) store.set({ notifications });
  } catch (e) { if (!silent) fail(e); }
}
async function loadLabels(silent = false) {
  try {
    const labels = await api.labels();
    if (!same(labels, store.state.labels)) store.set({ labels });
  } catch (e) { if (!silent) fail(e); }
}

let pollTimer = null;
function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => {
    loadNotifications(true);
    loadTasks(true);
    loadLabels(true);
    if (store.state.detailId) loadComments(true);
  }, POLL_INTERVAL_MS);
}
function stopPolling() { clearInterval(pollTimer); }

/* ---------- ekranlar ---------- */
function showAuth() {
  stopPolling();
  if (detailDialog.open) detailDialog.close();
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
  await Promise.all([loadLabels(), loadTasks(), loadNotifications()]);
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
  store.set({ user: null, tasks: [], notifications: [], notifOpen: false, detailId: null });
  showAuth();
});

/* ---------- filter, qidiruv, ko'rinish ---------- */
$("#filters").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-status]");
  if (!btn) return;
  store.set({ filter: btn.dataset.status });
  loadTasks();
});

$("#label-filter").addEventListener("change", (e) => {
  store.set({ labelFilter: e.target.value });
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
async function handleAction(btn) {
  const id = btn.dataset.id;
  btn.disabled = true;
  try {
    if (btn.dataset.act === "move") await api.setStatus(id, btn.dataset.to);
    if (btn.dataset.act === "delete") {
      if (!confirm("Delete this task? This cannot be undone.")) { btn.disabled = false; return; }
      await api.deleteTask(id);
      toast("Task deleted.", "ok");
      if (detailDialog.open) detailDialog.close();
    }
    await loadTasks();
  } catch (err) { fail(err); btn.disabled = false; }
}

$("#board").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (btn) return handleAction(btn);
  const item = e.target.closest("[data-task]");
  if (item) openDetail(Number(item.dataset.task));
});
$("#board").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches("[data-task]")) openDetail(Number(e.target.dataset.task));
});
$("#d-actions").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (btn) handleAction(btn);
});

/* ---------- label'lar (detail oynasida) ---------- */
$("#d-labels").addEventListener("click", async (e) => {
  const chip = e.target.closest("[data-label]");
  const task = currentDetailTask();
  if (!chip || !task) return;
  const id = Number(chip.dataset.label);
  const ids = new Set(task.labels.map((l) => l.id));
  ids.has(id) ? ids.delete(id) : ids.add(id);
  try {
    await api.patchTask(task.id, { label_ids: [...ids] });
    await loadTasks(true);
  } catch (err) { fail(err); }
});

$("#label-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const name = f.elements.name.value.trim();
  if (!name) return toast("Give the label a name.");
  try {
    await api.createLabel({ name, color: f.elements.color.value });
    f.reset();
    await loadLabels(true);
  } catch (err) { fail(err); }
});

/* ---------- kommentlar ---------- */
$("#comment-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target;
  const text = f.elements.text.value.trim();
  if (!text) return setFormError(f, "Write something first.");
  submitting(f, async () => {
    await api.addComment(store.state.detailId, text);
    f.reset();
    await Promise.all([loadComments(), loadTasks(true)]);
  });
});

/* ---------- yangi vazifa ---------- */
const dialog = $("#task-dialog");
const taskForm = $("#task-form");

function renderCreateLabels() {
  const { labels } = store.state;
  $("#create-labels").innerHTML = labels.length
    ? labels.map((l) => `<button type="button" class="chip toggle ${createLabelIds.has(l.id) ? "on" : ""}" style="--c:${esc(l.color)}" data-label="${l.id}" aria-pressed="${createLabelIds.has(l.id)}">${esc(l.name)}</button>`).join("")
    : `<span class="muted small">No labels yet.</span>`;
}

$("#create-labels").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-label]");
  if (!chip) return;
  const id = Number(chip.dataset.label);
  createLabelIds.has(id) ? createLabelIds.delete(id) : createLabelIds.add(id);
  renderCreateLabels();
});

$("#new-task").addEventListener("click", () => {
  const { users, user } = store.state;
  taskForm.reset();
  createLabelIds.clear();
  renderCreateLabels();
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
    label_ids: [...createLabelIds],
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
