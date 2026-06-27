import { useState } from "react";
import { useThemeStore, ACCENT_OPTIONS, THEME_PRESETS, getContrastColor } from "../state/stores/themeStore";
import { useProfile } from "../hooks/useProfile";
import { useChildren } from "../hooks/useBaby";
import Icon from "../components/Icon";

export default function Settings() {
  const {
    appName,
    setAppName,
    accentColor,
    setAccentColor,
    accentCustom,
    setAccentCustom,
    menuBg,
    setMenuBg,
    appBg,
    setAppBg,
    textPrimary,
    setTextPrimary,
    textMuted,
    setTextMuted,
    favoritePalettes,
    saveCurrentPalette,
    applyPalette,
    removePalette,
  } = useThemeStore();
  const { data: profile } = useProfile();
  const { data: children = [], addChild, deleteChild } = useChildren();
  const [paletteName, setPaletteName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(appName);
  const [newChildName, setNewChildName] = useState("");
  const [newChildBirth, setNewChildBirth] = useState("");
  const [pendingDeleteChild, setPendingDeleteChild] = useState<Record<string, any> | null>(null);

  // Warn if text on background has low contrast
  const appContrast = getContrastColor(appBg);
  const textLum = getContrastColor(textPrimary);
  const textOnBgWarning = (appContrast === "dark" && textLum === "dark") || (appContrast === "light" && textLum === "light");

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-theme">הגדרות</h2>
        <p className="text-theme-muted text-sm mt-1">התאמה אישית של האפליקציה</p>
      </div>

      {/* Theme presets section */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-5">
        <h3 className="text-base font-semibold mb-1 text-theme flex items-center gap-2">
          <Icon name="palette" className="w-4 h-4 text-accent-400" /> ערכות צבעים מוכנות
        </h3>
        <p className="text-theme-muted text-xs mb-4">בחר ערכת צבעים מוכנה עם שליטה מלאה בטקסט ורקע</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
          {THEME_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => applyPalette(preset)}
              className="group relative border border-slate-700 rounded-xl p-3 hover:border-accent-500 transition-all text-start"
            >
              <div className="flex gap-1 mb-2">
                <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: preset.accentCustom }} />
                <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: preset.appBg }} />
                <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: preset.menuBg }} />
              </div>
              <div className="text-xs font-medium" style={{ color: preset.textPrimary }}>{preset.name}</div>
              {/* Preview stripe */}
              <div className="mt-2 h-6 rounded-md flex overflow-hidden border border-white/10">
                <div className="w-1/3" style={{ backgroundColor: preset.menuBg }} />
                <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: preset.appBg }}>
                  <span className="text-[8px] font-medium" style={{ color: preset.textPrimary }}>Aa</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Manual color tuning */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-5">
        <h3 className="text-base font-semibold mb-1 text-theme">כיוונון צבעים ידני</h3>
        <p className="text-theme-muted text-xs mb-5">צבע ראשי, רקעים וצבעי טקסט</p>

        {textOnBgWarning && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-amber-950/50 border border-amber-700">
            <Icon name="warning" className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs text-amber-300">אזהרה: צבע הטקסט הנוכחי עלול להיות בלתי קריא על הרקע הנבחר. כדאי לשנות את צבע הטקסט או הרקע.</span>
          </div>
        )}

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
          {ACCENT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setAccentColor(opt.id)}
              className={
                "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all " +
                (accentColor === opt.id
                  ? "border-accent-400 bg-slate-800 scale-105"
                  : "border-slate-700 hover:border-slate-500 hover:bg-slate-800/50")
              }
            >
              <div className="w-8 h-8 rounded-full shadow-md" style={{ backgroundColor: opt.swatch }} />
              <span className="text-xs text-theme-muted font-medium">{opt.label}</span>
              {accentColor === opt.id && <Icon name="check" className="w-3 h-3 text-accent-400" />}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <label className="text-xs text-theme-muted">
            צבע ראשי מותאם
            <input
              type="color"
              value={accentCustom}
              onChange={(e) => setAccentCustom(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg bg-slate-800 border border-slate-700 cursor-pointer"
            />
          </label>
          <label className="text-xs text-theme-muted">
            רקע תפריט ימני
            <input
              type="color"
              value={menuBg}
              onChange={(e) => setMenuBg(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg bg-slate-800 border border-slate-700 cursor-pointer"
            />
          </label>
          <label className="text-xs text-theme-muted">
            רקע אפליקציה
            <input
              type="color"
              value={appBg}
              onChange={(e) => setAppBg(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg bg-slate-800 border border-slate-700 cursor-pointer"
            />
          </label>
        </div>

        {/* Text color controls */}
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <label className="text-xs text-theme-muted">
            צבע טקסט ראשי
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                value={textPrimary}
                onChange={(e) => setTextPrimary(e.target.value)}
                className="h-10 w-full rounded-lg bg-slate-800 border border-slate-700 cursor-pointer"
              />
              <div className="h-10 px-3 rounded-lg border border-slate-700 flex items-center" style={{ backgroundColor: appBg }}>
                <span className="text-sm font-medium" style={{ color: textPrimary }}>דוגמה</span>
              </div>
            </div>
          </label>
          <label className="text-xs text-theme-muted">
            צבע טקסט משני
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                value={textMuted}
                onChange={(e) => setTextMuted(e.target.value)}
                className="h-10 w-full rounded-lg bg-slate-800 border border-slate-700 cursor-pointer"
              />
              <div className="h-10 px-3 rounded-lg border border-slate-700 flex items-center" style={{ backgroundColor: appBg }}>
                <span className="text-sm" style={{ color: textMuted }}>דוגמה</span>
              </div>
            </div>
          </label>
        </div>

        {/* Save palette */}
        <div className="mt-4 flex items-center gap-2">
          <input
            value={paletteName}
            onChange={(e) => setPaletteName(e.target.value)}
            placeholder="שם ערכת הצבעים..."
            className="input-base text-xs py-2 w-40"
          />
          <button
            onClick={() => { saveCurrentPalette(paletteName); setPaletteName(""); }}
            className="bg-accent-600 hover:bg-accent-500 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Icon name="star" className="w-3 h-3" /> שמור למועדפים
          </button>
          {accentColor === "custom" && <span className="text-xs text-accent-300">מצב צבע מותאם פעיל</span>}
        </div>

        {favoritePalettes.length > 0 && (
          <div className="mt-5">
            <p className="text-xs text-theme-muted mb-2">ערכות צבעים שמורות</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {favoritePalettes.map((palette, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg p-2.5">
                  <div className="flex gap-1">
                    <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: palette.accentCustom }} />
                    <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: palette.menuBg }} />
                    <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: palette.appBg }} />
                    <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: palette.textPrimary }} />
                  </div>
                  <span className="text-xs text-theme-muted flex-1 truncate">{palette.name || `ערכה #${idx + 1}`}</span>
                  <button
                    onClick={() => applyPalette(palette)}
                    className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-theme"
                  >
                    החל
                  </button>
                  <button
                    onClick={() => removePalette(idx)}
                    className="text-xs px-2 py-1 rounded bg-red-900/70 hover:bg-red-800 text-red-200"
                  >
                    <Icon name="trash" className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-5">
        <h3 className="text-base font-semibold mb-4 text-theme flex items-center gap-2">
          <Icon name="home" className="w-4 h-4 text-accent-400" /> כללי
        </h3>
        <div className="space-y-4">
          {/* App name */}
          <div className="flex items-center justify-between py-2 border-b border-slate-800">
            <span className="text-sm text-theme-muted">שם האפליקציה (תצוגה)</span>
            {editingName ? (
              <div className="flex items-center gap-2">
                <input value={nameInput} onChange={e => setNameInput(e.target.value)} className="input-base text-sm py-1 w-32" autoFocus />
                <button onClick={() => { setAppName(nameInput); setEditingName(false); }} className="text-xs px-2 py-1 rounded bg-accent-600 text-white hover:bg-accent-500">שמור</button>
                <button onClick={() => { setNameInput(appName); setEditingName(false); }} className="text-xs px-2 py-1 rounded bg-slate-700 text-theme-muted hover:bg-slate-600">ביטול</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-theme font-medium">{appName}</span>
                <button onClick={() => setEditingName(true)} className="text-theme-muted hover:text-accent-400"><Icon name="edit" className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Baby management */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-5">
        <h3 className="text-base font-semibold mb-4 text-theme flex items-center gap-2">
          <Icon name="babies" className="w-4 h-4 text-accent-400" /> ניהול תינוקות
        </h3>
        {children.length > 0 && (
          <div className="space-y-2 mb-4">
            {children.map(child => (
              <div key={child.id} className="flex items-center justify-between py-2 px-3 bg-slate-800 rounded-lg">
                <div>
                  <span className="text-sm text-theme font-medium">{child.name}</span>
                  {child.birth_date && <span className="text-xs text-theme-muted mr-2"> · {new Date(child.birth_date).toLocaleDateString("he-IL")}</span>}
                </div>
                <button onClick={() => setPendingDeleteChild(child)} className="text-theme-muted hover:text-red-400 transition-colors">
                  <Icon name="trash" className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {children.length === 0 && <p className="text-sm text-theme-muted mb-4">לא הוספו תינוקות עדיין.</p>}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs text-theme-muted block mb-1">שם</label>
            <input value={newChildName} onChange={e => setNewChildName(e.target.value)} className="input-base w-full" placeholder="לילה" />
          </div>
          <div>
            <label className="text-xs text-theme-muted block mb-1">תאריך לידה</label>
            <input type="date" value={newChildBirth} onChange={e => setNewChildBirth(e.target.value)} className="input-base" />
          </div>
          <button
            disabled={!newChildName || !newChildBirth}
            onClick={() => { addChild.mutate({ name: newChildName, birth_date: newChildBirth }); setNewChildName(""); setNewChildBirth(""); }}
            className="bg-accent-600 hover:bg-accent-500 disabled:opacity-40 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
          >
            <Icon name="plus" className="w-3.5 h-3.5" /> הוסף
          </button>
        </div>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-5">
        <h3 className="text-base font-semibold mb-4 text-theme">פרטי משתמש</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-slate-800">
            <span className="text-theme-muted">שם תצוגה</span>
            <span className="text-theme font-medium">{profile?.display_name}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-800">
            <span className="text-theme-muted">תפקיד</span>
            <span className="text-theme">{profile?.role === "owner" ? "בעל הבית" : "חבר"}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-theme-muted">מזהה בית</span>
            <code className="text-xs text-theme-muted font-mono">{profile?.household_id?.slice(0, 8)}...</code>
          </div>
        </div>
      </section>

      {/* Delete child confirmation */}
      {pendingDeleteChild && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="warning" className="w-5 h-5 text-red-400" />
              <h3 className="text-base font-semibold text-theme">למחוק את {pendingDeleteChild.name}?</h3>
            </div>
            <p className="text-sm text-theme-muted mt-1">כל הנתונים של תינוק/ת זו יימחקו לצמיתות.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setPendingDeleteChild(null)} className="px-3 py-2 rounded-lg text-sm bg-slate-800 text-theme-muted hover:bg-slate-700">ביטול</button>
              <button onClick={() => { deleteChild.mutate(pendingDeleteChild.id); setPendingDeleteChild(null); }}
                className="px-3 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-500">מחיקה</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
