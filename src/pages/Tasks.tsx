import { useState } from "react";
import { useTasks } from "../hooks/useTasks";
import { useUiStore } from "../state/stores/uiStore";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Task = Record<string, any>;

const STATUSES = ["todo", "in_progress", "done"] as const;
const STATUS_LABEL: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done ✓",
};
const STATUS_COLOR: Record<string, string> = {
  todo: "border-slate-700",
  in_progress: "border-indigo-700",
  done: "border-emerald-800",
};
const PRIORITY_BADGE: Record<number, string> = {
  1: "bg-red-900 text-red-300",
  2: "bg-orange-900 text-orange-300",
  3: "bg-amber-900 text-amber-300",
  4: "bg-blue-900 text-blue-300",
  5: "bg-slate-800 text-slate-400",
};

function TaskCard({
  task,
  onStatusChange,
  onDelete,
}: {
  task: Task;
  onStatusChange: (status: string) => void;
  onDelete: () => void;
}) {
  const nextStatus: Record<string, string> = {
    todo: "in_progress",
    in_progress: "done",
    done: "todo",
  };
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2 group">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-snug">{task.title}</span>
        <button
          onClick={onDelete}
          className="text-slate-600 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        >
          ✕
        </button>
      </div>
      {task.description && (
        <p className="text-xs text-slate-400 line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {task.priority_level && (
          <span
            className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_BADGE[task.priority_level] ?? ""}`}
          >
            P{task.priority_level}
          </span>
        )}
        {task.due_at && (
          <span className="text-xs text-slate-500">
            Due {new Date(task.due_at).toLocaleDateString()}
          </span>
        )}
        {task.scheduled_start_at && (
          <span className="text-xs text-indigo-400">
            {new Date(task.scheduled_start_at).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
      <button
        onClick={() => onStatusChange(nextStatus[task.status] ?? "todo")}
        className="text-xs text-slate-500 hover:text-indigo-400 transition-colors"
      >
        → Move to {STATUS_LABEL[nextStatus[task.status] ?? "todo"]}
      </button>
    </div>
  );
}

function AddTaskModal({
  onClose,
  onAdd,
  profile,
}: {
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAdd: (task: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any;
}) {
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState("priority");
  const [priority, setPriority] = useState("3");
  const [dueAt, setDueAt] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [desc, setDesc] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      title,
      task_type: taskType,
      status: "todo",
      module: "general",
      source_type: "manual",
      priority_level: taskType === "priority" ? Number(priority) : null,
      due_at: dueAt || null,
      scheduled_start_at: scheduledStart || null,
      description: desc || null,
      assigned_to: null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-md space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">New Task</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white">
            ✕
          </button>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Title *</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-base w-full"
            placeholder="Task title"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Type</label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              className="input-base w-full"
            >
              <option value="priority">Priority</option>
              <option value="time_sensitive">Time-sensitive</option>
            </select>
          </div>
          {taskType === "priority" && (
            <div>
              <label className="text-xs text-slate-400 block mb-1">Priority (1=high)</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="input-base w-full"
              >
                {[1, 2, 3, 4, 5].map((p) => (
                  <option key={p} value={p}>
                    P{p}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        {taskType === "priority" ? (
          <div>
            <label className="text-xs text-slate-400 block mb-1">Due date</label>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="input-base w-full"
            />
          </div>
        ) : (
          <div>
            <label className="text-xs text-slate-400 block mb-1">Scheduled at</label>
            <input
              type="datetime-local"
              value={scheduledStart}
              onChange={(e) => setScheduledStart(e.target.value)}
              className="input-base w-full"
            />
          </div>
        )}
        <div>
          <label className="text-xs text-slate-400 block mb-1">Description</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
            className="input-base w-full resize-none"
            placeholder="Optional details…"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-lg text-sm transition-colors"
        >
          Add Task
        </button>
      </form>
    </div>
  );
}

export default function Tasks() {
  const { data: tasks = [], createTask, updateTask, deleteTask, profile } = useTasks();
  const { taskBoardView, setTaskBoardView, selectedDate } = useUiStore();
  const [showModal, setShowModal] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "priority" | "time_sensitive">("all");

  const visible = tasks.filter((t) => {
    if (t.status === "cancelled") return false;
    if (filterType !== "all" && t.task_type !== filterType) return false;
    return true;
  });

  const handleStatusChange = (id: string, status: string) => {
    updateTask.mutate({ id, status });
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this task?")) deleteTask.mutate(id);
  };

  // ── Kanban ──────────────────────────────────────────────────────────────
  const KanbanView = () => (
    <div className="grid grid-cols-3 gap-4">
      {STATUSES.map((status) => {
        const col = visible.filter((t) => t.status === status);
        return (
          <div key={status} className={`rounded-xl border ${STATUS_COLOR[status]} bg-slate-900/50 p-3`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {STATUS_LABEL[status]}
              </span>
              <span className="text-xs bg-slate-800 text-slate-400 rounded-full px-2 py-0.5">
                {col.length}
              </span>
            </div>
            <div className="space-y-2">
              {col.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStatusChange={(s) => handleStatusChange(task.id, s)}
                  onDelete={() => handleDelete(task.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── List ─────────────────────────────────────────────────────────────────
  const ListView = () => {
    const sorted = [...visible].sort((a, b) => {
      if (a.status === "done" && b.status !== "done") return 1;
      if (b.status === "done" && a.status !== "done") return -1;
      return (a.priority_level ?? 99) - (b.priority_level ?? 99);
    });
    return (
      <div className="space-y-2">
        {sorted.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3"
          >
            <button
              onClick={() =>
                handleStatusChange(task.id, task.status === "done" ? "todo" : "done")
              }
              className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center text-xs ${
                task.status === "done"
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : "border-slate-600"
              }`}
            >
              {task.status === "done" ? "✓" : ""}
            </button>
            <div className="flex-1 min-w-0">
              <span
                className={`text-sm font-medium ${task.status === "done" ? "line-through text-slate-500" : ""}`}
              >
                {task.title}
              </span>
              {task.description && (
                <p className="text-xs text-slate-500 truncate">{task.description}</p>
              )}
            </div>
            {task.priority_level && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGE[task.priority_level]}`}
              >
                P{task.priority_level}
              </span>
            )}
            {task.due_at && (
              <span className="text-xs text-slate-500 hidden sm:block">
                {new Date(task.due_at).toLocaleDateString()}
              </span>
            )}
            <button
              onClick={() => handleDelete(task.id)}
              className="text-slate-600 hover:text-red-400 text-xs transition-colors"
            >
              ✕
            </button>
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="text-center py-12 text-slate-500">No tasks yet. Add one! ✅</div>
        )}
      </div>
    );
  };

  // ── Timeline ─────────────────────────────────────────────────────────────
  const TimelineView = () => {
    const dayTasks = visible.filter(
      (t) =>
        t.task_type === "time_sensitive" &&
        t.scheduled_start_at?.slice(0, 10) === selectedDate
    );
    const hours = Array.from({ length: 24 }, (_, i) => i);
    return (
      <div>
        <div className="flex items-center gap-2 mb-4 text-sm text-slate-400">
          <span>📅</span>
          <span>
            {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
        <div className="space-y-1">
          {hours.map((h) => {
            const hTasks = dayTasks.filter(
              (t) => new Date(t.scheduled_start_at).getHours() === h
            );
            return (
              <div key={h} className="flex gap-3">
                <span className="text-xs text-slate-600 w-10 shrink-0 pt-1.5 text-right">
                  {String(h).padStart(2, "0")}:00
                </span>
                <div className="flex-1 min-h-[2rem] border-l border-slate-800 pl-3 pb-1">
                  {hTasks.map((t) => (
                    <div
                      key={t.id}
                      className="bg-indigo-900/40 border border-indigo-800 rounded-lg px-3 py-1.5 mb-1 flex items-center justify-between"
                    >
                      <span className="text-sm">{t.title}</span>
                      <button
                        onClick={() =>
                          handleStatusChange(t.id, t.status === "done" ? "todo" : "done")
                        }
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          t.status === "done"
                            ? "bg-emerald-900 text-emerald-300"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {t.status === "done" ? "✓ Done" : "Mark done"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {dayTasks.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No time-sensitive tasks scheduled for today.
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Tasks</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            {visible.filter((t) => t.status !== "done").length} open
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + New task
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
          {(["all", "priority", "time_sensitive"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filterType === f
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {f === "all" ? "All" : f === "priority" ? "Priority" : "Scheduled"}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
          {(["kanban", "list", "timeline"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setTaskBoardView(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                taskBoardView === v
                  ? "bg-indigo-700 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {v === "kanban" ? "🗂 Kanban" : v === "list" ? "📋 List" : "⏱ Timeline"}
            </button>
          ))}
        </div>
      </div>

      {/* Views */}
      {taskBoardView === "kanban" && <KanbanView />}
      {taskBoardView === "list" && <ListView />}
      {taskBoardView === "timeline" && <TimelineView />}

      {showModal && (
        <AddTaskModal
          onClose={() => setShowModal(false)}
          onAdd={(task) => createTask.mutate(task)}
          profile={profile}
        />
      )}
    </div>
  );
}

