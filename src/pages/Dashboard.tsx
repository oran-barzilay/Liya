import { useState } from "react";
import { useTasks } from "../hooks/useTasks";
import { useInventory } from "../hooks/useInventory";
import { useTransactions } from "../hooks/useFinance";
import { useAppointments, useBabyLogs, useChildren } from "../hooks/useBaby";
import { useProfile } from "../hooks/useProfile";
import Icon from "../components/Icon";
import { usePreferencesStore } from "../state/stores/preferencesStore";
import { formatInTimeZone, getTodayInTimeZone } from "../lib/datetime";

function formatMinutes(mins: number) {
  if (mins < 60) return `${mins} דק'`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} שע' ${m} דק'` : `${h} שעה`;
}

function StatCard({ icon, label, value, sub, color = "accent" }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: "accent" | "emerald" | "amber" | "red";
}) {
  const colorMap = {
    accent:  "border-accent-800 bg-accent-950/40",
    emerald: "border-emerald-800 bg-emerald-950/40",
    amber:   "border-amber-800 bg-amber-950/40",
    red:     "border-red-800 bg-red-950/40",
  };
  return (
    <div className={"rounded-xl border p-4 " + colorMap[color]}>
      <div className="mb-2 text-theme-muted">{icon}</div>
      <div className="text-2xl font-bold text-theme">{value}</div>
      <div className="text-sm font-medium text-theme-muted mt-0.5">{label}</div>
      {sub && <div className="text-xs text-theme-muted mt-1 opacity-70">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const timeZone = usePreferencesStore((s) => s.timeZone);
  const { data: profile } = useProfile();
  const { data: tasks = [] } = useTasks();
  const { data: inventory = [] } = useInventory();
  const { data: appointments = [] } = useAppointments();
  const { totals } = useTransactions();
  const { data: children = [] } = useChildren();
  const { data: allBabyLogs = [] } = useBabyLogs();          // all children, no filter
  const [copied, setCopied] = useState(false);
  const today = getTodayInTimeZone(timeZone);
  const hour = Number(formatInTimeZone(new Date(), timeZone, { hour: "2-digit", hour12: false }, "en-GB"));
  const greeting = hour < 12 ? "בוקר טוב" : hour < 17 ? "צהריים טובים" : "ערב טוב";
  const todayTimeSensitive = tasks.filter(t => t.task_type === "time_sensitive" && t.status !== "done" && t.scheduled_start_at?.slice(0, 10) === today);
  const todoTasks = tasks.filter(t => t.status === "todo");
  const lowStock = inventory.filter(item => Number(item.quantity) < Number(item.critical_threshold));
  const nextAppt = appointments[0];
  const balance = totals.income - totals.expenses;

  // Baby daily summary
  const todayBabyLogs = allBabyLogs.filter(l => l.event_at?.slice(0, 10) === today);
  const todayTummyMinutes = todayBabyLogs.filter(l => l.log_type === "tummy_time").reduce((s, l) => s + (l.amount ?? 0), 0);
  const todayFeedings = todayBabyLogs.filter(l => l.log_type === "feeding");
  const todayFeedingMl = todayFeedings.reduce((s, l) => s + (l.amount ?? 0), 0);
  const todayDiapers = todayBabyLogs.filter(l => l.log_type === "diaper_change").length;
  const hasBabyActivity = children.length > 0 && todayBabyLogs.length > 0;

  const copyHouseholdId = () => {
    if (!profile?.household_id) return;
    navigator.clipboard.writeText(profile.household_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Icon name="hand-wave" className="w-6 h-6 text-accent-400" />
        <div>
          <h2 className="text-2xl font-bold text-theme">{greeting}, {profile?.display_name ?? ""}!</h2>
          <p className="text-theme-muted text-sm mt-1">
            {formatInTimeZone(new Date(), timeZone, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Icon name="clock" className="w-6 h-6" />} label="משימות מתוזמנות היום" value={todayTimeSensitive.length} sub={todoTasks.length + " פתוחות סה\"כ"} color="accent" />
        <StatCard icon={<Icon name="package" className="w-6 h-6" />} label="פריטים חסרים" value={lowStock.length}
          sub={lowStock.slice(0, 2).map(i => i.name).join(", ") || "הכל תקין"} color={lowStock.length > 0 ? "red" : "emerald"} />
        <StatCard icon={<Icon name="wallet" className="w-6 h-6" />} label="מאזן חודשי" value={"₪" + balance.toLocaleString("he-IL")}
          sub={"הכנסות ₪" + totals.income.toLocaleString("he-IL") + " | הוצאות ₪" + totals.expenses.toLocaleString("he-IL")}
          color={balance >= 0 ? "emerald" : "red"} />
        <StatCard icon={<Icon name="medical" className="w-6 h-6" />} label="אירוע הבא"
          value={nextAppt ? formatInTimeZone(nextAppt.starts_at, timeZone, { month: "short", day: "numeric" }) : "אין"}
          sub={nextAppt?.title ?? "אין אירועים קרובים"} color="amber" />
      </div>

      {/* ─── Baby daily summary ─── */}
      {hasBabyActivity && (
        <section className="mb-6">
          <h3 className="text-base font-semibold mb-3 text-theme flex items-center gap-2">
            <Icon name="baby" className="w-4 h-4 text-pink-400" /> סיכום תינוקות היום
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {todayTummyMinutes > 0 && (
              <div className="bg-pink-950/30 border border-pink-800 rounded-xl px-4 py-3 text-center">
                <div className="text-xl font-bold text-pink-300">{formatMinutes(todayTummyMinutes)}</div>
                <div className="text-xs text-pink-400 mt-0.5">זמן בטן</div>
              </div>
            )}
            {todayFeedings.length > 0 && (
              <div className="bg-accent-950/30 border border-accent-800 rounded-xl px-4 py-3 text-center">
                <div className="text-xl font-bold text-accent-300">{todayFeedings.length}</div>
                <div className="text-xs text-accent-400 mt-0.5">האכלות · {todayFeedingMl} מ״ל</div>
              </div>
            )}
            {todayDiapers > 0 && (
              <div className="bg-amber-950/30 border border-amber-800 rounded-xl px-4 py-3 text-center">
                <div className="text-xl font-bold text-amber-300">{todayDiapers}</div>
                <div className="text-xs text-amber-400 mt-0.5">החלפות חיתול</div>
              </div>
            )}
          </div>
        </section>
      )}

      {todayTimeSensitive.length > 0 && (
        <section className="mb-6">
          <h3 className="text-base font-semibold mb-3 text-theme flex items-center gap-2">
            <Icon name="clock" className="w-4 h-4 text-accent-400" /> משימות מתוזמנות להיום
          </h3>
          <div className="space-y-2">
            {todayTimeSensitive.map(task => (
              <div key={task.id} className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                <span className="text-sm font-medium flex-1 text-theme">{task.title}</span>
                {task.scheduled_start_at && (
                  <span className="text-xs text-theme-muted">{formatInTimeZone(task.scheduled_start_at, timeZone, { hour: "2-digit", minute: "2-digit" })}</span>
                )}
                <span className={"text-xs px-2 py-0.5 rounded-full " + (task.status === "in_progress" ? "bg-accent-900 text-accent-300" : "bg-slate-800 text-theme-muted")}>
                  {task.status === "todo" ? "לביצוע" : task.status === "in_progress" ? "בביצוע" : "בוצע"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {lowStock.length > 0 && (
        <section className="mb-6">
          <h3 className="text-base font-semibold mb-3 text-theme flex items-center gap-2">
            <Icon name="alert" className="w-4 h-4 text-red-400" /> התראות מלאי נמוך
          </h3>
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
          <h3 className="text-sm font-semibold mb-2 text-theme-muted uppercase tracking-wide flex items-center gap-2">
            <Icon name="link" className="w-4 h-4" /> הזמן לבית
          </h3>
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-theme-muted mb-0.5 opacity-70">מזהה הבית (שתף עם לינוי)</div>
              <code className="text-xs text-theme-muted font-mono break-all">{profile.household_id}</code>
            </div>
            <button onClick={copyHouseholdId}
              className={"shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 " + (copied ? "bg-emerald-700 text-white" : "bg-slate-700 hover:bg-slate-600 text-theme-muted")}>
              {copied ? <><Icon name="check" className="w-3 h-3" /> הועתק!</> : <><Icon name="copy" className="w-3 h-3" /> העתק</>}
            </button>
          </div>
          <p className="text-xs text-theme-muted mt-1.5 opacity-70">לינוי נרשמת, בוחרת "הצטרף לבית" ומדביקה את המזהה הזה.</p>
        </section>
      )}
    </div>
  );
}
