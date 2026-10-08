import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { tasksApi, usersApi } from "../api";
import { errorMessage, POLL_MS } from "../api/client";
import { useToast } from "./ToastContext";

const TasksContext = createContext(null);

export function TasksProvider({ children }) {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (silent = false) => {
      try {
        const { data } = await tasksApi.list({
          status: filter || undefined,
          title: search || undefined,
        });
        setTasks(data);
      } catch (e) {
        if (!silent) toast.error(errorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [filter, search, toast],
  );

  // filter/search o'zgarganda qayta yuklash
  useEffect(() => {
    load();
  }, [load]);

  // polling: har 10 soniyada
  useEffect(() => {
    const id = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    usersApi
      .list()
      .then(({ data }) => setUsers(data))
      .catch((e) => toast.error(errorMessage(e)));
  }, [toast]);

  const createTask = useCallback(
    async (payload) => {
      await tasksApi.create(payload); // xatoni forma o'zi ko'rsatadi
      toast.success("Task created.");
      await load(true);
    },
    [load, toast],
  );

  const moveTask = useCallback(
    async (id, status) => {
      try {
        await tasksApi.setStatus(id, status);
        await load(true);
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    [load, toast],
  );

  const deleteTask = useCallback(
    async (id) => {
      try {
        await tasksApi.remove(id);
        toast.success("Task deleted.");
        await load(true);
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    [load, toast],
  );

  const value = useMemo(
    () => ({
      tasks, users, filter, search, loading,
      setFilter, setSearch, createTask, moveTask, deleteTask,
    }),
    [tasks, users, filter, search, loading, createTask, moveTask, deleteTask],
  );
  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export const useTasks = () => useContext(TasksContext);
