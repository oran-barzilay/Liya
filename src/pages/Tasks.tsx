import { useState, useRef } from "react";
import { useTasks } from "../hooks/useTasks";
import { useUiStore } from "../state/stores/uiStore";
import Icon from "../components/Icon";
import AppCalendar from "../components/AppCalendar";
import { usePreferencesStore } from "../state/stores/preferencesStore";
import { formatInTimeZone, getTodayInTimeZone, utcIsoToDateTimeInput, zonedDateTimeToUtcIso } from "../lib/datetime";
type Task = Record<string, any>;
const STATUS_LABEL: Record<string, string> = { todo: "לביצוע", in_progress: "בביצוע", done: "בוצע" };
const STATUS_COLOR: Record<string, string> = {
  todo: "border-slate-700",
  in_progress: "border-accent-700",
  done: "border-emerald-800",
};
const PRIORITY_BADGE: Record<number, string> = {
  1: "bg-red-900 text-red-300",
  2: "bg-orange-900 text-orange-300",
  3: "bg-amber-900 text-amber-300",
  4: "bg-blue-900 text-blue-300",
  5: "bg-slate-800 text-slate-400",
};
const STATUSES = ["todo", "in_progress", "done"] as const;
const DAY_LABELS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
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
function addDays(date: string, n: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function formatDayHeader(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("he-IL", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  });
}
function TaskCard({ task, onStatusChange, onDelete, onEdit }: {
  task: Task; onStatusChange: (s: string) => void; onDelete: () => void; onEdit: () => void;
}) {
  const timeZone = usePreferencesStore((s) => s.timeZone);
  const nextStatus: Record<string, string> = { todo: "in_progress", in_progress: "done", done: "todo" };
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2 group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {task.is_recurring && <Icon name="repeat" className="w-3 h-3 text-accent-400 shrink-0" title="חזרתי" />}
          {task.module === "inventory" && <Icon name="layers" className="w-3 h-3 text-amber-400 shrink-0" title="מלאי" />}
          <span className="text-sm font-medium leading-snug text-theme truncate">{task.title}</span>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={onEdit} className="text-slate-600 hover:text-accent-400"><Icon name="edit" className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete} className="text-slate-600 hover:text-red-400"><Icon name="trash" className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {task.description && <p className="text-xs text-theme-muted line-clamp-2">{task.description}</p>}
      <div className="flex items-center gap-2 flex-wrap">
        {task.priority_level && <span className={"text-xs px-1.5 py-0.5 rounded font-medium " + (PRIORITY_BADGE[task.priority_level] ?? "")}>P{task.priority_level}</span>}
        {task.due_at && <span className="text-xs text-theme-muted">יעד {new Date(task.due_at).toLocaleDateString("he-IL")}</span>}
        {task.scheduled_start_at && <span className="text-xs text-accent-400">{formatInTimeZone(task.scheduled_start_at, timeZone, { hour: "2-digit", minute: "2-digit" })}</span>}
      </div>
      <button onClick={() => onStatusChange(nextStatus[task.status] ?? "todo")} className="text-xs text-theme-muted hover:text-accent-400 transition-colors">
        העבר ל-{STATUS_LABEL[nextStatus[task.status] ?? "todo"]}
      </button>
    </div>
  );
}
function RecurrenceField({ days, setDays, time, setTime }: {
  days: number[]; setDays: (d: number[]) => void;
  time: string; setTime: (t: string) => void;
}) {
  const toggle = (d: number) => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort());
  return (
    <div className="space-y-2">
      <div>
        <label className="text-xs text-theme-muted block mb-1.5">ימי חזרה</label>
        <div className="flex gap-1.5">
          {DAY_LABELS.map((lbl, idx) => (
            <button key={idx} type="button" onClick={() => toggle(idx)}
              className={"w-8 h-8 rounded-lg text-xs font-medium border transition-colors " +
                (days.includes(idx) ? "bg-accent-600 border-accent-600 text-white" : "border-slate-700 text-theme-muted hover:border-accent-500")}>
              {lbl}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs text-theme-muted block mb-1">שעת ביצוע</label>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input-base text-sm" />
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
          onAdd({
            title, task_type: taskType, status: "todo", module: "general", source_type: "manual",
            priority_level: taskType === "priority" ? Number(priority) : null,
            due_at: dueAt ? zonedDateTimeToUtcIso(dueAt, timeZone) : null,
            scheduled_start_at: scheduledStart ? zonedDateTimeToUtcIso(scheduledStart, timeZone) : null,
            description: desc || null, assigned_to: assignedTo || null,
            is_recurring: isRecurring, recurrence_rule: recurrenceRule,
          });
          onClose();
        }}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-md space-y-4 my-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-theme">משימה חדשה</h3>
          <button type="button" onClick={onClose} className="text-theme-muted hover:text-theme"><Icon name="x" className="w-4 h-4" /></button>
        </div>
        <div>
          <label className="text-xs text-theme-muted block mb-1">כותרת *</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="input-base w-full" placeholder="כותרת המשימה" />
        </div>
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
              <label className="text-xs text-theme-muted block mb-1">עדיפות (1=גבוה)</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="input-base w-full">
                {[1,2,3,4,5].map((p) => <option key={p} value={p}>P{p}</option>)}
              </select>
            </div>
          )}
        </div>
        <div>
          <label className="text-xs text-theme-muted block mb-1">אחראי</label>
          <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="input-base w-full">
            <option value="">ללא שיוך</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
          </select>
        </div>
        {taskType === "priority" ? (
          <AppCalendar label="תאריך יעד" value={dueAt} onChange={setDueAt} mode="datetime" placeholder="בחר תאריך ושעה" />
        ) : (
          <AppCalendar label="מועד מתוזמן" value={scheduledStart} onChange={setScheduledStart} mode="datetime" placeholder="בחר תאריך ושעה" />
        )}
        <div>
          <label className="text-xs text-theme-muted block mb-1">תיאור</label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} className="input-base w-full resize-none" placeholder="פרטים נוספים..." />
        </div>
        <div className="border-t border-slate-700 pt-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 accent-accent-600" />
            <span className="text-sm text-theme flex items-center gap-1.5">
              <Icon name="repeat" className="w-3.5 h-3.5 text-accent-400" /> משימה חזרתית
            </span>
          </label>
          {isRecurring && (
            <div className="mt-3">
              <RecurrenceField days={recurDays} setDays={setRecurDays} time={recurTime} setTime={setRecurTime} />
            </div>
          )}
        </div>
        <button type="submit" className="w-full bg-accent-600 hover:bg-accent-500 text-white font-medium py-2 rounded-lg text-sm transition-colors">
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
  const [dueAt, setDueAt] = useState(task.due_at ? utcIsoToDateTimeInput(task.due_at, timeZone) : "");
  const [scheduledStart, setScheduledStart] = useState(task.scheduled_start_at ? utcIsoToDateTimeInput(task.scheduled_start_at, timeZone) : "");
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
            due_at: dueAt ? zonedDateTimeToUtcIso(dueAt, timeZone) : null,
            scheduled_start_at: scheduledStart ? zonedDateTimeToUtcIso(scheduledStart, timeZone) : null,
            description: desc || null, is_recurring: isRecurring, recurrence_rule: recurrenceRule,
          });
          onClose();
        }}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-md space-y-4 my-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-theme">עריכת משימה</h3>
          <button type="button" onClick={onClose} className="text-theme-muted hover:text-theme"><Icon name="x" className="w-4 h-4" /></button>
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
                {[1,2,3,4,5].map((p) => <option key={p} value={p}>P{p}</option>)}
              </select>
            </div>
          )}
        </div>
        <div>
          <label className="text-xs text-theme-muted block mb-1">אחראי</label>
          <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="input-base w-full">
            <option value="">ללא שיוך</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
          </select>
        </div>
        {task.task_type === "priority" ? (
          <AppCalendar label="תאריך יעד" value={dueAt} onChange={setDueAt} mode="datetime" placeholder="בחר תאריך ושעה" />
        ) : (
          <AppCalendar label="מועד מתוזמן" value={scheduledStart} onChange={setScheduledStart} mode="datetime" placeholder="בחר תאריך ושעה" />
        )}
        <div>
          <label className="text-xs text-theme-muted block mb-1">תיאור</label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} className="input-base w-full resize-none" />
        </div>
        <div className="border-t border-slate-700 pt-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="w-4 h-4 rounded border-slate-600 bg-slate-800" />
            <span className="text-sm text-theme flex items-center gap-1.5">
              <Icon name="repeat" className="w-3.5 h-3.5 text-accent-400" /> משימה חזרתית
            </span>
          </label>
          {isRecurring && (
            <div className="mt-3">
              <RecurrenceField days={recurDays} setDays={setRecurDays} time={recurTime} setTime={setRecurTime} />
            </div>
          )}
        </div>
        <button type="submit" className="w-full bg-accent-600 hover:bg-accent-500 text-white font-medium py-2 rounded-lg text-sm transition-colors">שמור שינויים</button>
      </form>
    </div>
  );
}
export default function Tasks() {
  const timeZone = usePreferencesStore((s) => s.timeZone);
  const { data: tasks = [], createTask, updateTask, deleteTask, members = [] } = useTasks();
  const { taskBoardView, setTaskBoardView, selectedDate, setSelectedDate } = useUiStore();
  const [showModal, setShowModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filterType, setFilterType] = useState<"all" | "priority" | "time_sensitive">("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [timelineMode, setTimelineMode] = useState<"1" | "3" | "7">("1");
  const [showCalPicker, setShowCalPicker] = useState(false);
  const calPickerRef = useRef<HTMLDivElement>(null);
  const visible = tasks.filter((t) => {
    if (t.status === "cancelled") return false;
    if (filterType !== "all" && t.task_type !== filterType) return false;
    if (filterAssignee !== "all" && t.assigned_to !== filterAssignee) return false;
    return true;
  });
  const handleStatusChange = (id: string, status: string, task?: Task) => {
    updateTask.mutate({ id, status });
    // If recurring and being set to done, create next occurrence
    if (status === "done" && task?.is_recurring && task?.recurrence_rule) {
      const nextDate = getNextOccurrence(task.recurrence_rule);
      if (nextDate) {
        createTask.mutate({
          title: task.title,
          description: task.description,
          task_type: task.task_type,
          module: task.module,
          source_type: "recurring",
          priority_level: task.priority_level,
          scheduled_start_at: task.task_type === "time_sensitive" ? nextDate : null,
          due_at: task.task_type === "priority" ? nextDate : null,
          is_recurring: true,
          recurrence_rule: task.recurrence_rule,
          assigned_to: task.assigned_to,
          status: "todo",
        });
      }
    }
  };
  const KanbanView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {STATUSES.map((status) => {
        const col = visible.filter((t) => t.status === status);
        return (
          <div key={status} className={"rounded-xl border " + STATUS_COLOR[status] + " bg-slate-900/50 p-3"}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{STATUS_LABEL[status]}</span>
              <span className="text-xs bg-slate-800 text-slate-400 rounded-full px-2 py-0.5">{col.length}</span>
            </div>
            <div className="space-y-2">
              {col.map((task) => (
                <TaskCard key={task.id} task={task}
                  onStatusChange={(s) => handleStatusChange(task.id, s, task)}
                  onDelete={() => setPendingDelete(task.id)}
                  onEdit={() => setEditingTask(task)} />
              ))}
              {col.length === 0 && <div className="text-xs text-slate-600 text-center py-4">ריק</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
  const ListView = () => {
    const sorted = [...visible].sort((a, b) => {
      if (a.status === "done" && b.status !== "done") return 1;
      if (b.status === "done" && a.status !== "done") return -1;
      return (a.priority_level ?? 99) - (b.priority_level ?? 99);
    });
    return (
      <div className="space-y-2">
        {sorted.map((task) => (
          <div key={task.id} className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
            <button
              onClick={() => handleStatusChange(task.id, task.status === "done" ? "todo" : "done", task)}
              className={"w-4 h-4 rounded border shrink-0 flex items-center justify-center " +
                (task.status === "done" ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-600")}>
              {task.status === "done" && <Icon name="check" className="w-3 h-3" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {task.is_recurring && <Icon name="repeat" className="w-3 h-3 text-accent-400 shrink-0" />}
                <span className={"text-sm font-medium " + (task.status === "done" ? "line-through text-theme-muted opacity-60" : "text-theme")}>{task.title}</span>
              </div>
              {task.description && <p className="text-xs text-theme-muted truncate opacity-70">{task.description}</p>}
            </div>
            {task.priority_level && <span className={"text-xs px-2 py-0.5 rounded-full font-medium " + PRIORITY_BADGE[task.priority_level]}>P{task.priority_level}</span>}
             {task.due_at && <span className="text-xs text-theme-muted hidden sm:block">{formatInTimeZone(task.due_at, timeZone, { year: "numeric", month: "2-digit", day: "2-digit" })}</span>}
            <button onClick={() => setEditingTask(task)} className="text-slate-600 hover:text-accent-400 transition-colors"><Icon name="edit" className="w-3.5 h-3.5" /></button>
            <button onClick={() => setPendingDelete(task.id)} className="text-slate-600 hover:text-red-400 transition-colors"><Icon name="trash" className="w-3.5 h-3.5" /></button>
          </div>
        ))}
        {sorted.length === 0 && <div className="text-center py-12 text-slate-500">אין משימות עדיין. הוסף אחת.</div>}
      </div>
    );
  };
  const TimelineView = () => {
    const nDays = Number(timelineMode);
    const dates: string[] = [];
    for (let i = 0; i < nDays; i++) dates.push(addDays(selectedDate, i));
    const prevPeriod = () => setSelectedDate(addDays(selectedDate, -nDays));
    const nextPeriod = () => setSelectedDate(addDays(selectedDate, +nDays));
    const dayTasksFor = (date: string) =>
      visible.filter((t) => t.task_type === "time_sensitive" && t.scheduled_start_at?.slice(0, 10) === date);
    const dateRangeLabel = nDays === 1
      ? formatInTimeZone(dates[0] + "T12:00:00", timeZone, { weekday: "long", month: "long", day: "numeric" })
      : `${formatInTimeZone(dates[0] + "T12:00:00", timeZone, { month: "numeric", day: "numeric" })} – ${formatInTimeZone(dates[dates.length - 1] + "T12:00:00", timeZone, { month: "numeric", day: "numeric" })}`;
    return (
      <div>
        {/* Timeline Controls */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-1">
            <button onClick={prevPeriod} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-theme-muted hover:text-theme transition-colors">
              <Icon name="chevron-right" className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-theme px-2 min-w-36 text-center">{dateRangeLabel}</span>
            <button onClick={nextPeriod} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-theme-muted hover:text-theme transition-colors">
              <Icon name="chevron-left" className="w-4 h-4" />
            </button>
          </div>
          <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
            {([["1","יום"],["3","3 ימים"],["7","שבוע"]] as const).map(([v, lbl]) => (
              <button key={v} onClick={() => setTimelineMode(v as "1"|"3"|"7")}
                className={"px-3 py-1.5 rounded-md text-xs font-medium transition-colors " +
                  (timelineMode === v ? "bg-accent-700 text-white" : "text-theme-muted hover:text-theme")}>
                {lbl}
              </button>
            ))}
          </div>
          <div ref={calPickerRef} className="relative">
            <button onClick={() => setShowCalPicker(!showCalPicker)}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-theme-muted hover:text-accent-400 transition-colors">
              <Icon name="calendar" className="w-4 h-4" />
            </button>
            {showCalPicker && (
              <div className="absolute top-full mt-1 z-50 left-0">
                <AppCalendar value={selectedDate} onChange={(d) => { setSelectedDate(d); setShowCalPicker(false); }} inline />
              </div>
            )}
          </div>
        </div>
        {/* Grid */}
        <div className="overflow-x-auto">
          <div style={{ minWidth: nDays > 1 ? nDays * 200 + 48 : "auto" }}>
            {/* Day column headers (multi-day only) */}
            {nDays > 1 && (
              <div className="grid mb-1" style={{ gridTemplateColumns: `3rem repeat(${nDays}, 1fr)` }}>
                <div />
                {dates.map((d) => (
                  <div key={d} className={"text-center text-xs py-2 font-medium rounded-t-lg " +
                    (d === getTodayInTimeZone(timeZone) ? "text-accent-400" : "text-theme-muted")}>
                    {formatDayHeader(d)}
                  </div>
                ))}
              </div>
            )}
            {/* Hour rows */}
            <div className="space-y-0.5">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="grid" style={{ gridTemplateColumns: nDays > 1 ? `3rem repeat(${nDays}, 1fr)` : "3rem 1fr" }}>
                  <span className="text-xs text-slate-600 pt-1.5 text-center">{String(h).padStart(2,"0")}:00</span>
                  {dates.map((d) => {
                    const hTasks = dayTasksFor(d).filter((t) => new Date(t.scheduled_start_at).getHours() === h);
                    return (
                      <div key={d} className={"border-r border-slate-800 px-1 pb-1 min-h-8 " + (nDays === 1 ? "flex-1" : "")}>
                        {hTasks.map((t) => (
                          <div key={t.id} className="bg-accent-900/40 border border-accent-800 rounded-lg px-2 py-1 mb-0.5 flex items-center justify-between gap-1">
                            <span className="text-xs text-theme truncate">{t.title}</span>
                            <button onClick={() => handleStatusChange(t.id, t.status === "done" ? "todo" : "done", t)}
                              className={"text-xs px-1.5 py-0.5 rounded-full shrink-0 " +
                                (t.status === "done" ? "bg-emerald-900 text-emerald-300" : "bg-slate-800 text-slate-400")}>
                              {t.status === "done" ? "✓" : "○"}
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        {visible.filter((t) => t.task_type === "time_sensitive" && dates.includes(t.scheduled_start_at?.slice(0,10))).length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm">אין משימות מתוזמנות בטווח הזמן הזה.</div>
        )}
      </div>
    );
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-theme">משימות</h2>
          <p className="text-theme-muted text-sm mt-0.5">{visible.filter((t) => t.status !== "done").length} פתוחות</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5">
          <Icon name="plus" className="w-3.5 h-3.5" /> הוספת משימה
        </button>
      </div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
          {(["all", "priority", "time_sensitive"] as const).map((f) => (
            <button key={f} onClick={() => setFilterType(f)}
              className={"px-3 py-1.5 rounded-md text-xs font-medium transition-colors " +
                (filterType === f ? "bg-slate-700 text-theme" : "text-theme-muted hover:text-theme")}>
              {f === "all" ? "הכל" : f === "priority" ? "עדיפות" : "מתוזמן"}
            </button>
          ))}
        </div>
        <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className="input-base text-xs py-1.5">
          <option value="all">כל המשפחה</option>
          <option value="">ללא אחראי</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
        </select>
        <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
          {(["kanban", "list", "timeline"] as const).map((v) => (
            <button key={v} onClick={() => setTaskBoardView(v)}
              className={"px-3 py-1.5 rounded-md text-xs font-medium transition-colors " +
                (taskBoardView === v ? "bg-accent-700 text-white" : "text-theme-muted hover:text-theme")}>
              {v === "kanban" ? "Kanban" : v === "list" ? "רשימה" : "ציר זמן"}
            </button>
          ))}
        </div>
      </div>
      {taskBoardView === "kanban" && <KanbanView />}
      {taskBoardView === "list" && <ListView />}
      {taskBoardView === "timeline" && <TimelineView />}
      {showModal && <AddTaskModal onClose={() => setShowModal(false)} onAdd={(task) => createTask.mutate(task)} members={members as Array<{ id: string; display_name: string }>} />}
      {editingTask && <EditTaskModal task={editingTask} onClose={() => setEditingTask(null)} onSave={(t) => updateTask.mutate(t)} members={members as Array<{ id: string; display_name: string }>} />}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="warning" className="w-5 h-5 text-red-400" />
              <h3 className="text-base font-semibold text-theme">למחוק משימה זו?</h3>
            </div>
            <p className="text-sm text-theme-muted mt-1">הפעולה אינה ניתנת לביטול.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setPendingDelete(null)} className="px-3 py-2 rounded-lg text-sm bg-slate-800 text-theme-muted hover:bg-slate-700">ביטול</button>
              <button onClick={() => { deleteTask.mutate(pendingDelete); setPendingDelete(null); }}
                className="px-3 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-500">מחיקה</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
