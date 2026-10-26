import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useProfile } from "../hooks/useProfile";
import { useThemeStore } from "../state/stores/themeStore";
import Icon from "./Icon";

const NAV_ITEMS = [
  { to: "/",          icon: "home"      as const, label: "היום"    },
  { to: "/weekly",    icon: "calendar"  as const, label: "שבועי"   },
  { to: "/tasks",     icon: "tasks"     as const, label: "משימות"  },
  { to: "/inventory", icon: "inventory" as const, label: "קניות"   },
  { to: "/baby",      icon: "babies"    as const, label: "תינוקות" },
  { to: "/finance",   icon: "finance"   as const, label: "כספים"   },
  { to: "/assistant", icon: "chat"      as const, label: "צ'אט"    },
] as const;

/** Mobile tab bar shows these directly; the rest live in the "עוד" sheet */
const MOBILE_PRIMARY = ["/", "/tasks", "/inventory", "/baby"] as const;
const MOBILE_TABS = NAV_ITEMS.filter(item => (MOBILE_PRIMARY as readonly string[]).includes(item.to));
const MOBILE_MORE = NAV_ITEMS.filter(item => !(MOBILE_PRIMARY as readonly string[]).includes(item.to));

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { menuBg, appBg, appName } = useThemeStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Desktop sidebar collapse / mobile "more" sheet
  const [collapsed, setCollapsed]     = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);

  // Close the sheet on route change and start each page at the top
  useEffect(() => {
    setMobileOpen(false);
    document.getElementById("app-main")?.scrollTo({ top: 0 });
  }, [pathname]);

  const moreActive = pathname === "/settings" || MOBILE_MORE.some(item => pathname.startsWith(item.to));
  const currentLabel = [...NAV_ITEMS, { to: "/settings", label: "הגדרות" }].find(item =>
    item.to === "/" ? pathname === "/" : pathname.startsWith(item.to)
  )?.label;

  // Menu colors come from CSS vars computed against menuBg (src/lib/themeVars.ts)
  const menuText      = "text-[color:var(--menu-text)]";
  const menuTextMuted = "text-[color:var(--menu-muted)]";
  const menuBorder    = "border-[color:var(--menu-border)]";
  const menuHover     = "hover:bg-[color:var(--menu-hover)] hover:text-[color:var(--menu-strong)]";
  const menuActive    = "bg-accent-600 text-white";
  const titleColor    = "text-[color:var(--menu-accent)]";
  const menuAccent    = "text-[color:var(--menu-accent)]";

  const handleSignOut = async () => {
    setMobileOpen(false);
    await signOut();
    navigate("/login");
  };

  /** Desktop sidebar nav link list */
  const NavList = () => (
    <>
      {NAV_ITEMS.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          title={collapsed ? item.label : undefined}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg font-medium transition-colors
             ${collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5 text-sm"}
             ${isActive ? menuActive : `${menuText} ${menuHover}`}`
          }
        >
          <Icon name={item.icon} className="w-5 h-5 shrink-0" />
          {!collapsed && <span>{item.label}</span>}
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
      <header
        className={`md:hidden fixed top-0 inset-x-0 z-40 border-b pt-safe ${menuBorder}`}
        style={{ backgroundColor: menuBg }}
      >
        <div className="flex items-center justify-between gap-3 px-4 h-14">
          <div className="min-w-0 flex items-baseline gap-2">
            <h1 className={`text-lg font-bold shrink-0 ${titleColor}`}>{appName}</h1>
            {currentLabel && pathname !== "/" && (
              <span className={`text-sm truncate ${menuTextMuted}`}>· {currentLabel}</span>
            )}
          </div>

          {/* Settings shortcut */}
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `-me-2 p-2.5 rounded-xl transition-colors ${isActive ? menuAccent : `${menuTextMuted} ${menuHover}`}`
            }
            aria-label="הגדרות"
          >
            <Icon name="settings" className="w-5 h-5" />
          </NavLink>
        </div>
      </header>

      {/* ════════════════════════════════════════
          MOBILE "MORE" SHEET
      ════════════════════════════════════════ */}
      {mobileOpen && (
        <div className="md:hidden modal-overlay" onClick={() => setMobileOpen(false)}>
          <div
            className={`modal-panel ${menuBorder}`}
            style={{ backgroundColor: menuBg }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-label="תפריט נוסף"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="min-w-0">
                <h2 className={`text-lg font-bold ${titleColor}`}>{appName}</h2>
                <p className={`text-xs truncate mt-0.5 ${menuTextMuted}`}>{profile?.display_name ?? user?.email ?? ""}</p>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className={`shrink-0 -me-2 p-2.5 rounded-xl transition-colors ${menuTextMuted} ${menuHover}`}
                aria-label="סגור"
              >
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[...MOBILE_MORE, { to: "/settings", icon: "settings" as const, label: "הגדרות" }].map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center gap-1.5 rounded-2xl border py-4 text-sm font-medium transition-colors
                     ${isActive ? `${menuActive} border-transparent` : `${menuText} ${menuBorder} ${menuHover}`}`
                  }
                >
                  <Icon name={item.icon} className="w-6 h-6" />
                  {item.label}
                </NavLink>
              ))}
            </div>

            <button
              onClick={handleSignOut}
              className={`mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm transition-colors ${menuBorder} ${menuTextMuted} ${menuHover}`}
            >
              <Icon name="logout" className="w-5 h-5" /> התנתק
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          MAIN CONTENT
      ════════════════════════════════════════ */}
      <main id="app-main" className="app-main flex-1 overflow-y-auto">
        <div className="px-3 pt-4 pb-6 sm:px-4 md:p-6 max-w-6xl mx-auto">{children}</div>
      </main>

      {/* ════════════════════════════════════════
          MOBILE BOTTOM NAVIGATION
      ════════════════════════════════════════ */}
      <nav
        className={`md:hidden fixed bottom-0 inset-x-0 z-40 border-t pb-safe ${menuBorder}`}
        style={{ backgroundColor: menuBg }}
        aria-label="ניווט ראשי"
      >
        <div className="flex h-16">
          {MOBILE_TABS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-1 min-w-0 transition-colors
                 ${isActive ? menuAccent : menuTextMuted}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`flex items-center justify-center w-14 h-8 rounded-full transition-colors ${isActive ? "bg-accent-500/15" : ""}`}>
                    <Icon name={item.icon} className="w-6 h-6 shrink-0" />
                  </span>
                  <span className={`text-[11px] leading-none truncate max-w-full px-0.5 ${isActive ? "font-semibold" : "font-medium"}`}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 min-w-0 transition-colors
              ${moreActive || mobileOpen ? menuAccent : menuTextMuted}`}
            aria-label="עוד"
            aria-expanded={mobileOpen}
          >
            <span className={`flex items-center justify-center w-14 h-8 rounded-full transition-colors ${moreActive ? "bg-accent-500/15" : ""}`}>
              <Icon name="more" className="w-6 h-6 shrink-0" />
            </span>
            <span className={`text-[11px] leading-none ${moreActive ? "font-semibold" : "font-medium"}`}>עוד</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
