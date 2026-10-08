import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { notificationsApi } from "../api";
import { errorMessage, POLL_MS } from "../api/client";
import { useToast } from "./ToastContext";

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const toast = useToast();
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    try {
      const { data } = await notificationsApi.list();
      setItems(data);
    } catch {
      /* polling xatolari foydalanuvchini bezovta qilmasin */
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const markRead = useCallback(
    async (id) => {
      try {
        await notificationsApi.markRead(id);
        await load();
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    [load, toast],
  );

  const markAllRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead();
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [load, toast]);

  const unread = items.filter((n) => !n.is_read).length;
  const value = useMemo(
    () => ({ items, unread, markRead, markAllRead }),
    [items, unread, markRead, markAllRead],
  );
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export const useNotifications = () => useContext(NotificationsContext);
