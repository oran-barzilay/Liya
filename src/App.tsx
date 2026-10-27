import { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { useProfile } from "./hooks/useProfile";
import { useThemeStore } from "./state/stores/themeStore";
import { useResolvedTheme } from "./lib/themeVars";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Setup from "./pages/Setup";
import Dashboard from "./pages/Dashboard";
import Weekly from "./pages/Weekly";
import Assistant from "./pages/Assistant";
import Tasks from "./pages/Tasks";
import Inventory from "./pages/Inventory";
import Baby from "./pages/Baby";
import Finance from "./pages/Finance";
import Settings from "./pages/Settings";
import Trips from "./pages/Trips";
import TripDetail from "./pages/TripDetail";

function AppRoutes() {
  const { user, loading: authLoading, isRecovery, clearRecovery } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { appBg, menuBg } = useThemeStore();
  const theme = useResolvedTheme();
  const textMuted = theme.textMuted;
  const navigate = useNavigate();

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-surface", theme.surface);
    for (const [name, value] of Object.entries(theme.vars)) root.style.setProperty(name, value);
    // Match the mobile browser / status bar to the app chrome
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", menuBg);
  }, [theme, menuBg]);

  // When arriving via a password-recovery email link, redirect to Settings
  // where the user can change their password in-app.
  useEffect(() => {
    if (user && isRecovery && profile) {
      clearRecovery();
      navigate("/settings?change-password=1", { replace: true });
    }
  }, [user, isRecovery, profile, clearRecovery, navigate]);

  if (authLoading || (user && profileLoading)) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ backgroundColor: appBg }}>
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
        <Route path="/weekly" element={<Weekly />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/baby" element={<Baby />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/trips" element={<Trips />} />
        <Route path="/trips/:tripId" element={<TripDetail />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return <AppRoutes />;
}
