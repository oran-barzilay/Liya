import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTasks } from "../hooks/useTasks";
import { useInventory } from "../hooks/useInventory";
import Icon from "../components/Icon";
import AppCalendar from "../components/AppCalendar";
import Fab from "../components/Fab";
import ReminderPicker from "../components/ReminderPicker";
import { reminderColumns, reminderFromRow, type ReminderValue } from "../lib/reminders";
import {
  FREQUENCIES, FREQUENCY_LABEL, describeRule, isWeekBased, nextOccurrence, parseRule, zonedToUtc,
  type Frequency, type RecurrenceRule,
} from "../lib/recurrence";
import { usePreferencesStore } from "../state/stores/preferencesStore";
import { getTodayInTimeZone, utcIsoToDateInput, zonedDateTimeToUtcIso } from "../lib/datetime";

type Task = Record<string, any>;
type TaskScope = "daily" | "shopping" | "all";

const PRIORITY_BADGE: Record<number, string> = {
  1: "badge-danger",
  2: "badge-warning",
  3: "badge-warning",
  4: "badge-info",
  5: "badge-neutral",
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
  if (diff < 0) return { text: `איחור ${Math.abs(diff)}d`, cls: "text-danger" };
  if (diff === 0) return { text: "היום", cls: "text-accent-400" };
  if (diff === 1) return { text: "מחר", cls: "text-success" };
  if (diff <= 7) return { text: `${diff} ימים`, cls: "text-warning" };
  return { text: new Date(d + "T12:00:00").toLocaleDateString("he-IL", { day: "numeric", month: "numeric" }), cls: "text-theme-muted" };
}

interface RecurrenceState {
  freq: Frequency;
  days: number[];
  time: string;
  /** First/next date for monthly-based frequencies (its day of month — and month, for yearly — set the schedule) */
  start: string;
}

function buildRule(r: RecurrenceState): RecurrenceRule {
  return isWeekBased(r.freq)
    ? { freq: r.freq, days: r.days, time: r.time }
    : { freq: r.freq, day: Number(r.start.slice(8, 10)), time: r.time };
}

/** When a newly configured recurring task first comes up */
function firstOccurrence(r: RecurrenceState, timeZone: string): string | null {
  return isWeekBased(r.freq)
    ? nextOccurrence(buildRule(r), timeZone, new Date())
    : zonedToUtc(r.start, r.time, timeZone);
}

function RecurrenceField({ value, onChange }: { value: RecurrenceState; onChange: (v: RecurrenceState) => void }) {
  const set = (patch: Partial<RecurrenceState>) => onChange({ ...value, ...patch });
  const toggle = (d: number) => set({ days: value.days.includes(d) ? value.days.filter((x) => x !== d) : [...value.days, d].sort() });
  const monthly = !isWeekBased(value.freq);
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-theme-muted block mb-1.5">תדירות</label>
        <div className="grid grid-cols-4 gap-1.5">
          {FREQUENCIES.map((f) => (
            <button key={f} type="button" onClick={() => set({ freq: f })}
              className={"py-2 rounded-lg text-xs font-medium border transition-colors " +
                (value.freq === f ? "bg-accent-600 border-accent-600 text-white" : "border-slate-700 text-theme-muted hover:text-theme")}>
              {FREQUENCY_LABEL[f]}
            </button>
          ))}
        </div>
      </div>
      {monthly ? (
        <AppCalendar label={value.freq === "yearly" ? "תאריך (היום והחודש חוזרים כל שנה)" : "מועד ראשון (היום בחודש קובע)"}
          value={value.start} onChange={(v) => set({ start: v })} mode="date" placeholder="בחר תאריך" />
      ) : (
        <div>
          <label className="text-xs text-theme-muted block mb-1.5">ימי חזרה</label>
          <div className="flex gap-1.5 flex-wrap">
            {DAY_LABELS.map((lbl, idx) => (
              <button key={idx} type="button" onClick={() => toggle(idx)}
                className={"w-10 h-10 sm:w-9 sm:h-9 rounded-lg text-sm sm:text-xs font-semibold border transition-colors " +
                  (value.days.includes(idx) ? "bg-accent-600 border-accent-600 text-white" : "border-slate-700 text-theme-muted hover:border-accent-500 hover:text-theme")}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <label className="text-xs text-theme-muted block mb-1">שעת ביצוע קבועה</label>
        <input type="time" value={value.time} onChange={(e) => set({ time: e.target.value })} className="input-base text-sm w-32" />
      </div>
      {(monthly ? value.start : value.days.length > 0) && (
        <p className="text-xs text-accent-400">{describeRule(buildRule(value), value.start)}</p>
      )}
    </div>
  );
}

/** Recurrence settings of an existing task (or defaults) */
function recurrenceFromTask(task: Task | null, timeZone: string, today: string): RecurrenceState {
  const rule = parseRule(task?.recurrence_rule);
  const current = task?.scheduled_start_at ?? task?.due_at;
  return {
    freq: rule?.freq ?? "weekly",
    days: rule?.days ?? [],
    time: rule?.time ?? "09:00",
    start: current ? utcIsoToDateInput(current, timeZone) : today,
  };
}

/** Valid enough to save: weekly needs days, the others a first date */
const recurrenceReady = (r: RecurrenceState) => (isWeekBased(r.freq) ? r.days.length > 0 : !!r.start);

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
  const [recurrence, setRecurrence] = useState<RecurrenceState>(() => recurrenceFromTask(null, timeZone, getTodayInTimeZone(timeZone)));
  const [reminder, setReminder] = useState<ReminderValue>({ preset: "none", custom: "" });
  const itemIso = toUtcIso(taskType === "priority" ? dueAt : scheduledStart, timeZone);

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (isRecurring && !recurrenceReady(recurrence)) return;
          const recurrenceRule = isRecurring ? JSON.stringify(buildRule(recurrence)) : null;
          const nextOccurrence = isRecurring ? firstOccurrence(recurrence, timeZone) : null;
          onAdd({
            title, task_type: taskType, status: "todo", module: "general", source_type: "manual",
            priority_level: taskType === "priority" ? Number(priority) : null,
            due_at: isRecurring ? (taskType === "priority" ? nextOccurrence : null) : toUtcIso(dueAt, timeZone),
            scheduled_start_at: isRecurring ? (taskType === "time_sensitive" ? nextOccurrence : null) : toUtcIso(scheduledStart, timeZone),
            description: desc || null, assigned_to: assignedTo || null,
            is_recurring: isRecurring, recurrence_rule: recurrenceRule,
            ...(isRecurring ? {} : reminderColumns(reminder, itemIso, timeZone)),
          });
          onClose();
        }}
        className="modal-panel bg-slate-900 border-slate-700 sm:max-w-md space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-theme">משימה חדשה</h3>
          <button type="button" onClick={onClose} className="-m-2 p-2 rounded-lg text-theme-muted hover:text-theme" aria-label="סגור"><Icon name="x" className="w-5 h-5" /></button>
        </div>

        {/* Title */}
        <div>
          <label className="text-xs text-theme-muted block mb-1">כותרת *</label>
          <input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} className="input-base w-full" placeholder="שם המשימה" enterKeyHint="done" />
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
              <div className="text-[11px] opacity-70">שבועית, חודשית, שנתית…</div>
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
        {!isRecurring && <ReminderPicker value={reminder} onChange={setReminder} itemIso={itemIso} timeZone={timeZone} />}

        {/* Recurrence config */}
        {isRecurring && (
          <div className="bg-slate-950/60 border border-slate-700 rounded-xl p-3">
            <RecurrenceField value={recurrence} onChange={setRecurrence} />
          </div>
        )}

        {/* Description */}
        <div>
          <label className="text-xs text-theme-muted block mb-1">תיאור</label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} className="input-base w-full resize-none" placeholder="פרטים נוספים..." />
        </div>

        <button type="submit" className="w-full bg-accent-600 hover:bg-accent-500 text-white font-medium py-3 sm:py-2.5 rounded-xl sm:rounded-lg text-sm transition-colors">
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
  const [recurrence, setRecurrence] = useState<RecurrenceState>(() => recurrenceFromTask(task, timeZone, getTodayInTimeZone(timeZone)));
  const [reminder, setReminder] = useState<ReminderValue>(() => reminderFromRow(task, timeZone));
  const itemIso = toUtcIso(task.task_type === "priority" ? dueAt : scheduledStart, timeZone);

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (isRecurring && !recurrenceReady(recurrence)) return;
          const recurrenceRule = isRecurring ? JSON.stringify(buildRule(recurrence)) : null;
          // Monthly-based: the chosen date is the next occurrence
          const recurringDate = isRecurring && !isWeekBased(recurrence.freq) ? firstOccurrence(recurrence, timeZone) : null;
          onSave({
            id: task.id, title, status, assigned_to: assignedTo || null,
            priority_level: task.task_type === "priority" ? Number(priority) : task.priority_level,
            due_at: recurringDate && task.task_type === "priority" ? recurringDate : toUtcIso(dueAt, timeZone),
            scheduled_start_at: recurringDate && task.task_type === "time_sensitive" ? recurringDate : toUtcIso(scheduledStart, timeZone),
            description: desc || null, is_recurring: isRecurring, recurrence_rule: recurrenceRule,
            ...(isRecurring ? {} : reminderColumns(reminder, itemIso, timeZone, task.whatsapp_remind_at)),
          });
          onClose();
        }}
        className="modal-panel bg-slate-900 border-slate-700 sm:max-w-md space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-theme">עריכת משימה</h3>
          <button type="button" onClick={onClose} className="-m-2 p-2 rounded-lg text-theme-muted hover:text-theme" aria-label="סגור"><Icon name="x" className="w-5 h-5" /></button>
        </div>
        <div>
          <label className="text-xs text-theme-muted block mb-1">כותרת *</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="input-base w-full" />
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
        {!isRecurring && <ReminderPicker value={reminder} onChange={setReminder} itemIso={itemIso} timeZone={timeZone} />}
        {isRecurring && (
          <div className="bg-slate-950/60 border border-slate-700 rounded-xl p-3">
            <RecurrenceField value={recurrence} onChange={setRecurrence} />
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
        <button type="submit" className="w-full bg-accent-600 hover:bg-accent-500 text-white font-medium py-3 sm:py-2.5 rounded-xl sm:rounded-lg text-sm transition-colors">שמור שינויים</button>
      </form>
    </div>
  );
}

/** Ticking off a shopping task records the purchase in the stock; the DB then closes the task */
function BoughtSheet({ item, onClose, onConfirm }: {
  item: Task; onClose: () => void; onConfirm: (bought: number) => void;
}) {
  const missing = Math.max(0, Number(item.critical_threshold) - Number(item.quantity));
  const [bought, setBought] = useState(Math.max(1, Math.ceil(missing)));
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel bg-slate-900 border-slate-700 sm:max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-theme">קנית {item.name}?</h3>
          <button type="button" onClick={onClose} className="-m-2 p-2 rounded-lg text-theme-muted hover:text-theme" aria-label="סגור"><Icon name="x" className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-theme-muted">כמה {item.unit} קנית? המלאי יתעדכן והמשימה תיסגר.</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setBought((b) => Math.max(0.5, b - 1))}
            className="w-12 h-12 shrink-0 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-theme" aria-label="פחות">
            <Icon name="minus" className="w-4 h-4" />
          </button>
          <input type="number" inputMode="decimal" min="0" step="0.5" value={bought} onChange={(e) => setBought(Number(e.target.value))}
            className="input-base w-full text-center text-lg font-bold" />
          <button type="button" onClick={() => setBought((b) => b + 1)}
            className="w-12 h-12 shrink-0 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-theme" aria-label="יותר">
            <Icon name="plus" className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-theme-muted text-center">
          במלאי אחרי הקנייה: {Number(item.quantity) + (bought || 0)} {item.unit} (מינימום {Number(item.critical_threshold)})
        </p>
        <button type="button" disabled={!(bought > 0)} onClick={() => onConfirm(bought)}
          className="w-full bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white font-medium py-3 sm:py-2.5 rounded-xl sm:rounded-lg text-sm">
          עדכן מלאי
        </button>
      </div>
    </div>
  );
}

export default function Tasks() {
  const navigate = useNavigate();
  const timeZone = usePreferencesStore((s) => s.timeZone);
  const today = getTodayInTimeZone(timeZone);
  const { data: tasks = [], createTask, updateTask, deleteTask, members = [] } = useTasks();
  const { data: inventory = [], upsertItem } = useInventory();
  const [buying, setBuying] = useState<Task | null>(null);
  const queryClient = useQueryClient();
  // Shopping tasks point at their inventory item (per-item tasks, see migration 010)
  const itemFor = (task: Task) => inventory.find((i) => i.id === task.source_id);
  const [showModal, setShowModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [params, setParams] = useSearchParams();
  const [taskScope, setTaskScope] = useState<TaskScope>(() => (params.get("scope") === "shopping" ? "shopping" : "daily"));
  const [filterType, setFilterType] = useState<"all" | "priority" | "time_sensitive">("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [recurrenceFilter, setRecurrenceFilter] = useState<"all" | "recurring" | "one_time">("all");
  const [showDone, setShowDone] = useState(false);

  const isShoppingTask = (task: Task) => task.module === "inventory" || task.source_type === "inventory_threshold";

  // Links from WhatsApp: ?open=<taskId> opens that task (shopping → "how much did you buy?"),
  // ?buy=<itemId> opens the buy sheet for a shopping item. Handled once, when the data is loaded.
  useEffect(() => {
    const openId = params.get("open");
    const buyId = params.get("buy");
    if (!openId && !buyId) return;
    if (openId) {
      const task = tasks.find((t) => t.id === openId);
      if (!task) return; // wait for tasks to load
      const item = isShoppingTask(task) && task.status !== "done" ? itemFor(task) : undefined;
      if (item) setBuying(item);
      else setEditingTask(task);
      if (isShoppingTask(task)) setTaskScope("shopping");
    } else if (buyId) {
      const item = inventory.find((i) => i.id === buyId);
      if (!item) return; // wait for inventory to load
      setBuying(item);
    }
    const next = new URLSearchParams(params);
    next.delete("open");
    next.delete("buy");
    setParams(next, { replace: true });
  }, [params, tasks, inventory]);
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

  /** A recurring task was completed: create its next occurrence */
  const spawnNext = (task: Task) => {
    const rule = parseRule(task.recurrence_rule);
    if (!task.is_recurring || !rule) return;
    const nextDate = nextOccurrence(rule, timeZone, new Date(), task.scheduled_start_at ?? task.due_at);
    if (!nextDate) return;
    createTask.mutate({
      title: task.title, description: task.description,
      task_type: task.task_type, module: task.module, source_type: "recurring",
      priority_level: task.priority_level,
      scheduled_start_at: task.task_type === "time_sensitive" ? nextDate : null,
      due_at: task.task_type === "priority" ? nextDate : null,
      is_recurring: true, recurrence_rule: task.recurrence_rule,
      assigned_to: task.assigned_to, status: "todo",
    });
  };

  const handleStatusChange = (id: string, status: string, task?: Task) => {
    updateTask.mutate({ id, status });
    if (status === "done" && task) spawnNext(task);
  };

  const TaskRow = ({ task }: { task: Task }) => {
    const dateIso = task.scheduled_start_at ?? task.due_at;
    const relDate = dateIso && task.status !== "done" ? relativeDateLabel(dateIso, today) : null;
    const isDone = task.status === "done";
    const isInProgress = task.status === "in_progress";

    const meta = (
      <>
        {task.priority_level && !isDone && (
          <span className={"text-[11px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-semibold " + (PRIORITY_BADGE[task.priority_level] ?? "")}>
            {PRIORITY_LABEL[task.priority_level] ?? `P${task.priority_level}`}
          </span>
        )}
        {relDate && (
          <span className={"text-[11px] font-medium " + relDate.cls}>{relDate.text}</span>
        )}
      </>
    );

    return (
      <div className={"flex items-center gap-1 sm:gap-2 rounded-xl border ps-1 pe-1 sm:ps-2 sm:pe-2 py-1 sm:py-1.5 transition-colors " +
        (isDone ? "border-slate-800/50 bg-slate-950/30 opacity-60"
          : isInProgress ? "border-accent-800/60 bg-accent-950/20"
          : "border-slate-800 bg-slate-900")}>
        {/* Checkbox – large hit area around a small circle */}
        <button
          onClick={() => {
            const item = !isDone && isShoppingTask(task) ? itemFor(task) : undefined;
            if (item) setBuying(item); else handleStatusChange(task.id, isDone ? "todo" : "done", task);
          }}
          className="p-2.5 shrink-0 rounded-lg"
          aria-label={isDone ? "סמן כלא בוצע" : "סמן כבוצע"}
        >
          <span className={"w-6 h-6 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center transition-colors " +
            (isDone ? "bg-emerald-600 border-emerald-600" : isInProgress ? "border-accent-500" : "border-slate-600 hover:border-slate-400")}>
            {isDone && <Icon name="check" className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-white" />}
            {isInProgress && <span className="w-2 h-2 rounded-full bg-accent-400" />}
          </span>
        </button>

        {/* Content – tap to edit */}
        <button type="button" onClick={() => setEditingTask(task)} className="flex-1 min-w-0 text-right py-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {task.is_recurring && <Icon name="repeat" className="w-3 h-3 text-accent-400 shrink-0" />}
            {task.is_recurring && (() => {
              const freq = parseRule(task.recurrence_rule)?.freq;
              return freq && freq !== "weekly" && <span className="text-[11px] text-accent-400 shrink-0">{FREQUENCY_LABEL[freq]}</span>;
            })()}
            {task.whatsapp_remind_at && !task.whatsapp_reminded_at && !isDone && (
              <Icon name="chat" className="w-3 h-3 text-accent-400 shrink-0" title="תזכורת בוואטסאפ" />
            )}
            <span className={"text-[15px] sm:text-sm font-medium leading-snug " + (isDone ? "line-through text-theme-muted" : "text-theme")}>
              {task.title}
            </span>
            {isInProgress && (
              <span className="text-[11px] sm:text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent-900 text-accent-300">בביצוע</span>
            )}
          </div>
          {(() => {
            const item = isShoppingTask(task) ? itemFor(task) : undefined;
            if (!item) return task.description && <p className="text-xs text-theme-muted truncate mt-0.5 opacity-70">{task.description}</p>;
            const qty = Number(item.quantity);
            const min = Number(item.critical_threshold);
            const toBuy = Math.max(0, min - qty);
            return (
              <p className="text-xs mt-0.5 flex flex-wrap gap-x-2">
                <span className="text-theme-muted">נשאר {qty} {item.unit}</span>
                <span className="text-theme-muted">· מינימום {min}</span>
                {!isDone && toBuy > 0 && <span className="text-warning font-medium">· לקנות {toBuy} {item.unit}</span>}
              </p>
            );
          })()}
          {(relDate || (task.priority_level && !isDone)) && (
            <div className="flex items-center gap-2 mt-1 sm:hidden">{meta}</div>
          )}
        </button>

        {/* Meta + actions */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">{meta}</div>
        <div className="flex items-center shrink-0">
          <button onClick={() => setEditingTask(task)} className="hidden sm:block p-2 text-slate-600 hover:text-accent-400 rounded-lg hover:bg-slate-800 transition-colors" aria-label="עריכה">
            <Icon name="edit" className="w-4 h-4" />
          </button>
          <button onClick={() => setPendingDelete(task.id)} className="p-2.5 sm:p-2 text-slate-600 hover:text-danger rounded-lg hover:bg-slate-800 transition-colors" aria-label="מחיקה">
            <Icon name="trash" className="w-4 h-4" />
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
        <button onClick={() => setShowModal(true)} className="hidden md:flex bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors items-center gap-1.5">
          <Icon name="plus" className="w-3.5 h-3.5" /> הוספת משימה
        </button>
      </div>

      {/* Scope tabs */}
      <div className="mb-3 grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-2">
        {([["daily", "היומיום"], ["shopping", "קניות"], ["all", "הכול"]] as const).map(([scope, label]) => (
          <button key={scope} onClick={() => setTaskScope(scope)}
            className={"px-3 py-2.5 sm:py-1.5 rounded-xl sm:rounded-lg text-sm sm:text-xs font-medium transition-colors border " +
              (taskScope === scope ? "bg-accent-700 border-accent-600 text-white" : "bg-slate-900 border-slate-800 text-theme-muted hover:text-theme")}>
            {label}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="mb-5 -mx-3 px-3 sm:mx-0 sm:px-0 flex flex-nowrap sm:flex-wrap items-center gap-2 overflow-x-auto no-scrollbar">
        <div className="flex shrink-0 rounded-lg bg-slate-900 border border-slate-800 p-0.5">
          {([["all", "הכל"], ["recurring", "חזרתיות"], ["one_time", "חד-פעמיות"]] as const).map(([value, label]) => (
            <button key={value} onClick={() => setRecurrenceFilter(value)}
              className={"px-3 py-2 sm:py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors " +
                (recurrenceFilter === value ? "bg-accent-700 text-white" : "text-theme-muted hover:text-theme")}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 rounded-lg bg-slate-900 border border-slate-800 p-0.5">
          {(["all", "priority", "time_sensitive"] as const).map((f) => (
            <button key={f} onClick={() => setFilterType(f)}
              className={"px-3 py-2 sm:py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors " +
                (filterType === f ? "bg-slate-700 text-theme" : "text-theme-muted hover:text-theme")}>
              {f === "all" ? "הכל" : f === "priority" ? "רגילות" : "מתוזמנות"}
            </button>
          ))}
        </div>
        {members.length > 0 && (
          <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className="input-base text-xs py-1.5 shrink-0">
            <option value="all">כל המשפחה</option>
            <option value="">ללא אחראי</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
          </select>
        )}
      </div>

      {/* Shopping alert */}
      {taskScope === "daily" && openShoppingCount > 0 && (
        <div className="mb-5 rounded-2xl border alert-warning px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon name="package" className="w-4 h-4 text-warning shrink-0" />
            <span className="text-sm text-warning">{openShoppingCount} פריטים לקנייה ממתינים</span>
          </div>
          <div className="flex gap-2 shrink-0">
              <button onClick={() => setTaskScope("shopping")} className="px-3 py-2 sm:py-1.5 rounded-lg bg-accent-600 hover:bg-accent-500 text-white text-xs font-medium">הצג</button>
            <button onClick={() => navigate("/inventory")} className="px-3 py-2 sm:py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-theme text-xs">לרשימה</button>
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
            className="flex items-center gap-2 text-xs text-theme-muted hover:text-theme transition-colors mb-2 w-full py-2"
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

      <div className="h-20 md:hidden" aria-hidden="true" />
      <Fab label="משימה" onClick={() => setShowModal(true)} />

      {/* Modals */}
      {showModal && <AddTaskModal onClose={() => setShowModal(false)} onAdd={(task) => createTask.mutate(task)} members={members as Array<{ id: string; display_name: string }>} />}
      {editingTask && <EditTaskModal task={editingTask} onClose={() => setEditingTask(null)}
        onSave={(t) => {
          updateTask.mutate(t);
          // Marked done from the edit sheet (e.g. opened from a WhatsApp link) → next occurrence too
          if (t.status === "done" && editingTask.status !== "done") spawnNext({ ...editingTask, ...t });
        }} members={members as Array<{ id: string; display_name: string }>} />}
      {buying && (
        <BoughtSheet item={buying} onClose={() => setBuying(null)}
          onConfirm={(bought) => {
            // The DB trigger closes the shopping task once stock is back above the minimum
            upsertItem.mutate({ ...buying, quantity: Number(buying.quantity) + bought },
              { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }) });
            setBuying(null);
          }} />
      )}
      {pendingDelete && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPendingDelete(null); }}>
          <div className="modal-panel sm:max-w-sm border-slate-700 bg-slate-900">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="warning" className="w-5 h-5 text-danger" />
              <h3 className="text-base font-semibold text-theme">למחוק משימה זו?</h3>
            </div>
            <p className="text-sm text-theme-muted mt-1">הפעולה אינה ניתנת לביטול.</p>
            <div className="grid grid-cols-2 gap-2 mt-5 sm:flex sm:justify-end sm:mt-4">
              <button onClick={() => setPendingDelete(null)} className="px-4 py-2.5 sm:py-2 rounded-xl sm:rounded-lg text-sm font-medium bg-slate-800 text-theme-muted hover:bg-slate-700">ביטול</button>
              <button onClick={() => { deleteTask.mutate(pendingDelete); setPendingDelete(null); }} className="px-4 py-2.5 sm:py-2 rounded-xl sm:rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-500">מחיקה</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
