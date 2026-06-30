import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import Icon from "../components/Icon";

export default function ResetPassword() {
  const { clearRecovery } = useAuth();
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("הסיסמאות אינן תואמות"); return; }
    if (password.length < 6)  { setError("הסיסמה חייבת להיות לפחות 6 תווים"); return; }
    setLoading(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) throw updErr;
      setSuccess(true);
      // Give the user a moment to read the success message, then clear recovery
      setTimeout(() => clearRecovery(), 1800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "שגיאה בעדכון הסיסמה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3 font-bold text-accent-400">Fami</div>
          <h2 className="text-slate-300 text-base font-semibold mt-2">הגדרת סיסמה חדשה</h2>
          <p className="text-slate-500 text-sm mt-1">בחר סיסמה חזקה — לפחות 6 תווים</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">סיסמה חדשה</label>
            <input
              type="password"
              required
              autoFocus
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">אימות סיסמה</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-3 py-2 flex items-center gap-2">
              <Icon name="warning" className="w-4 h-4 shrink-0" /> {error}
            </p>
          )}

          {success && (
            <p className="text-emerald-400 text-sm bg-emerald-950/50 border border-emerald-800 rounded-lg px-3 py-2 flex items-center gap-2">
              <Icon name="check" className="w-4 h-4 shrink-0" /> הסיסמה עודכנה בהצלחה! מעביר לאפליקציה…
            </p>
          )}

          <button
            type="submit"
            disabled={loading || success}
            className="w-full bg-accent-600 hover:bg-accent-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
          >
            {loading ? "מעדכן…" : success ? "✓ בוצע" : "שמור סיסמה חדשה"}
          </button>
        </form>
      </div>
    </div>
  );
}

