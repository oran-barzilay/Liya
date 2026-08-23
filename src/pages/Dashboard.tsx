import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

function StatCard({ icon, label, value, sub, color = "accent", onClick }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string;
  color?: "accent" | "emerald" | "amber" | "red"; onClick?: () => void;
}) {
  const colorMap = {
    accent:  "border-accent-800 bg-accent-950/40",
    emerald: "border-emerald-800 bg-emerald-950/40",
    amber:   "border-amber-800 bg-amber-950/40",
    red:     "border-red-800 bg-red-950/40",
  };
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={"rounded-xl border p-4 text-right w-full transition-colors " + colorMap[color] + (onClick ? " hover:brightness-110 active:scale-95 cursor-pointer" : "")}
    >
      <div className="mb-2 text-theme-muted">{icon}</div>
      <div className="text-2xl font-bold text-theme">{value}</div>
      <div className="text-sm font-medium text-theme-muted mt-0.5">{label}</div>
      {sub && <div className="text-xs text-theme-muted mt-1 opacity-70 truncate">{sub}</div>}
    </Tag>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const timeZone = usePreferencesStore((s) => s.timeZone);
  const { data: profile } = useProfile();
  const { data: tasks = [] } = useTasks();
  const { data: inventory = [] } = useInventory();
  const { data: appointments = [] } = useAppointments();
  const { totals } = useTransactions();
  const { data: children = [] } = useChildren();
  const { data: allBabyLogs = [] } = useBabyLogs();
  const [copied, setCopied] = useState(false);
  const today = getTodayInTimeZone(timeZone);
  const hour = Number(formatInTimeZone(new Date(), timeZone, { hour: "2-digit", hour12: false }, "en-GB"));
  const greeting = hour < 12 ? "בוקר טוב" : hour < 17 ? "צהריים טובים" : "ערב טוב";
  const todayTimeSensitive = tasks.filter(t => t.task_type === "time_sensitive" && t.status !== "done" && t.scheduled_start_at?.slice(0, 10) === today);
  const lowStock = inventory.filter(item => Number(item.quantity) < Number(item.critical_threshold));
  const nextAppt = appointments.find((a) => (a.starts_at ?? "") >= new Date().toISOString()) ?? appointments[0];
  const balance = totals.income - totals.expenses;
  const openEverydayTasks = useMemo(
    () => tasks.filter((t) => t.status !== "done" && t.module !== "inventory"),
    [tasks]
  );
  const focusTasks = useMemo(
    () => [...openEverydayTasks]
      .sort((a, b) => {
        const aDate = a.scheduled_start_at ?? a.due_at ?? a.created_at ?? "";
        const bDate = b.scheduled_start_at ?? b.due_at ?? b.created_at ?? "";
        return aDate.localeCompare(bDate);
      })
      .slice(0, 3),
    [openEverydayTasks]
  );
  const shoppingItems = lowStock.slice(0, 4);

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
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-3">
          <Icon name="hand-wave" className="w-6 h-6 text-accent-400" />
          <div>
            <h2 className="text-2xl font-bold text-theme">{greeting}, {profile?.display_name ?? ""}!</h2>
            <p className="text-theme-muted text-sm mt-1">
              {formatInTimeZone(new Date(), timeZone, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
            <p className="text-xs text-theme-muted mt-2 opacity-80">הנה כל מה שחשוב לבית היום — בלי לחפש בין מסכים.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate("/tasks")}
            className="bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5">
            <Icon name="plus" className="w-3.5 h-3.5" /> משימה חדשה
          </button>
          <button onClick={() => navigate("/weekly")}
            className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-theme text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5">
            <Icon name="calendar" className="w-3.5 h-3.5" /> תכנון שבועי
          </button>
          <button onClick={() => navigate("/inventory")}
            className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-theme text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5">
            <Icon name="package" className="w-3.5 h-3.5" /> מה חסר בבית
          </button>
          {children.length > 0 && (
            <button onClick={() => navigate("/baby")}
              className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-theme text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5">
              <Icon name="baby" className="w-3.5 h-3.5" /> עדכון תינוקות
            </button>
          )}
        </div>
      </div>

      <section className="mb-6 grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-semibold text-theme">מה חשוב היום</h3>
              <p className="text-xs text-theme-muted mt-1">המשימות היומיומיות שלך, בלי פריטי קנייה אוטומטיים.</p>
            </div>
            <button onClick={() => navigate("/tasks")}
              className="text-xs text-accent-400 hover:text-accent-300 font-medium flex items-center gap-1">
              לכל המשימות <Icon name="chevron-left" className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-2">
            {focusTasks.length > 0 ? focusTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => navigate("/tasks")}
                className="w-full text-right flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 hover:bg-slate-800/50 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-accent-950/40 border border-accent-800 flex items-center justify-center shrink-0">
                  <Icon name={task.task_type === "time_sensitive" ? "clock" : "tasks"} className="w-4 h-4 text-accent-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-theme truncate">{task.title}</div>
                  <div className="text-xs text-theme-muted mt-1 flex flex-wrap gap-x-2 gap-y-1">
                    {task.scheduled_start_at && <span>היום ב-{formatInTimeZone(task.scheduled_start_at, timeZone, { hour: "2-digit", minute: "2-digit" })}</span>}
                    {!task.scheduled_start_at && task.due_at && <span>יעד {formatInTimeZone(task.due_at, timeZone, { day: "numeric", month: "numeric" })}</span>}
                    <span>{task.assigned_to ? "יש אחראי מוגדר" : "ללא אחראי"}</span>
                  </div>
                </div>
              </button>
            )) : (
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-6 text-center">
                <div className="text-sm font-medium text-theme">אין עומס גדול היום</div>
                <p className="text-xs text-theme-muted mt-1">אפשר להוסיף משימה חדשה או לעבור לרשימת הקניות.</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-semibold text-theme">מה חסר בבית</h3>
              <p className="text-xs text-theme-muted mt-1">ריכוז מהיר של דברים לקנייה, בלי לערבב אותם עם המשימות.</p>
            </div>
            <button onClick={() => navigate("/inventory")}
              className="text-xs text-accent-400 hover:text-accent-300 font-medium flex items-center gap-1">
              לרשימת הקניות <Icon name="chevron-left" className="w-3.5 h-3.5" />
            </button>
          </div>
          {shoppingItems.length > 0 ? (
            <div className="space-y-2">
              {shoppingItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate("/inventory")}
                  className="w-full text-right flex items-center gap-3 rounded-xl border border-red-900/60 bg-red-950/20 px-4 py-3 hover:bg-red-950/30 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-red-950/40 border border-red-800 flex items-center justify-center shrink-0">
                    <Icon name="package" className="w-4 h-4 text-red-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-red-200 truncate">{item.name}</div>
                    <div className="text-xs text-red-300 mt-1">נשאר {item.quantity} {item.unit} · מינ׳ {item.critical_threshold}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 px-4 py-6 text-center">
              <div className="text-sm font-medium text-emerald-300">כרגע הכול מסודר בבית</div>
              <p className="text-xs text-emerald-400 mt-1">אין פריטים שחסרים לקנייה מיידית.</p>
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Icon name="clock" className="w-6 h-6" />} label="משימות מתוזמנות היום" value={todayTimeSensitive.length} sub={openEverydayTasks.length + " משימות פתוחות"} color="accent" onClick={() => navigate("/tasks")} />
        <StatCard icon={<Icon name="package" className="w-6 h-6" />} label="פריטים לקנייה" value={lowStock.length}
          sub={lowStock.slice(0, 2).map(i => i.name).join(", ") || "הכל תקין"} color={lowStock.length > 0 ? "red" : "emerald"} onClick={() => navigate("/inventory")} />
        <StatCard icon={<Icon name="wallet" className="w-6 h-6" />} label="מאזן חודשי" value={"₪" + balance.toLocaleString("he-IL")}
          sub={"הכנסות ₪" + totals.income.toLocaleString("he-IL") + " | הוצאות ₪" + totals.expenses.toLocaleString("he-IL")}
          color={balance >= 0 ? "emerald" : "red"} onClick={() => navigate("/finance")} />
        <StatCard icon={<Icon name="medical" className="w-6 h-6" />} label="אירוע הבא"
          value={nextAppt ? formatInTimeZone(nextAppt.starts_at, timeZone, { month: "short", day: "numeric" }) : "אין"}
          sub={nextAppt ? `${nextAppt.title} · ${formatInTimeZone(nextAppt.starts_at, timeZone, { weekday: "long" })}` : "אין אירועים קרובים"}
          color="amber" onClick={() => navigate("/weekly")} />
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
