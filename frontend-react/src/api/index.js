import client from "./client";

export const authApi = {
  login: (username, password) => client.post("/auth/login/", { username, password }),
  register: (payload) => client.post("/auth/register/", payload),
  me: () => client.get("/auth/me/"),
};

export const usersApi = { list: () => client.get("/users/") };

export const tasksApi = {
  list: (params) => client.get("/tasks/", { params }),
  create: (payload) => client.post("/tasks/", payload),
  setStatus: (id, status) => client.patch(`/tasks/${id}/`, { status }),
  remove: (id) => client.delete(`/tasks/${id}/`),
};

export const notificationsApi = {
  list: () => client.get("/notifications/"),
  markRead: (id) => client.patch(`/notifications/${id}/read/`),
  markAllRead: () => client.patch("/notifications/read-all/"),
};
