import { useTasks } from "../hooks/useTasks";
import { useInventory } from "../hooks/useInventory";
import { useTransactions } from "../hooks/useFinance";
import { useAppointments } from "../hooks/useBaby";
import { useProfile } from "../hooks/useProfile";

function StatCard({
  icon,
  label,
  value,
  sub,
  color = "indigo",
}: {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  color?: "indigo" | "emerald" | "amber" | "red";
}) {
  const colorMap = {
    indigo: "border-indigo-800 bg-indigo-950/40",
    emerald: "border-emerald-800 bg-emerald-950/40",
    amber: "border-amber-800 bg-amber-950/40",
    red: "border-red-800 bg-red-950/40",
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
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

  const today = new Date().toISOString().slice(0, 10);
  const todayTimeSensitive = tasks.filter(
    (t) =>
      t.task_type === "time_sensitive" &&
      t.status !== "done" &&
      t.scheduled_start_at?.slice(0, 10) === today
  );
  const todoTasks = tasks.filter((t) => t.status === "todo");
  const lowStock = inventory.filter(
    (item) => Number(item.quantity) < Number(item.critical_threshold)
  );
  const nextAppt = appointments[0];
  const balance = totals.income - totals.expenses;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">
          Good {new Date().getHours() < 12 ? "morning" : "evening"},{" "}
          {profile?.display_name ?? ""}! 👋
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon="⏰"
          label="Time-sensitive today"
          value={todayTimeSensitive.length}
          sub={`${todoTasks.length} total open`}
          color="indigo"
        />
        <StatCard
          icon="📦"
          label="Low stock items"
          value={lowStock.length}
          sub={lowStock.slice(0, 2).map((i) => i.name).join(", ") || "All good"}
          color={lowStock.length > 0 ? "red" : "emerald"}
        />
        <StatCard
          icon="💰"
          label="Monthly balance"
          value={`₪${balance.toLocaleString()}`}
          sub={`+₪${totals.income.toLocaleString()} / -₪${totals.expenses.toLocaleString()}`}
          color={balance >= 0 ? "emerald" : "red"}
        />
        <StatCard
          icon="🏥"
          label="Next appointment"
          value={
            nextAppt
              ? new Date(nextAppt.starts_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : "None"
          }
          sub={nextAppt?.title ?? "No upcoming appointments"}
          color="amber"
        />
      </div>

      {/* Today's time-sensitive tasks */}
      {todayTimeSensitive.length > 0 && (
        <section className="mb-6">
          <h3 className="text-base font-semibold mb-3 text-slate-200">
            ⏰ Today's scheduled tasks
          </h3>
          <div className="space-y-2">
            {todayTimeSensitive.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3"
              >
                <span className="text-sm font-medium flex-1">{task.title}</span>
                {task.scheduled_start_at && (
                  <span className="text-xs text-slate-400">
                    {new Date(task.scheduled_start_at).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    task.status === "in_progress"
                      ? "bg-indigo-900 text-indigo-300"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {task.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Low stock alerts */}
      {lowStock.length > 0 && (
        <section>
          <h3 className="text-base font-semibold mb-3 text-slate-200">🚨 Low stock alerts</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {lowStock.map((item) => (
              <div
                key={item.id}
                className="bg-red-950/30 border border-red-800 rounded-xl px-4 py-3"
              >
                <div className="font-medium text-sm text-red-300">{item.name}</div>
                <div className="text-xs text-red-400 mt-0.5">
                  {item.quantity} {item.unit} left (min {item.critical_threshold})
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

