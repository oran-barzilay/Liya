import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useProfile } from "../hooks/useProfile";
import { useThemeStore, getContrastColor } from "../state/stores/themeStore";
import Icon from "./Icon";

const NAV_ITEMS = [
  { to: "/", icon: "home", label: "לוח בקרה" },
  { to: "/tasks", icon: "tasks", label: "משימות" },
  { to: "/inventory", icon: "inventory", label: "מלאי" },
  { to: "/baby", icon: "babies", label: "תינוקות" },
  { to: "/finance", icon: "finance", label: "כספים" },
] as const;

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { menuBg, appBg } = useThemeStore();
  const navigate = useNavigate();

  const menuContrast = getContrastColor(menuBg);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  // Dynamic classes based on contrast
  const menuText = menuContrast === "dark" ? "text-slate-700" : "text-slate-300";
  const menuTextMuted = menuContrast === "dark" ? "text-slate-500" : "text-slate-400";
  const menuBorder = menuContrast === "dark" ? "border-slate-200" : "border-slate-800";
  const menuHover = menuContrast === "dark" ? "hover:bg-slate-200 hover:text-slate-900" : "hover:bg-slate-800 hover:text-white";
  const menuActive = "bg-accent-600 text-white";
  const titleColor = "text-accent-400";

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: appBg, color: "var(--text-primary)" }}>
      {/* Sidebar — appears on the right in RTL */}
      <aside className={`w-56 flex flex-col border-s ${menuBorder} shrink-0`} style={{ backgroundColor: menuBg }}>
        <div className={`px-5 py-5 border-b ${menuBorder}`}>
          <h1 className={`text-2xl font-bold ${titleColor}`}>Fami</h1>
          <p className={`text-xs mt-0.5 truncate ${menuTextMuted}`}>{profile?.display_name ?? user?.email ?? ""}</p>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? menuActive : `${menuText} ${menuHover}`
                }`
              }
            >
              <Icon name={item.icon} className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className={`px-3 py-3 border-t ${menuBorder} space-y-1`}>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? menuActive : `${menuTextMuted} ${menuHover}`
              }`
            }
          >
            <Icon name="settings" className="w-4 h-4" /> הגדרות
          </NavLink>
          <button
            onClick={handleSignOut}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${menuTextMuted} ${menuHover}`}
          >
            <Icon name="logout" className="w-4 h-4" /> התנתק
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
