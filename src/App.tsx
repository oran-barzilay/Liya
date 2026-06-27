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

function hexToRgb(hex: string) {
  const cleaned = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  const r = Number.parseInt(cleaned.slice(0, 2), 16);
  const g = Number.parseInt(cleaned.slice(2, 4), 16);
  const b = Number.parseInt(cleaned.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

function AppRoutes() {
  const { user, loading: authLoading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { accentColor, accentCustom, appBg, menuBg, textPrimary, textMuted } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-accent", accentColor);
    root.style.setProperty("--app-bg", appBg);
    root.style.setProperty("--menu-bg", menuBg);
    root.style.setProperty("--text-primary", textPrimary);
    root.style.setProperty("--text-muted", textMuted);
    if (accentColor === "custom") {
      const rgb = hexToRgb(accentCustom);
      if (rgb) {
        root.style.setProperty("--accent-300", rgb);
        root.style.setProperty("--accent-400", rgb);
        root.style.setProperty("--accent-500", rgb);
        root.style.setProperty("--accent-600", rgb);
        root.style.setProperty("--accent-700", rgb);
        root.style.setProperty("--accent-800", rgb);
        root.style.setProperty("--accent-900", rgb);
        root.style.setProperty("--accent-950", rgb);
      }
    }
  }, [accentColor, accentCustom, appBg, menuBg, textPrimary, textMuted]);

  if (authLoading || (user && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: appBg }}>
        <div className="text-sm animate-pulse" style={{ color: textMuted }}>טוען...</div>
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
