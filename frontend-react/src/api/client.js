import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
export const POLL_MS = Number(import.meta.env.VITE_POLL_INTERVAL_MS) || 10000;

export const tokens = {
  get access() {
    return localStorage.getItem("access");
  },
  get refresh() {
    return localStorage.getItem("refresh");
  },
  set({ access, refresh }) {
    if (access) localStorage.setItem("access", access);
    if (refresh) localStorage.setItem("refresh", refresh);
  },
  clear() {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
  },
};

const client = axios.create({ baseURL: API_URL });

// Har so'rovga Authorization: Bearer <token>
client.interceptors.request.use((config) => {
  if (tokens.access) config.headers.Authorization = `Bearer ${tokens.access}`;
  return config;
});

let refreshing = null;

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthCall = original?.url?.startsWith("/auth/");
    if (error.response?.status === 401 && original && !isAuthCall && !original._retry) {
      original._retry = true;
      if (tokens.refresh) {
        try {
          refreshing ??= axios
            .post(`${API_URL}/auth/refresh/`, { refresh: tokens.refresh })
            .finally(() => {
              refreshing = null;
            });
          const { data } = await refreshing;
          tokens.set(data);
          return client(original);
        } catch {
          /* refresh ham o'tmadi, pastda sessiya tugaydi */
        }
      }
      tokens.clear();
      window.dispatchEvent(new Event("auth:expired"));
    }
    return Promise.reject(error);
  },
);

export function errorMessage(error) {
  if (!error.response) return "Cannot reach the server. Check that the backend is running.";
  const data = error.response.data;
  if (!data) return `Request failed (${error.response.status}).`;
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  return Object.entries(data)
    .map(([field, msgs]) => {
      const text = Array.isArray(msgs) ? msgs.join(" ") : String(msgs);
      return field === "non_field_errors" ? text : `${field}: ${text}`;
    })
    .join(" ");
}

export default client;
