import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, type) => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  // value o'zgarmas bo'lishi kerak (boshqa hooklar dependency sifatida ishlatadi)
  const api = useMemo(
    () => ({ error: (m) => push(m, "error"), success: (m) => push(m, "ok") }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div id="toasts" aria-live="assertive">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
