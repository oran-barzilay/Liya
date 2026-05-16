import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { useProfile } from "./hooks/useProfile";
import { useThemeStore } from "./state/stores/themeStore";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Setup from "./pages/Setup";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Inventory from "./pages/Inventory";
import Baby from "./pages/Baby";
import Finance from "./pages/Finance";
import Settings from "./pages/Settings";

function AppRoutes() {
  const { user, loading: authLoading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { accentColor } = useThemeStore();

  useEffect(() => {
    document.documentElement.setAttribute("data-accent", accentColor);
  }, [accentColor]);

  if (authLoading || (user && profileLoading)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">טוען…</div>
      </div>
    );
  }

  if (!user) return <Login />;
  if (!profile) return <Setup />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/baby" element={<Baby />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return <AppRoutes />;
}

