import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
export default function Setup() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [displayName, setDisplayName] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const createHousehold = async () => {
    if (!user) return;
    const { error } = await supabase.rpc("create_household_with_owner", {
      p_household_name: householdName,
      p_display_name: displayName || user.email?.split("@")[0] || "משתמש",
    });
    if (error) throw error;
  };
  const joinHousehold = async () => {
    if (!user) return;
    const { error } = await supabase.rpc("join_household", {
      p_household_id: joinCode.trim(),
      p_display_name: displayName || user.email?.split("@")[0] || "משתמש",
    });
    if (error) throw error;
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true); setError("");
    try {
      if (mode === "create") await createHousehold();
      else await joinHousehold();
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
    } catch (err: unknown) {
      console.error("Setup error:", err);
      let msg = "ההגדרה נכשלה";
      if (err && typeof err === "object") {
        // @ts-ignore
        msg = err.message || err.msg || err.details || JSON.stringify(err);
      } else if (typeof err === "string") { msg = err; }
      setError(msg);
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">👋</div>
          <h1 className="text-2xl font-bold text-white">ברוך הבא ל-Fami</h1>
          <p className="text-slate-400 mt-2 text-sm">מחובר בתור <span className="text-accent-400">{user?.email}</span></p>
        </div>
        <div className="flex rounded-xl bg-slate-900 border border-slate-800 p-1 mb-4">
          <button type="button" onClick={() => { setMode("create"); setError(""); }}
            className={"flex-1 py-2 rounded-lg text-sm font-medium transition-colors " + (mode === "create" ? "bg-accent-600 text-white" : "text-slate-400 hover:text-white")}>
            🏠 בית חדש
          </button>
          <button type="button" onClick={() => { setMode("join"); setError(""); }}
            className={"flex-1 py-2 rounded-lg text-sm font-medium transition-colors " + (mode === "join" ? "bg-accent-600 text-white" : "text-slate-400 hover:text-white")}>
            🔗 הצטרף לבית
          </button>
        </div>
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">שמך</label>
            <input type="text" required value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="אורן"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-500" />
          </div>
          {mode === "create" ? (
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">שם הבית</label>
              <input type="text" required value={householdName} onChange={e => setHouseholdName(e.target.value)} placeholder="משפחת ברזילי"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-500" />
              <p className="text-xs text-slate-500 mt-1.5">קטגוריות ברירת מחדל ייווצרו אוטומטית.</p>
            </div>
          ) : (
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">מזהה הבית</label>
              <input type="text" required value={joinCode} onChange={e => setJoinCode(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-500 font-mono" />
              <p className="text-xs text-slate-500 mt-1.5">בקש מאורן לשתף את מזהה הבית מלוח הבקרה.</p>
            </div>
          )}
          {error && <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">⚠️ {error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-accent-600 hover:bg-accent-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors text-sm">
            {loading ? "מגדיר…" : (mode === "create" ? "צור בית" : "הצטרף לבית")}
          </button>
        </form>
      </div>
    </div>
  );
}
