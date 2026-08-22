import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useProfile } from "../hooks/useProfile";
import { useThemeStore, getContrastColor } from "../state/stores/themeStore";
import Icon from "./Icon";

const NAV_ITEMS = [
  { to: "/",         icon: "home"     as const, label: "היום"     },
  { to: "/tasks",    icon: "tasks"    as const, label: "משימות"  },
  { to: "/inventory",icon: "inventory"as const, label: "קניות"   },
  { to: "/baby",     icon: "babies"   as const, label: "תינוקות" },
  { to: "/finance",  icon: "finance"  as const, label: "כספים"   },
] as const;

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { menuBg, appBg, accentCustom, accentColor, appName } = useThemeStore();
  const navigate = useNavigate();

  // Desktop sidebar collapse / mobile overlay
  const [collapsed, setCollapsed]     = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);

  const menuContrast    = getContrastColor(menuBg);
  const accentHex       = accentColor === "custom" ? accentCustom
    : ({ indigo:"#4f46e5", purple:"#9333ea", blue:"#2563eb", emerald:"#059669", rose:"#e11d48", amber:"#d97706" } as Record<string,string>)[accentColor] ?? "#4f46e5";
  const accentContrast  = getContrastColor(accentHex);
  const activeTextColor = accentContrast === "dark" ? "text-slate-900" : "text-white";

  const menuText      = menuContrast === "dark" ? "text-slate-700"  : "text-slate-300";
  const menuTextMuted = menuContrast === "dark" ? "text-slate-500"  : "text-slate-400";
  const menuBorder    = menuContrast === "dark" ? "border-slate-200": "border-slate-800";
  const menuHover     = menuContrast === "dark"
    ? "hover:bg-slate-200 hover:text-slate-900"
    : "hover:bg-slate-800 hover:text-white";
  const menuActive    = `bg-accent-600 ${activeTextColor}`;
  const titleColor    = "text-accent-400";

  const handleSignOut = async () => {
    setMobileOpen(false);
    await signOut();
    navigate("/login");
  };

  /** Shared nav link list used in both desktop sidebar and mobile overlay */
  const NavList = ({ big = false, onNavigate }: { big?: boolean; onNavigate?: () => void }) => (
    <>
      {NAV_ITEMS.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg font-medium transition-colors
             ${big ? "px-4 py-3 text-sm" : collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5 text-sm"}
             ${isActive ? menuActive : `${menuText} ${menuHover}`}`
          }
        >
          <Icon name={item.icon} className={big ? "w-5 h-5 shrink-0" : "w-5 h-5 shrink-0"} />
          {(!collapsed || big) && <span>{item.label}</span>}
        </NavLink>
      ))}
    </>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden" style={{ backgroundColor: appBg, color: "var(--text-primary)" }}>

      {/* ════════════════════════════════════════
          DESKTOP SIDEBAR
      ════════════════════════════════════════ */}
      <aside
        className={`hidden md:flex flex-col border-s ${menuBorder} shrink-0 transition-all duration-200
                    ${collapsed ? "w-[3.75rem]" : "w-56"}`}
        style={{ backgroundColor: menuBg }}
      >
        {/* Header + collapse toggle */}
        <div className={`flex items-center border-b ${menuBorder} ${collapsed ? "justify-center py-4 px-2" : "justify-between px-4 py-4"}`}>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className={`text-xl font-bold leading-tight ${titleColor}`}>{appName}</h1>
              <p className={`text-xs truncate mt-0.5 ${menuTextMuted}`}>{profile?.display_name ?? user?.email ?? ""}</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? "הרחב תפריט" : "כווץ תפריט"}
            className={`shrink-0 p-1.5 rounded-lg transition-colors ${menuTextMuted} ${menuHover}`}
          >
            <Icon name={collapsed ? "chevron-left" : "chevron-right"} className="w-4 h-4" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
          <NavList />
        </nav>

        {/* Settings + Logout */}
        <div className={`px-2 py-2 border-t ${menuBorder} space-y-0.5`}>
          <NavLink
            to="/settings"
            title={collapsed ? "הגדרות" : undefined}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg text-sm transition-colors
               ${collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2"}
               ${isActive ? menuActive : `${menuTextMuted} ${menuHover}`}`
            }
          >
            <Icon name="settings" className="w-4 h-4 shrink-0" />
            {!collapsed && "הגדרות"}
          </NavLink>
          <button
            onClick={handleSignOut}
            title={collapsed ? "התנתק" : undefined}
            className={`w-full flex items-center gap-2 rounded-lg text-sm transition-colors
              ${collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2"}
              ${menuTextMuted} ${menuHover}`}
          >
            <Icon name="logout" className="w-4 h-4 shrink-0" />
            {!collapsed && "התנתק"}
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════════════
          MOBILE TOP BAR
      ════════════════════════════════════════ */}
      <div
        className={`md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 h-14 border-b ${menuBorder}`}
        style={{ backgroundColor: menuBg }}
      >
        {/* Hamburger */}
        <button
          onClick={() => setMobileOpen(true)}
          className={`p-2 rounded-lg transition-colors ${menuTextMuted} ${menuHover}`}
          aria-label="פתח תפריט"
        >
          <Icon name="menu" className="w-6 h-6" />
        </button>

        <h1 className={`text-lg font-bold ${titleColor}`}>{appName}</h1>

        {/* Settings shortcut */}
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `p-2 rounded-lg transition-colors ${isActive ? `text-accent-400` : `${menuTextMuted} ${menuHover}`}`
          }
          aria-label="הגדרות"
        >
          <Icon name="settings" className="w-5 h-5" />
        </NavLink>
      </div>

      {/* ════════════════════════════════════════
          MOBILE OVERLAY SIDEBAR
      ════════════════════════════════════════ */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          {/* Drawer panel — slides in from the inline-end side (right in RTL) */}
          <aside
            className={`relative z-10 flex flex-col w-72 ms-auto border-s ${menuBorder}`}
            style={{ backgroundColor: menuBg }}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-5 py-4 border-b ${menuBorder}`}>
              <div className="min-w-0">
                <h1 className={`text-xl font-bold ${titleColor}`}>{appName}</h1>
                <p className={`text-xs truncate mt-0.5 ${menuTextMuted}`}>{profile?.display_name ?? user?.email ?? ""}</p>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className={`shrink-0 p-1.5 rounded-lg transition-colors ${menuTextMuted} ${menuHover}`}
              >
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 py-3 space-y-0.5 px-3 overflow-y-auto">
              <NavList big onNavigate={() => setMobileOpen(false)} />
            </nav>

            {/* Settings + Logout */}
            <div className={`px-3 py-3 border-t ${menuBorder} space-y-0.5`}>
              <NavLink
                to="/settings"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors
                   ${isActive ? menuActive : `${menuTextMuted} ${menuHover}`}`
                }
              >
                <Icon name="settings" className="w-5 h-5" /> הגדרות
              </NavLink>
              <button
                onClick={handleSignOut}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${menuTextMuted} ${menuHover}`}
              >
                <Icon name="logout" className="w-5 h-5" /> התנתק
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ════════════════════════════════════════
          MAIN CONTENT
      ════════════════════════════════════════ */}
      <main className="flex-1 overflow-y-auto pt-14 pb-16 md:pt-0 md:pb-0">
        <div className="p-4 md:p-6 max-w-6xl mx-auto">{children}</div>
      </main>

      {/* ════════════════════════════════════════
          MOBILE BOTTOM NAVIGATION
      ════════════════════════════════════════ */}
      <nav
        className={`md:hidden fixed bottom-0 inset-x-0 z-40 flex border-t ${menuBorder}`}
        style={{ backgroundColor: menuBg }}
      >
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors
               ${isActive ? "text-accent-400" : menuTextMuted}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon name={item.icon} className={`w-5 h-5 ${isActive ? "text-accent-400" : ""}`} />
                <span className="text-[9px] font-medium leading-tight">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
