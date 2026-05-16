import { useState } from "react";
import { useTasks } from "../hooks/useTasks";
import { useInventory } from "../hooks/useInventory";
import { useTransactions } from "../hooks/useFinance";
import { useAppointments } from "../hooks/useBaby";
import { useProfile } from "../hooks/useProfile";
function StatCard({ icon, label, value, sub, color = "accent" }: {
  icon: string; label: string; value: string | number; sub?: string; color?: "accent" | "emerald" | "amber" | "red";
}) {
  const colorMap = {
    accent:  "border-accent-800 bg-accent-950/40",
    emerald: "border-emerald-800 bg-emerald-950/40",
    amber:   "border-amber-800 bg-amber-950/40",
    red:     "border-red-800 bg-red-950/40",
  };
  return (
    <div className={"rounded-xl border p-4 " + colorMap[color]}>
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm font-medium text-slate-300 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}
export default function Dashboard() {
  const { data: profile } = useProfile();
  const { data: tasks = [] } = useTasks();
  const { data: inventory = [] } = useInventory();
  const { data: appointments = [] } = useAppointments();
  const { totals } = useTransactions();
  const [copied, setCopied] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "בוקר טוב" : hour < 17 ? "צהריים טובים" : "ערב טוב";
  const todayTimeSensitive = tasks.filter(t => t.task_type === "time_sensitive" && t.status !== "done" && t.scheduled_start_at?.slice(0, 10) === today);
  const todoTasks = tasks.filter(t => t.status === "todo");
  const lowStock = inventory.filter(item => Number(item.quantity) < Number(item.critical_threshold));
  const nextAppt = appointments[0];
  const balance = totals.income - totals.expenses;
  const copyHouseholdId = () => {
    if (!profile?.household_id) return;
    navigator.clipboard.writeText(profile.household_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">{greeting}, {profile?.display_name ?? ""}! 👋</h2>
        <p className="text-slate-400 text-sm mt-1">
          {new Date().toLocaleDateString("he-IL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon="⏰" label="משימות מתוזמנות היום" value={todayTimeSensitive.length} sub={todoTasks.length + " פתוחות סה\"כ"} color="accent" />
        <StatCard icon="📦" label="פריטים חסרים" value={lowStock.length}
          sub={lowStock.slice(0, 2).map(i => i.name).join(", ") || "הכל תקין"} color={lowStock.length > 0 ? "red" : "emerald"} />
        <StatCard icon="💰" label="מאזן חודשי" value={"₪" + balance.toLocaleString("he-IL")}
          sub={"הכנסות ₪" + totals.income.toLocaleString("he-IL") + " | הוצאות ₪" + totals.expenses.toLocaleString("he-IL")}
          color={balance >= 0 ? "emerald" : "red"} />
        <StatCard icon="🏥" label="תור הבא"
          value={nextAppt ? new Date(nextAppt.starts_at).toLocaleDateString("he-IL", { month: "short", day: "numeric" }) : "אין"}
          sub={nextAppt?.title ?? "אין תורים קרובים"} color="amber" />
      </div>
      {todayTimeSensitive.length > 0 && (
        <section className="mb-6">
          <h3 className="text-base font-semibold mb-3 text-slate-200">⏰ משימות מתוזמנות להיום</h3>
          <div className="space-y-2">
            {todayTimeSensitive.map(task => (
              <div key={task.id} className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                <span className="text-sm font-medium flex-1">{task.title}</span>
                {task.scheduled_start_at && (
                  <span className="text-xs text-slate-400">{new Date(task.scheduled_start_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</span>
                )}
                <span className={"text-xs px-2 py-0.5 rounded-full " + (task.status === "in_progress" ? "bg-accent-900 text-accent-300" : "bg-slate-800 text-slate-400")}>
                  {task.status === "todo" ? "לביצוע" : task.status === "in_progress" ? "בביצוע" : "בוצע"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
      {lowStock.length > 0 && (
        <section className="mb-6">
          <h3 className="text-base font-semibold mb-3 text-slate-200">🚨 התראות מלאי נמוך</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {lowStock.map(item => (
              <div key={item.id} className="bg-red-950/30 border border-red-800 rounded-xl px-4 py-3">
                <div className="font-medium text-sm text-red-300">{item.name}</div>
                <div className="text-xs text-red-400 mt-0.5">{item.quantity} {item.unit} נשאר (מינ׳ {item.critical_threshold})</div>
              </div>
            ))}
          </div>
        </section>
      )}
      {profile?.household_id && (
        <section className="mt-8">
          <h3 className="text-sm font-semibold mb-2 text-slate-400 uppercase tracking-wide">🔗 הזמן לבית</h3>
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500 mb-0.5">מזהה הבית (שתף עם לינוי)</div>
              <code className="text-xs text-slate-300 font-mono break-all">{profile.household_id}</code>
            </div>
            <button onClick={copyHouseholdId}
              className={"shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors " + (copied ? "bg-emerald-700 text-white" : "bg-slate-700 hover:bg-slate-600 text-slate-300")}>
              {copied ? "✓ הועתק!" : "העתק"}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">לינוי נרשמת, בוחרת "הצטרף לבית" ומדביקה את המזהה הזה.</p>
        </section>
      )}
    </div>
  );
}
