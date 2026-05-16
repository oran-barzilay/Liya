import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useProfile } from "../hooks/useProfile";

const NAV_ITEMS = [
  { to: "/",         icon: "🏠", label: "לוח בקרה" },
  { to: "/tasks",    icon: "✅", label: "משימות" },
  { to: "/inventory",icon: "📦", label: "מלאי" },
  { to: "/baby",     icon: "👶", label: "תינוקות" },
  { to: "/finance",  icon: "💰", label: "כספים" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Sidebar — appears on the right in RTL */}
      <aside className="w-56 flex flex-col bg-slate-900 border-s border-slate-800 shrink-0">
        <div className="px-5 py-5 border-b border-slate-800">
          <h1 className="text-2xl font-bold text-accent-400">Fami</h1>
          <p className="text-xs text-slate-400 mt-0.5 truncate">
            {profile?.display_name ?? user?.email ?? ""}
          </p>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-accent-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-slate-800 space-y-1">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? "bg-accent-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`
            }
          >
            <span>⚙️</span> הגדרות
          </NavLink>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <span>🚪</span> התנתק
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

