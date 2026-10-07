/* API qatlami: JWT saqlash, Authorization header, avtomatik refresh, xatolar. */
const Auth = {
  get access() { return localStorage.getItem("access"); },
  get refresh() { return localStorage.getItem("refresh"); },
  set(tokens) {
    if (tokens.access) localStorage.setItem("access", tokens.access);
    if (tokens.refresh) localStorage.setItem("refresh", tokens.refresh);
  },
  clear() {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
  },
};

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function readableError(data, status) {
  if (!data) return `Request failed (${status}).`;
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  const parts = Object.entries(data).map(([field, msgs]) => {
    const text = Array.isArray(msgs) ? msgs.join(" ") : String(msgs);
    return field === "non_field_errors" ? text : `${field}: ${text}`;
  });
  return parts.join(" ") || `Request failed (${status}).`;
}

let onSessionExpired = () => {};

async function refreshAccess() {
  if (!Auth.refresh) return false;
  try {
    const res = await fetch(`${API_URL}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: Auth.refresh }),
    });
    if (!res.ok) return false;
    Auth.set(await res.json());
    return true;
  } catch {
    return false;
  }
}

async function request(path, { method = "GET", body, auth = true, retry = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && Auth.access) headers.Authorization = `Bearer ${Auth.access}`;

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Cannot reach the server. Check that the backend is running.", 0);
  }

  if (res.status === 401 && auth && retry) {
    if (await refreshAccess()) return request(path, { method, body, auth, retry: false });
    Auth.clear();
    onSessionExpired();
    throw new ApiError("Your session has expired. Log in again.", 401);
  }
  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(readableError(data, res.status), res.status, data);
  return data;
}

const api = {
  login: (username, password) =>
    request("/auth/login/", { method: "POST", body: { username, password }, auth: false }),
  register: (payload) => request("/auth/register/", { method: "POST", body: payload, auth: false }),
  me: () => request("/auth/me/"),
  users: () => request("/users/"),
  tasks: (status, title) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (title) q.set("title", title);
    const qs = q.toString();
    return request(`/tasks/${qs ? "?" + qs : ""}`);
  },
  createTask: (payload) => request("/tasks/", { method: "POST", body: payload }),
  setStatus: (id, status) => request(`/tasks/${id}/`, { method: "PATCH", body: { status } }),
  deleteTask: (id) => request(`/tasks/${id}/`, { method: "DELETE" }),
  notifications: () => request("/notifications/"),
  markRead: (id) => request(`/notifications/${id}/read/`, { method: "PATCH" }),
  markAllRead: () => request("/notifications/read-all/", { method: "PATCH" }),
};
