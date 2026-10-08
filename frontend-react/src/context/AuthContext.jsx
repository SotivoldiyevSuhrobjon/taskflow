import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../api";
import { tokens } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokens.access || tokens.refresh));

  useEffect(() => {
    if (!(tokens.access || tokens.refresh)) return;
    authApi
      .me()
      .then(({ data }) => setUser(data))
      .catch(() => tokens.clear())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  const login = useCallback(async (username, password) => {
    const { data } = await authApi.login(username, password);
    tokens.set(data);
    setUser((await authApi.me()).data);
  }, []);

  const register = useCallback(
    async (payload) => {
      await authApi.register(payload);
      await login(payload.username, payload.password);
    },
    [login],
  );

  const logout = useCallback(() => {
    tokens.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
