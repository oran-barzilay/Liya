import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setInfo("");
    if (mode === "reset") {
      setLoading(true);
      try {
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/`,
        });
        if (resetErr) throw resetErr;
        setInfo("קישור לאיפוס סיסמה נשלח למייל שלך.");
        setMode("signin");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "שגיאה בשליחת המייל");
      } finally { setLoading(false); }
      return;
    }
    if (mode === "signup" && password !== confirm) { setError("הסיסמאות אינן תואמות."); return; }
    if (mode === "signup" && password.length < 6) { setError("הסיסמה חייבת להיות לפחות 6 תווים."); return; }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error: signUpErr } = await supabase.auth.signUp({ email, password });
        if (signUpErr) throw signUpErr;
        try { await signIn(email, password); navigate("/"); }
        catch { setInfo("החשבון נוצר! בדוק את המייל לאישור, ואז התחבר."); setMode("signin"); }
      } else {
        await signIn(email, password);
        navigate("/");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "שגיאה בהתחברות");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3 font-bold text-accent-400">Fami</div>
          <p className="text-slate-400 mt-2 text-sm">נהל את הבית שלך בחכמה</p>
        </div>

        {mode !== "reset" && (
          <div className="flex rounded-xl bg-slate-900 border border-slate-800 p-1 mb-4">
            {(["signin", "signup"] as const).map((m) => (
              <button key={m} type="button"
                onClick={() => { setMode(m); setError(""); setInfo(""); }}
                className={"flex-1 py-2 rounded-lg text-sm font-medium transition-colors " +
                  (mode === m ? "bg-accent-600 text-white" : "text-slate-400 hover:text-white")}>
                {m === "signin" ? "כניסה" : "יצירת חשבון"}
              </button>
            ))}
          </div>
        )}

        {mode === "reset" && (
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => { setMode("signin"); setError(""); setInfo(""); }}
              className="text-slate-400 hover:text-white transition-colors">
              <Icon name="chevron-right" className="w-4 h-4" />
            </button>
            <h2 className="text-base font-semibold text-theme">איפוס סיסמה</h2>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          {mode === "signup" && (
            <div className="bg-accent-950/50 border border-accent-800 rounded-lg px-3 py-2.5 text-xs text-accent-300 flex items-start gap-2">
              <Icon name="hand-wave" className="w-4 h-4 shrink-0 mt-0.5" />
              <span>פעם ראשונה? צור חשבון כאן. אחרי ההרשמה תגדיר את שם הבית והפרופיל שלך.</span>
            </div>
          )}
          {mode === "reset" && (
            <p className="text-sm text-slate-400">הזן את כתובת המייל שלך ונשלח לך קישור לאיפוס הסיסמה.</p>
          )}
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">אימייל</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
              placeholder="oran@family.com" />
          </div>
          {mode !== "reset" && (
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">סיסמה</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
                placeholder="••••••••" />
            </div>
          )}
          {mode === "signup" && (
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">אימות סיסמה</label>
              <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
                placeholder="••••••••" />
            </div>
          )}
          {error && <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-3 py-2 flex items-center gap-2"><Icon name="warning" className="w-4 h-4 shrink-0" /> {error}</p>}
          {info  && <p className="text-emerald-400 text-sm bg-emerald-950/50 border border-emerald-800 rounded-lg px-3 py-2 flex items-center gap-2"><Icon name="check" className="w-4 h-4 shrink-0" /> {info}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-accent-600 hover:bg-accent-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors text-sm">
            {loading ? "..." : mode === "signup" ? "צור חשבון" : mode === "reset" ? "שלח קישור לאיפוס" : "כניסה"}
          </button>
        </form>

        {mode === "signin" && (
          <div className="text-center text-xs text-slate-500 mt-4 space-y-1">
            <div>
              אין לך חשבון?{" "}
              <button onClick={() => setMode("signup")} className="text-accent-400 hover:text-accent-300 underline">צור אחד</button>
            </div>
            <div>
              <button onClick={() => { setMode("reset"); setError(""); setInfo(""); }}
                className="text-slate-500 hover:text-accent-400 transition-colors">שכחת סיסמה?</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
