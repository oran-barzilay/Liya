import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTasks } from "../hooks/useTasks";
import Icon from "../components/Icon";
import AppCalendar from "../components/AppCalendar";
import { usePreferencesStore } from "../state/stores/preferencesStore";
import { getTodayInTimeZone, utcIsoToDateInput, zonedDateTimeToUtcIso } from "../lib/datetime";

type Task = Record<string, any>;
type TaskScope = "daily" | "shopping" | "all";

const PRIORITY_BADGE: Record<number, string> = {
  1: "bg-red-900 text-red-300",
  2: "bg-orange-900 text-orange-300",
  3: "bg-amber-900 text-amber-300",
  4: "bg-blue-900 text-blue-300",
  5: "bg-slate-800 text-slate-400",
};

const PRIORITY_LABEL: Record<number, string> = {
  1: "דחוף", 2: "גבוה", 3: "בינוני", 4: "נמוך", 5: "יום יום",
};

const DAY_LABELS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

/** Safe convert date-only OR datetime string to UTC ISO */
function toUtcIso(val: string, timeZone: string): string | null {
  if (!val) return null;
  // date-only: append midnight time before converting
  const normalized = val.length === 10 ? val + "T00:00" : val;
  return zonedDateTimeToUtcIso(normalized, timeZone);
}

/** Relative date label for task list */
function relativeDateLabel(iso: string, today: string): { text: string; cls: string } {
  const d = iso.slice(0, 10);
  const diff = Math.round((new Date(d + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime()) / 86400000);
  if (diff < 0) return { text: `איחור ${Math.abs(diff)}d`, cls: "text-red-400" };
  if (diff === 0) return { text: "היום", cls: "text-accent-400" };
  if (diff === 1) return { text: "מחר", cls: "text-emerald-400" };
  if (diff <= 7) return { text: `${diff} ימים`, cls: "text-amber-400" };
  return { text: new Date(d + "T12:00:00").toLocaleDateString("he-IL", { day: "numeric", month: "numeric" }), cls: "text-theme-muted" };
}

function getNextOccurrence(recurrenceRule: string | null): string | null {
  if (!recurrenceRule) return null;
  try {
    const rule = JSON.parse(recurrenceRule);
    const days: number[] = rule.days ?? [];
    const time: string = rule.time ?? "09:00";
    if (!days.length) return null;
    const now = new Date();
    for (let i = 1; i <= 7; i++) {
      const next = new Date(now);
      next.setDate(next.getDate() + i);
      if (days.includes(next.getDay())) {
        const [h, m] = time.split(":").map(Number);
        next.setHours(h, m, 0, 0);
        return next.toISOString().slice(0, 16);
      }
    }
  } catch {}
  return null;
}

function RecurrenceField({ days, setDays, time, setTime }: {
  days: number[]; setDays: (d: number[]) => void; time: string; setTime: (t: string) => void;
}) {
  const toggle = (d: number) => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort());
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-theme-muted block mb-1.5">ימי חזרה</label>
        <div className="flex gap-1.5 flex-wrap">
          {DAY_LABELS.map((lbl, idx) => (
            <button key={idx} type="button" onClick={() => toggle(idx)}
              className={"w-9 h-9 rounded-lg text-xs font-semibold border transition-colors " +
                (days.includes(idx) ? "bg-accent-600 border-accent-600 text-white" : "border-slate-700 text-theme-muted hover:border-accent-500 hover:text-theme")}>
              {lbl}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs text-theme-muted block mb-1">שעת ביצוע קבועה</label>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input-base text-sm w-32" />
      </div>
    </div>
  );
}

function AddTaskModal({ onClose, onAdd, members }: {
  onClose: () => void; onAdd: (t: any) => void;
  members: Array<{ id: string; display_name: string }>;
}) {
  const timeZone = usePreferencesStore((s) => s.timeZone);
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState("priority");
  const [priority, setPriority] = useState("3");
  const [dueAt, setDueAt] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [desc, setDesc] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurDays, setRecurDays] = useState<number[]>([]);
  const [recurTime, setRecurTime] = useState("09:00");

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const recurrenceRule = isRecurring ? JSON.stringify({ days: recurDays, time: recurTime }) : null;
          const nextOccurrence = recurrenceRule ? getNextOccurrence(recurrenceRule) : null;
          onAdd({
            title, task_type: taskType, status: "todo", module: "general", source_type: "manual",
            priority_level: taskType === "priority" ? Number(priority) : null,
            due_at: isRecurring ? (taskType === "priority" ? nextOccurrence : null) : toUtcIso(dueAt, timeZone),
            scheduled_start_at: isRecurring ? (taskType === "time_sensitive" ? nextOccurrence : null) : toUtcIso(scheduledStart, timeZone),
            description: desc || null, assigned_to: assignedTo || null,
            is_recurring: isRecurring, recurrence_rule: recurrenceRule,
          });
          onClose();
        }}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-md space-y-4 my-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-theme">משימה חדשה</h3>
          <button type="button" onClick={onClose} className="text-theme-muted hover:text-theme p-1"><Icon name="x" className="w-4 h-4" /></button>
        </div>

        {/* Title */}
        <div>
          <label className="text-xs text-theme-muted block mb-1">כותרת *</label>
          <input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} className="input-base w-full" placeholder="שם המשימה" />
        </div>

        {/* One-time vs Recurring */}
        <div>
          <label className="text-xs text-theme-muted block mb-1.5">סוג משימה</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setIsRecurring(false)}
              className={"rounded-xl border px-3 py-2.5 text-sm transition-colors text-right " +
                (!isRecurring ? "bg-accent-700 border-accent-600 text-white" : "border-slate-700 text-theme-muted hover:text-theme hover:border-slate-600")}>
              <div className="font-medium">חד-פעמית</div>
              <div className="text-[11px] opacity-70">תאריך יעד קבוע</div>
            </button>
            <button type="button" onClick={() => setIsRecurring(true)}
              className={"rounded-xl border px-3 py-2.5 text-sm transition-colors text-right " +
                (isRecurring ? "bg-accent-700 border-accent-600 text-white" : "border-slate-700 text-theme-muted hover:text-theme hover:border-slate-600")}>
              <div className="font-medium">חזרתית</div>
              <div className="text-[11px] opacity-70">חוזרת כל שבוע</div>
            </button>
          </div>
        </div>

        {/* Type + Priority */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-theme-muted block mb-1">סוג</label>
            <select value={taskType} onChange={(e) => setTaskType(e.target.value)} className="input-base w-full">
              <option value="priority">רגילה</option>
              <option value="time_sensitive">מתוזמנת</option>
            </select>
          </div>
          {taskType === "priority" && (
            <div>
              <label className="text-xs text-theme-muted block mb-1">עדיפות</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="input-base w-full">
                {[1,2,3,4,5].map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Assignee */}
        {members.length > 0 && (
          <div>
            <label className="text-xs text-theme-muted block mb-1">אחראי</label>
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="input-base w-full">
              <option value="">ללא שיוך</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
            </select>
          </div>
        )}

        {/* Date (for non-recurring) */}
        {!isRecurring && taskType === "priority" && (
          <AppCalendar label="תאריך יעד" value={dueAt} onChange={setDueAt} mode="date" placeholder="בחר תאריך (אופציונלי)" />
        )}
        {!isRecurring && taskType === "time_sensitive" && (
          <AppCalendar label="מועד מתוזמן" value={scheduledStart} onChange={setScheduledStart} mode="date" placeholder="בחר תאריך" />
        )}

        {/* Recurrence config */}
        {isRecurring && (
          <div className="bg-slate-950/60 border border-slate-700 rounded-xl p-3">
            <RecurrenceField days={recurDays} setDays={setRecurDays} time={recurTime} setTime={setRecurTime} />
          </div>
        )}

        {/* Description */}
        <div>
          <label className="text-xs text-theme-muted block mb-1">תיאור</label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} className="input-base w-full resize-none" placeholder="פרטים נוספים..." />
        </div>

        <button type="submit" className="w-full bg-accent-600 hover:bg-accent-500 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
          הוסף משימה
        </button>
      </form>
    </div>
  );
}

function EditTaskModal({ task, onClose, onSave, members }: {
  task: Task; onClose: () => void; onSave: (t: Task) => void;
  members: Array<{ id: string; display_name: string }>;
}) {
  const timeZone = usePreferencesStore((s) => s.timeZone);
  const [title, setTitle] = useState(task.title ?? "");
  const [priority, setPriority] = useState(String(task.priority_level ?? 3));
  const [dueAt, setDueAt] = useState(task.due_at ? utcIsoToDateInput(task.due_at, timeZone) : "");
  const [scheduledStart, setScheduledStart] = useState(task.scheduled_start_at ? utcIsoToDateInput(task.scheduled_start_at, timeZone) : "");
  const [desc, setDesc] = useState(task.description ?? "");
  const [assignedTo, setAssignedTo] = useState(task.assigned_to ?? "");
  const [status, setStatus] = useState(task.status ?? "todo");
  const [isRecurring, setIsRecurring] = useState(task.is_recurring ?? false);
  const [recurDays, setRecurDays] = useState<number[]>(() => {
    try { return JSON.parse(task.recurrence_rule ?? "{}").days ?? []; } catch { return []; }
  });
  const [recurTime, setRecurTime] = useState(() => {
    try { return JSON.parse(task.recurrence_rule ?? "{}").time ?? "09:00"; } catch { return "09:00"; }
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const recurrenceRule = isRecurring ? JSON.stringify({ days: recurDays, time: recurTime }) : null;
          onSave({
            id: task.id, title, status, assigned_to: assignedTo || null,
            priority_level: task.task_type === "priority" ? Number(priority) : task.priority_level,
            due_at: toUtcIso(dueAt, timeZone),
            scheduled_start_at: toUtcIso(scheduledStart, timeZone),
            description: desc || null, is_recurring: isRecurring, recurrence_rule: recurrenceRule,
          });
          onClose();
        }}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-md space-y-4 my-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-theme">עריכת משימה</h3>
          <button type="button" onClick={onClose} className="text-theme-muted hover:text-theme p-1"><Icon name="x" className="w-4 h-4" /></button>
        </div>
        <div>
          <label className="text-xs text-theme-muted block mb-1">כותרת *</label>
          <input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} className="input-base w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-theme-muted block mb-1">סטטוס</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-base w-full">
              <option value="todo">לביצוע</option>
              <option value="in_progress">בביצוע</option>
              <option value="done">בוצע</option>
            </select>
          </div>
          {task.task_type === "priority" && (
            <div>
              <label className="text-xs text-theme-muted block mb-1">עדיפות</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="input-base w-full">
                {[1,2,3,4,5].map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select>
            </div>
          )}
        </div>
        {members.length > 0 && (
          <div>
            <label className="text-xs text-theme-muted block mb-1">אחראי</label>
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="input-base w-full">
              <option value="">ללא שיוך</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
            </select>
          </div>
        )}
        {!isRecurring && task.task_type === "priority" && (
          <AppCalendar label="תאריך יעד" value={dueAt} onChange={setDueAt} mode="date" placeholder="בחר תאריך" />
        )}
        {!isRecurring && task.task_type === "time_sensitive" && (
          <AppCalendar label="מועד מתוזמן" value={scheduledStart} onChange={setScheduledStart} mode="date" placeholder="בחר תאריך" />
        )}
        {isRecurring && (
          <div className="bg-slate-950/60 border border-slate-700 rounded-xl p-3">
            <RecurrenceField days={recurDays} setDays={setRecurDays} time={recurTime} setTime={setRecurTime} />
          </div>
        )}
        <div>
          <label className="text-xs text-theme-muted block mb-1">תיאור</label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} className="input-base w-full resize-none" />
        </div>
        <div className="border-t border-slate-700 pt-3">
          <label className="text-xs text-theme-muted block mb-1.5">סוג משימה</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setIsRecurring(false)}
              className={"rounded-lg border px-3 py-2 text-sm transition-colors " +
                (!isRecurring ? "bg-accent-700 border-accent-600 text-white" : "border-slate-700 text-theme-muted hover:text-theme")}>
              חד-פעמית
            </button>
            <button type="button" onClick={() => setIsRecurring(true)}
              className={"rounded-lg border px-3 py-2 text-sm transition-colors " +
                (isRecurring ? "bg-accent-700 border-accent-600 text-white" : "border-slate-700 text-theme-muted hover:text-theme")}>
              חזרתית
            </button>
          </div>
        </div>
        <button type="submit" className="w-full bg-accent-600 hover:bg-accent-500 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">שמור שינויים</button>
      </form>
    </div>
  );
}

export default function Tasks() {
  const navigate = useNavigate();
  const timeZone = usePreferencesStore((s) => s.timeZone);
  const today = getTodayInTimeZone(timeZone);
  const { data: tasks = [], createTask, updateTask, deleteTask, members = [] } = useTasks();
  const [showModal, setShowModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskScope, setTaskScope] = useState<TaskScope>("daily");
  const [filterType, setFilterType] = useState<"all" | "priority" | "time_sensitive">("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [recurrenceFilter, setRecurrenceFilter] = useState<"all" | "recurring" | "one_time">("all");
  const [showDone, setShowDone] = useState(false);

  const isShoppingTask = (task: Task) => task.module === "inventory" || task.source_type === "inventory_threshold";
  const shoppingTasks = useMemo(() => tasks.filter(isShoppingTask), [tasks]);
  const everydayTasks = useMemo(() => tasks.filter((task) => !isShoppingTask(task)), [tasks]);
  const sourceTasks = taskScope === "daily" ? everydayTasks : taskScope === "shopping" ? shoppingTasks : tasks;

  const visible = sourceTasks.filter((t) => {
    if (t.status === "cancelled") return false;
    if (filterType !== "all" && t.task_type !== filterType) return false;
    if (filterAssignee !== "all" && t.assigned_to !== filterAssignee) return false;
    if (recurrenceFilter === "recurring" && !t.is_recurring) return false;
    if (recurrenceFilter === "one_time" && t.is_recurring) return false;
    return true;
  });

  const openTasks = useMemo(() => [...visible.filter(t => t.status !== "done")].sort((a, b) => {
    // in_progress first
    if (a.status === "in_progress" && b.status !== "in_progress") return -1;
    if (b.status === "in_progress" && a.status !== "in_progress") return 1;
    // then by priority
    return (a.priority_level ?? 99) - (b.priority_level ?? 99);
  }), [visible]);

  const doneTasks = useMemo(() => visible.filter(t => t.status === "done"), [visible]);

  const openShoppingCount = shoppingTasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length;
  const scopeTitle = taskScope === "daily" ? "משימות הבית" : taskScope === "shopping" ? "קניות וחוסרים" : "כל המשימות";

  const handleStatusChange = (id: string, status: string, task?: Task) => {
    updateTask.mutate({ id, status });
    if (status === "done" && task?.is_recurring && task?.recurrence_rule) {
      const nextDate = getNextOccurrence(task.recurrence_rule);
      if (nextDate) {
        createTask.mutate({
          title: task.title, description: task.description,
          task_type: task.task_type, module: task.module, source_type: "recurring",
          priority_level: task.priority_level,
          scheduled_start_at: task.task_type === "time_sensitive" ? nextDate : null,
          due_at: task.task_type === "priority" ? nextDate : null,
          is_recurring: true, recurrence_rule: task.recurrence_rule,
          assigned_to: task.assigned_to, status: "todo",
        });
      }
    }
  };

  const TaskRow = ({ task }: { task: Task }) => {
    const dateIso = task.scheduled_start_at ?? task.due_at;
    const relDate = dateIso && task.status !== "done" ? relativeDateLabel(dateIso, today) : null;
    const isDone = task.status === "done";
    const isInProgress = task.status === "in_progress";

    return (
      <div className={"flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors " +
        (isDone ? "border-slate-800/50 bg-slate-950/30 opacity-60"
          : isInProgress ? "border-accent-800/60 bg-accent-950/20"
          : "border-slate-800 bg-slate-900")}>
        {/* Checkbox */}
        <button
          onClick={() => handleStatusChange(task.id, isDone ? "todo" : "done", task)}
          className={"w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors " +
            (isDone ? "bg-emerald-600 border-emerald-600" : isInProgress ? "border-accent-500" : "border-slate-600 hover:border-slate-400")}>
          {isDone && <Icon name="check" className="w-3 h-3 text-white" />}
          {isInProgress && <div className="w-2 h-2 rounded-full bg-accent-400" />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {task.is_recurring && <Icon name="repeat" className="w-3 h-3 text-accent-400 shrink-0" />}
            <span className={"text-sm font-medium leading-snug " + (isDone ? "line-through text-theme-muted" : "text-theme")}>
              {task.title}
            </span>
            {isInProgress && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent-900 text-accent-300">בביצוע</span>
            )}
          </div>
          {task.description && <p className="text-xs text-theme-muted truncate mt-0.5 opacity-70">{task.description}</p>}
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 shrink-0">
          {task.priority_level && !isDone && (
            <span className={"text-[10px] px-1.5 py-0.5 rounded-full font-semibold " + (PRIORITY_BADGE[task.priority_level] ?? "")}>
              {PRIORITY_LABEL[task.priority_level] ?? `P${task.priority_level}`}
            </span>
          )}
          {relDate && (
            <span className={"text-[11px] font-medium " + relDate.cls}>{relDate.text}</span>
          )}
          <button onClick={() => setEditingTask(task)} className="p-1.5 text-slate-600 hover:text-accent-400 rounded-lg hover:bg-slate-800 transition-colors">
            <Icon name="edit" className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setPendingDelete(task.id)} className="p-1.5 text-slate-600 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors">
            <Icon name="trash" className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold text-theme">{scopeTitle}</h2>
          <p className="text-theme-muted text-sm mt-0.5">
            {openTasks.length} פתוחות
            {doneTasks.length > 0 && <span className="opacity-50"> · {doneTasks.length} הושלמו</span>}
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5">
          <Icon name="plus" className="w-3.5 h-3.5" /> הוספת משימה
        </button>
      </div>

      {/* Scope tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {([["daily", "היומיום"], ["shopping", "קניות"], ["all", "הכול"]] as const).map(([scope, label]) => (
          <button key={scope} onClick={() => setTaskScope(scope)}
            className={"px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border " +
              (taskScope === scope ? "bg-accent-700 border-accent-600 text-white" : "bg-slate-900 border-slate-800 text-theme-muted hover:text-theme")}>
            {label}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
          {([["all", "הכל"], ["recurring", "חזרתיות"], ["one_time", "חד-פעמיות"]] as const).map(([value, label]) => (
            <button key={value} onClick={() => setRecurrenceFilter(value)}
              className={"px-3 py-1.5 rounded-md text-xs font-medium transition-colors " +
                (recurrenceFilter === value ? "bg-accent-700 text-white" : "text-theme-muted hover:text-theme")}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
          {(["all", "priority", "time_sensitive"] as const).map((f) => (
            <button key={f} onClick={() => setFilterType(f)}
              className={"px-3 py-1.5 rounded-md text-xs font-medium transition-colors " +
                (filterType === f ? "bg-slate-700 text-theme" : "text-theme-muted hover:text-theme")}>
              {f === "all" ? "הכל" : f === "priority" ? "רגילות" : "מתוזמנות"}
            </button>
          ))}
        </div>
        {members.length > 0 && (
          <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className="input-base text-xs py-1.5">
            <option value="all">כל המשפחה</option>
            <option value="">ללא אחראי</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
          </select>
        )}
      </div>

      {/* Shopping alert */}
      {taskScope === "daily" && openShoppingCount > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-800 bg-amber-950/20 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon name="package" className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="text-sm text-amber-200">{openShoppingCount} פריטים לקנייה ממתינים</span>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setTaskScope("shopping")} className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-xs font-medium">הצג</button>
            <button onClick={() => navigate("/inventory")} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-theme text-xs">לרשימה</button>
          </div>
        </div>
      )}

      {/* Open tasks */}
      {openTasks.length === 0 && doneTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 py-12 text-center">
          <Icon name="tasks" className="w-10 h-10 mx-auto text-slate-600 mb-3" />
          <p className="text-sm text-slate-500 mb-3">
            {taskScope === "shopping" ? "אין כרגע פריטים לקנייה" : "אין משימות עדיין"}
          </p>
          {taskScope !== "shopping" && (
            <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white text-sm rounded-lg transition-colors">
              הוסף משימה ראשונה
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {openTasks.map((task) => <TaskRow key={task.id} task={task} />)}
        </div>
      )}

      {/* Done section (collapsible) */}
      {doneTasks.length > 0 && (
        <div className="mt-5">
          <button
            onClick={() => setShowDone(s => !s)}
            className="flex items-center gap-2 text-xs text-theme-muted hover:text-theme transition-colors mb-2 w-full"
          >
            <Icon name={showDone ? "chevron-up" : "chevron-down"} className="w-3.5 h-3.5" />
            <span>{doneTasks.length} משימות שהושלמו</span>
            <div className="flex-1 border-t border-slate-800 mr-1" />
          </button>
          {showDone && (
            <div className="space-y-2">
              {doneTasks.map((task) => <TaskRow key={task.id} task={task} />)}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showModal && <AddTaskModal onClose={() => setShowModal(false)} onAdd={(task) => createTask.mutate(task)} members={members as Array<{ id: string; display_name: string }>} />}
      {editingTask && <EditTaskModal task={editingTask} onClose={() => setEditingTask(null)} onSave={(t) => updateTask.mutate(t)} members={members as Array<{ id: string; display_name: string }>} />}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="warning" className="w-5 h-5 text-red-400" />
              <h3 className="text-base font-semibold text-theme">למחוק משימה זו?</h3>
            </div>
            <p className="text-sm text-theme-muted mt-1">הפעולה אינה ניתנת לביטול.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setPendingDelete(null)} className="px-4 py-2 rounded-lg text-sm bg-slate-800 text-theme-muted hover:bg-slate-700">ביטול</button>
              <button onClick={() => { deleteTask.mutate(pendingDelete); setPendingDelete(null); }} className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-500">מחיקה</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
