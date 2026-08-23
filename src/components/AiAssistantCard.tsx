import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import { usePreferencesStore } from "../state/stores/preferencesStore";
import { zonedDateTimeToUtcIso } from "../lib/datetime";

type Row = Record<string, any>;

type AssistantAction = {
  type?: string;
  payload?: Record<string, unknown>;
};

function getNextOccurrence(days: number[], time: string): string | null {
  if (!days.length) return null;
  const [h, m] = (time || "09:00").split(":").map(Number);
  const now = new Date();
  for (let i = 0; i <= 7; i++) {
    const next = new Date(now);
    next.setDate(now.getDate() + i);
    if (days.includes(next.getDay())) {
      next.setHours(h || 9, m || 0, 0, 0);
      if (next.getTime() > now.getTime()) return next.toISOString();
    }
  }
  return null;
}

function dateToUtcIso(dateInput: string, timeZone: string): string | null {
  if (!dateInput) return null;
  const normalized = dateInput.length === 10 ? `${dateInput}T00:00` : dateInput;
  try {
    return zonedDateTimeToUtcIso(normalized, timeZone);
  } catch {
    return null;
  }
}

export default function AiAssistantCard({
  inventory,
  tasks,
  onAddInventoryItem,
  onAddTask,
  standalone = false,
  initialMessage,
}: {
  inventory: Row[];
  tasks: Row[];
  onAddInventoryItem: (item: Row) => Promise<void> | void;
  onAddTask: (task: Row) => Promise<void> | void;
  standalone?: boolean;
  initialMessage?: string;
}) {
  const timeZone = usePreferencesStore((s) => s.timeZone);
  const [open, setOpen] = useState(standalone);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const sentInitial = useRef(false);

  const inventoryContext = useMemo(
    () => inventory.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, critical_threshold: i.critical_threshold, category_id: i.category_id })),
    [inventory]
  );
  const taskContext = useMemo(
    () => tasks.map((t) => ({ title: t.title, status: t.status, task_type: t.task_type, due_at: t.due_at, scheduled_start_at: t.scheduled_start_at })),
    [tasks]
  );

  const runAction = async (action: AssistantAction) => {
    const payload = action.payload ?? {};
    if (action.type === "add_inventory_item") {
      const name = String(payload.name ?? "").trim();
      if (!name) return;
      await onAddInventoryItem({
        name,
        unit: String(payload.unit ?? "יחידות"),
        quantity: Number(payload.quantity ?? 1),
        critical_threshold: Number(payload.critical_threshold ?? 1),
        notes: payload.notes ? String(payload.notes) : null,
        auto_restock_task: true,
      });
      return;
    }

    if (action.type === "add_task") {
      const title = String(payload.title ?? "").trim();
      if (!title) return;

      const taskType = payload.task_type === "time_sensitive" ? "time_sensitive" : "priority";
      const isRecurring = Boolean(payload.is_recurring);
      const recurrenceDays = Array.isArray(payload.recurrence_days)
        ? payload.recurrence_days.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        : [];
      const recurrenceTime = typeof payload.recurrence_time === "string" ? payload.recurrence_time : "09:00";
      const recurrenceRule = isRecurring ? JSON.stringify({ days: recurrenceDays, time: recurrenceTime }) : null;
      const nextOccurrence = isRecurring ? getNextOccurrence(recurrenceDays, recurrenceTime) : null;
      const dueDate = typeof payload.due_date === "string" ? payload.due_date : "";

      await onAddTask({
        title,
        description: payload.description ? String(payload.description) : null,
        task_type: taskType,
        status: "todo",
        module: "general",
        source_type: "manual",
        priority_level: taskType === "priority" ? Number(payload.priority_level ?? 3) : null,
        due_at: isRecurring
          ? (taskType === "priority" ? nextOccurrence : null)
          : (taskType === "priority" ? dateToUtcIso(dueDate, timeZone) : null),
        scheduled_start_at: isRecurring
          ? (taskType === "time_sensitive" ? nextOccurrence : null)
          : (taskType === "time_sensitive" ? dateToUtcIso(dueDate, timeZone) : null),
        is_recurring: isRecurring,
        recurrence_rule: recurrenceRule,
      });
    }
  };

  const send = async (rawMessage?: string) => {
    const message = (rawMessage ?? input).trim();
    if (!message || isLoading) return;

    setMessages((prev) => [...prev, { role: "user", text: message }]);
    if (!rawMessage) setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          context: {
            inventory: inventoryContext,
            tasks: taskContext,
          },
        }),
      });

      const responseText = await res.text();
      let data: { reply?: string; actions?: AssistantAction[]; error?: string; detail?: string } = {};
      if (responseText.trim()) {
        try {
          data = JSON.parse(responseText) as { reply?: string; actions?: AssistantAction[]; error?: string; detail?: string };
        } catch {
          setMessages((prev) => [...prev, { role: "assistant", text: `לא הצלחתי כרגע: תשובת שרת לא תקינה (${res.status}).` }]);
          return;
        }
      }
      if (!res.ok) {
        const text = data.detail || data.error || `שגיאה ${res.status}`;
        setMessages((prev) => [...prev, { role: "assistant", text: `לא הצלחתי כרגע: ${text}` }]);
        return;
      }

      const actions = Array.isArray(data.actions) ? data.actions : [];
      for (const action of actions) {
        // eslint-disable-next-line no-await-in-loop
        await runAction(action);
      }

      const suffix = actions.length > 0 ? `\n\nבוצעו ${actions.length} פעולות באפליקציה.` : "";
      setMessages((prev) => [...prev, { role: "assistant", text: (data.reply ?? "בוצע.") + suffix }]);
    } catch (err) {
      const text = err instanceof Error ? err.message : "שגיאת רשת";
      setMessages((prev) => [...prev, { role: "assistant", text: `לא הצלחתי כרגע: ${text}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!standalone) return;
    setOpen(true);
  }, [standalone]);

  useEffect(() => {
    const msg = (initialMessage ?? "").trim();
    if (!standalone || !msg || sentInitial.current || isLoading) return;
    sentInitial.current = true;
    void send(msg);
  }, [standalone, initialMessage, isLoading]);

  return (
    <section className="mb-5 rounded-2xl border border-accent-800/70 bg-accent-950/20">
      {!standalone && (
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          className="w-full flex items-center justify-between px-4 py-3 text-right"
        >
          <div>
            <h3 className="text-sm font-semibold text-theme flex items-center gap-2">
              <Icon name="users" className="w-4 h-4 text-accent-400" />
              סוכן חכם לקניות ומשימות
            </h3>
            <p className="text-xs text-theme-muted mt-1">לדוגמה: "תוסיף חלב וביצים" או "מה חסר לקנייה השבוע?"</p>
          </div>
          <Icon name={open ? "chevron-up" : "chevron-down"} className="w-4 h-4 text-theme-muted" />
        </button>
      )}

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="max-h-56 overflow-y-auto space-y-2 rounded-xl border border-slate-800 bg-slate-900 p-3">
            {messages.length === 0 && <p className="text-xs text-theme-muted">שאל אותי על רשימת הקניות או בקש ליצור משימה.</p>}
            {messages.map((m, idx) => (
              <div key={idx} className={"text-xs whitespace-pre-wrap " + (m.role === "user" ? "text-accent-300" : "text-theme")}>{m.text}</div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void send();
                }
              }}
              className="input-base flex-1"
              placeholder="כתבו בקשה חופשית..."
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={isLoading || !input.trim()}
              className="px-3 py-2 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white text-sm"
            >
              {isLoading ? "חושב..." : "שלח"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}


