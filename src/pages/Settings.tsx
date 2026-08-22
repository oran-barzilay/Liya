import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useThemeStore, ACCENT_OPTIONS, THEME_PRESETS, getContrastColor } from "../state/stores/themeStore";
import { useProfile } from "../hooks/useProfile";
import { useChildren } from "../hooks/useBaby";
import Icon from "../components/Icon";
import AppCalendar from "../components/AppCalendar";
import { supabase } from "../lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { TIMEZONE_OPTIONS, usePreferencesStore } from "../state/stores/preferencesStore";

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
  const { timeZone, setTimeZone } = usePreferencesStore();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const { data: children = [], addChild, deleteChild } = useChildren();
  const [searchParams] = useSearchParams();
  const changePasswordMode = searchParams.get("change-password") === "1";

  const [paletteName, setPaletteName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(appName);
  const [newChildName, setNewChildName] = useState("");
  const [newChildBirth, setNewChildBirth] = useState("");
  const [pendingDeleteChild, setPendingDeleteChild] = useState<Record<string, any> | null>(null);

  // Change password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError("");
    if (newPassword !== confirmPwd) { setPwdError("הסיסמאות אינן תואמות"); return; }
    if (newPassword.length < 6) { setPwdError("הסיסמה חייבת להיות לפחות 6 תווים"); return; }
    setPwdLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPwdSuccess(true);
      setNewPassword("");
      setConfirmPwd("");
      setTimeout(() => setPwdSuccess(false), 4000);
    } catch (err: unknown) {
      setPwdError(err instanceof Error ? err.message : "שגיאה בעדכון הסיסמה");
    } finally {
      setPwdLoading(false);
    }
  };

  // Household ID copy
  const [copied, setCopied] = useState(false);
  const copyHouseholdId = () => {
    if (!profile?.household_id) return;
    navigator.clipboard.writeText(profile.household_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Change household
  const [showChangeHousehold, setShowChangeHousehold] = useState(false);
  const [newHouseholdId, setNewHouseholdId] = useState("");
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeError, setChangeError] = useState("");
  const [changeSuccess, setChangeSuccess] = useState(false);
  const [customTimeZone, setCustomTimeZone] = useState("");

  const handleChangeHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newHouseholdId.trim()) return;
    setChangeLoading(true);
    setChangeError("");
    setChangeSuccess(false);
    try {
      const { error } = await supabase.rpc("change_household", {
        p_household_id: newHouseholdId.trim(),
      });
      if (error) throw error;
      setChangeSuccess(true);
      setNewHouseholdId("");
      setShowChangeHousehold(false);
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      // Invalidate all household-scoped queries
      qc.invalidateQueries();
    } catch (err: unknown) {
      let msg = "שגיאה בשינוי הבית";
      if (err && typeof err === "object") {
        // @ts-ignore
        msg = err.message || err.details || JSON.stringify(err);
      }
      setChangeError(msg);
    } finally {
      setChangeLoading(false);
    }
  };

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

          <div className="py-2 border-b border-slate-800">
            <label className="text-sm text-theme-muted block mb-1">אזור זמן לאפליקציה</label>
            <p className="text-xs text-theme-muted opacity-80 mb-2">
              אזור זמן משפיע על כל ממשקי השעה והתאריכים. ברירת המחדל היא ישראל.
            </p>
            <select
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value)}
              className="input-base w-full text-sm"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
            <div className="flex gap-2 mt-2">
              <input
                value={customTimeZone}
                onChange={(e) => setCustomTimeZone(e.target.value)}
                placeholder="לדוגמה: Asia/Jerusalem"
                className="input-base flex-1 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (customTimeZone.trim()) {
                    setTimeZone(customTimeZone.trim());
                    setCustomTimeZone("");
                  }
                }}
                className="text-xs px-3 py-2 rounded-lg bg-slate-800 text-theme-muted hover:bg-slate-700"
              >
                החל מותאם
              </button>
            </div>
            <p className="text-[11px] text-theme-muted mt-1 opacity-70">הגדרה נוכחית: {timeZone}</p>
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
            <AppCalendar value={newChildBirth} onChange={setNewChildBirth} placeholder="בחר תאריך" />
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
          {/* Household ID – full, copyable */}
          <div className="py-2 border-b border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-theme-muted">מזהה בית</span>
              <button
                onClick={copyHouseholdId}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-theme-muted hover:text-theme transition-colors"
                title="העתק מזהה בית"
              >
                <Icon name={copied ? "check" : "copy"} className="w-3 h-3" />
                {copied ? "הועתק!" : "העתק"}
              </button>
            </div>
            <code className="block text-xs text-theme-muted font-mono break-all select-all bg-slate-800 rounded px-2 py-1.5 mt-1">
              {profile?.household_id ?? "—"}
            </code>
            <p className="text-xs text-theme-muted mt-1.5">שתף מזהה זה עם בני הבית שלך כדי שיוכלו להצטרף.</p>
          </div>

          {/* Change household */}
          <div className="py-2">
            {changeSuccess && (
              <p className="text-green-400 text-xs bg-green-950/50 border border-green-800 rounded-lg px-3 py-2 mb-2 flex items-center gap-2">
                <Icon name="check" className="w-3.5 h-3.5 shrink-0" /> הבית עודכן בהצלחה!
              </p>
            )}
            {!showChangeHousehold ? (
              <button
                onClick={() => { setShowChangeHousehold(true); setChangeError(""); setChangeSuccess(false); }}
                className="flex items-center gap-1.5 text-xs text-accent-400 hover:text-accent-300 transition-colors"
              >
                <Icon name="link" className="w-3.5 h-3.5" /> הצטרף לבית אחר / שנה בית
              </button>
            ) : (
              <form onSubmit={handleChangeHousehold} className="space-y-2 mt-1">
                <label className="text-xs text-theme-muted block">מזהה הבית החדש</label>
                <input
                  type="text"
                  value={newHouseholdId}
                  onChange={e => setNewHouseholdId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="input-base w-full font-mono text-xs"
                  required
                />
                {changeError && (
                  <p className="text-red-400 text-xs bg-red-950/50 border border-red-800 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
                    <Icon name="warning" className="w-3.5 h-3.5 shrink-0" /> {changeError}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={changeLoading || !newHouseholdId.trim()}
                    className="bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {changeLoading ? "מעדכן…" : "עבור לבית"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowChangeHousehold(false); setChangeError(""); setNewHouseholdId(""); }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-theme-muted hover:bg-slate-700"
                  >
                    ביטול
                  </button>
                </div>
              </form>
            )}
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

      {/* Change Password */}
      <section
        id="change-password-section"
        className={"bg-slate-900 border rounded-2xl p-6 mb-5 transition-all " + (changePasswordMode ? "border-accent-600 shadow-lg shadow-accent-900/20" : "border-slate-800")}
      >
        <h3 className="text-base font-semibold mb-1 text-theme flex items-center gap-2">
          <Icon name="lock" className="w-4 h-4 text-accent-400" /> שינוי סיסמה
        </h3>
        {changePasswordMode && (
          <p className="text-xs text-accent-300 mb-4 bg-accent-950/40 border border-accent-800 rounded-lg px-3 py-2 flex items-center gap-2">
            <Icon name="check" className="w-3.5 h-3.5 shrink-0" /> הגעת דרך קישור איפוס סיסמה. הזן את סיסמתך החדשה כאן.
          </p>
        )}
        <form onSubmit={handleChangePassword} className="space-y-3 mt-3">
          <div>
            <label className="text-xs text-theme-muted block mb-1">סיסמה חדשה</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="לפחות 6 תווים"
              minLength={6}
              className="input-base w-full"
            />
          </div>
          <div>
            <label className="text-xs text-theme-muted block mb-1">אימות סיסמה</label>
            <input
              type="password"
              value={confirmPwd}
              onChange={e => setConfirmPwd(e.target.value)}
              placeholder="••••••••"
              className="input-base w-full"
            />
          </div>
          {pwdError && (
            <p className="text-red-400 text-xs bg-red-950/50 border border-red-800 rounded-lg px-3 py-2 flex items-center gap-2">
              <Icon name="warning" className="w-3.5 h-3.5 shrink-0" /> {pwdError}
            </p>
          )}
          {pwdSuccess && (
            <p className="text-emerald-400 text-xs bg-emerald-950/50 border border-emerald-800 rounded-lg px-3 py-2 flex items-center gap-2">
              <Icon name="check" className="w-3.5 h-3.5 shrink-0" /> הסיסמה עודכנה בהצלחה!
            </p>
          )}
          <button
            type="submit"
            disabled={pwdLoading || !newPassword}
            className="bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Icon name="lock" className="w-3.5 h-3.5" />
            {pwdLoading ? "מעדכן…" : "שמור סיסמה"}
          </button>
        </form>
      </section>
    </div>
  );
}
