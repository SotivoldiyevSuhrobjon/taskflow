import { useAuth } from "./context/AuthContext";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <p className="loading">Loading…</p>;
  return user ? <Dashboard /> : <AuthPage />;
}
