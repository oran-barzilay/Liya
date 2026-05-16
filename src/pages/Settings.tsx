import { useThemeStore, ACCENT_OPTIONS } from "../state/stores/themeStore";
import { useProfile } from "../hooks/useProfile";
export default function Settings() {
  const { accentColor, setAccentColor } = useThemeStore();
  const { data: profile } = useProfile();
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold">הגדרות</h2>
        <p className="text-slate-400 text-sm mt-1">התאמה אישית של האפליקציה</p>
      </div>
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-5">
        <h3 className="text-base font-semibold mb-1">🎨 צבע ראשי</h3>
        <p className="text-slate-400 text-xs mb-5">בחר את צבע הנושא של האפליקציה</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {ACCENT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setAccentColor(opt.id)}
              className={"flex flex-col items-center gap-2 p-3 rounded-xl border transition-all " + (
                accentColor === opt.id
                  ? "border-white bg-slate-800 scale-105"
                  : "border-slate-700 hover:border-slate-500 hover:bg-slate-800/50"
              )}
            >
              <div className="w-8 h-8 rounded-full shadow-md" style={{ backgroundColor: opt.swatch }} />
              <span className="text-xs text-slate-300 font-medium">{opt.label}</span>
              {accentColor === opt.id && <span className="text-xs text-white font-bold">✓</span>}
            </button>
          ))}
        </div>
        <div className="mt-5 p-4 rounded-xl bg-slate-800 border border-slate-700">
          <p className="text-xs text-slate-400 mb-3">תצוגה מקדימה</p>
          <div className="flex items-center gap-3 flex-wrap">
            <button className="bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">כפתור ראשי</button>
            <button className="bg-slate-700 text-accent-400 border border-accent-600 text-sm font-medium px-4 py-2 rounded-lg">כפתור משני</button>
            <span className="text-accent-400 text-sm font-medium">קישור</span>
            <div className="h-2 w-24 rounded-full bg-accent-600" />
          </div>
        </div>
      </section>
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-base font-semibold mb-4">👤 פרטי משתמש</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-slate-800">
            <span className="text-slate-400">שם תצוגה</span>
            <span className="text-white font-medium">{profile?.display_name}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-800">
            <span className="text-slate-400">תפקיד</span>
            <span className="text-white">{profile?.role === "owner" ? "בעל הבית" : "חבר"}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-slate-400">מזהה בית</span>
            <code className="text-xs text-slate-400 font-mono">{profile?.household_id?.slice(0, 8)}…</code>
          </div>
        </div>
      </section>
    </div>
  );
}
