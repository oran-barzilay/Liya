import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import { usePreferencesStore } from "../state/stores/preferencesStore";
import { zonedDateTimeToUtcIso } from "../lib/datetime";

type Row = Record<string, any>;
type Msg = { role: "user" | "assistant"; text: string };
type MsgUpdater = Msg[] | ((prev: Msg[]) => Msg[]);

type AssistantAction = {
  type?: string;
  payload?: Record<string, unknown>;
};

const FALLBACK_MODELS = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.5-pro"];

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

function mergeDateAndTimeToUtcIso(dateInput: string, timeInput: string | null | undefined, timeZone: string): string | null {
  if (!dateInput) return null;
  const time = typeof timeInput === "string" && timeInput.trim() ? timeInput.trim() : "09:00";
  return dateToUtcIso(`${dateInput}T${time}`, timeZone);
}

export default function AiAssistantCard({
  inventory,
  tasks,
  appointments,
  onAddInventoryItem,
  onAddTask,
  onAddEvent,
  onShiftTaskSchedule,
  onShiftEventSchedule,
  preferredModel = "",
  standalone = false,
  initialMessage,
  messages: externalMessages,
  onMessagesChange,
}: {
  inventory: Row[];
  tasks: Row[];
  appointments: Row[];
  onAddInventoryItem: (item: Row) => Promise<void> | void;
  onAddTask: (task: Row) => Promise<void> | void;
  onAddEvent: (event: Row) => Promise<void> | void;
  onShiftTaskSchedule: (payload: Row) => Promise<void> | void;
  onShiftEventSchedule: (payload: Row) => Promise<void> | void;
  preferredModel?: string;
  standalone?: boolean;
  initialMessage?: string;
  messages?: Msg[];
  onMessagesChange?: (messages: Msg[]) => void;
}) {
  const timeZone = usePreferencesStore((s) => s.timeZone);
  const assistantModel = usePreferencesStore((s) => s.assistantModel);
  const setAssistantModel = usePreferencesStore((s) => s.setAssistantModel);
  const [open, setOpen] = useState(standalone);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [recommendedModel, setRecommendedModel] = useState("");
  const [modelLoadFailed, setModelLoadFailed] = useState(false);
  const [internalMessages, setInternalMessages] = useState<Msg[]>([]);
  const sentInitial = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = externalMessages ?? internalMessages;
  const setMessages = (updater: MsgUpdater) => {
    const next = typeof updater === "function" ? updater(messages) : updater;
    if (onMessagesChange) {
      onMessagesChange(next);
    } else {
      setInternalMessages(next);
    }
  };

  const inventoryContext = useMemo(
    () => inventory.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, critical_threshold: i.critical_threshold, category_id: i.category_id })),
    [inventory]
  );
  const taskContext = useMemo(
    () => tasks.map((t) => ({ title: t.title, status: t.status, task_type: t.task_type, due_at: t.due_at, scheduled_start_at: t.scheduled_start_at })),
    [tasks]
  );
  const appointmentContext = useMemo(
    () => appointments.map((a) => ({ title: a.title, starts_at: a.starts_at, provider_name: a.provider_name, location: a.location, status: a.status })),
    [appointments]
  );

  const selectableModels = useMemo(() => {
    const merged = [assistantModel, recommendedModel, ...availableModels, ...FALLBACK_MODELS]
      .map((m) => String(m || "").trim())
      .filter(Boolean);
    return Array.from(new Set(merged));
  }, [assistantModel, recommendedModel, availableModels]);

  const loadModels = async () => {
    setIsLoadingModels(true);
    try {
      const res = await fetch("/api/assistant", { method: "GET" });
      const data = (await res.json().catch(() => ({}))) as { models?: unknown[]; defaultModel?: string; recommendedModel?: string };
      if (!res.ok) {
        setModelLoadFailed(true);
        setAvailableModels(FALLBACK_MODELS);
        if (!assistantModel) setAssistantModel(FALLBACK_MODELS[0]);
        return;
      }
      const models = Array.isArray(data.models)
        ? data.models.map((m) => String(m)).filter((m) => m.trim().length > 0)
        : FALLBACK_MODELS;
      const recommended = String(data.recommendedModel ?? data.defaultModel ?? models[0] ?? FALLBACK_MODELS[0]);
      setModelLoadFailed(false);
      setAvailableModels(models.length ? models : FALLBACK_MODELS);
      setRecommendedModel(recommended);
      if (!assistantModel) {
        setAssistantModel(recommended || FALLBACK_MODELS[0]);
      }
    } catch {
      setModelLoadFailed(true);
      setAvailableModels(FALLBACK_MODELS);
      if (!assistantModel) setAssistantModel(FALLBACK_MODELS[0]);
    } finally {
      setIsLoadingModels(false);
    }
  };

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
      const dueTime = typeof payload.due_time === "string" ? payload.due_time : null;
      const dueAt = isRecurring
        ? nextOccurrence
        : mergeDateAndTimeToUtcIso(dueDate, dueTime, timeZone);

      await onAddTask({
        title,
        description: payload.description ? String(payload.description) : null,
        task_type: taskType,
        status: "todo",
        module: "general",
        source_type: "manual",
        priority_level: taskType === "priority" ? Number(payload.priority_level ?? 3) : null,
        due_at: taskType === "priority" ? dueAt : null,
        scheduled_start_at: taskType === "time_sensitive" ? dueAt : null,
        is_recurring: isRecurring,
        recurrence_rule: recurrenceRule,
      });
      return;
    }

    if (action.type === "add_event") {
      const title = String(payload.title ?? "").trim();
      const date = String(payload.date ?? "").trim();
      if (!title || !date) return;

      const startAt = mergeDateAndTimeToUtcIso(date, typeof payload.time === "string" ? payload.time : null, timeZone);
      if (!startAt) return;

      await onAddEvent({
        title,
        starts_at: startAt,
        provider_name: payload.provider_name ? String(payload.provider_name) : null,
        location: payload.location ? String(payload.location) : null,
        notes: payload.notes ? String(payload.notes) : null,
        status: payload.status ? String(payload.status) : "scheduled",
      });
      return;
    }

    if (action.type === "shift_task_schedule") {
      await onShiftTaskSchedule(payload);
      return;
    }

    if (action.type === "shift_event_schedule") {
      await onShiftEventSchedule(payload);
    }
  };

  const send = async (rawMessage?: string) => {
    const message = (rawMessage ?? input).trim();
    if (!message || isLoading) return;

    setMessages((prev) => [...prev, { role: "user", text: message }]);
    if (!rawMessage) setInput("");
    setIsLoading(true);

    try {
      const outgoingModel = assistantModel || preferredModel || undefined;
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          model: outgoingModel,
          context: {
            inventory: inventoryContext,
            tasks: taskContext,
            appointments: appointmentContext,
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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

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

  useEffect(() => {
    void loadModels();
  }, []);

  useEffect(() => {
    if (!assistantModel && preferredModel) {
      setAssistantModel(preferredModel);
    }
  }, [assistantModel, preferredModel, setAssistantModel]);

  const inputRow = (
    <div className="flex flex-col sm:flex-row gap-2 p-3 border-t border-slate-800 bg-slate-950/60">
      <div className="flex items-center gap-2 sm:max-w-[320px]">
        <select
          value={assistantModel}
          onChange={(e) => setAssistantModel(e.target.value)}
          className="input-base min-w-0 text-xs"
          title="בחירת מודל"
        >
          {!assistantModel && <option value="">מודל אוטומטי</option>}
          {selectableModels.map((model) => (
            <option key={model} value={model}>
              {model}{model === recommendedModel ? " (מומלץ)" : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void loadModels()}
          className="px-2 py-2 rounded-lg border border-slate-700 text-theme-muted hover:text-theme hover:border-slate-500 text-xs shrink-0"
          disabled={isLoadingModels}
          title="רענון רשימת מודלים"
        >
          {isLoadingModels ? "..." : "רענן"}
        </button>
      </div>
      {modelLoadFailed && (
        <span className="text-[11px] text-amber-300 self-center sm:self-auto">לא נטענה רשימת מודלים מהשרת, מוצגת רשימת ברירת מחדל.</span>
      )}
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
        autoFocus={standalone}
      />
      <button
        type="button"
        onClick={() => void send()}
        disabled={isLoading || !input.trim()}
        className="px-3 py-2 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white text-sm shrink-0"
      >
        {isLoading ? "חושב..." : "שלח"}
      </button>
    </div>
  );

  if (standalone) {
    return (
      <div className="flex flex-col rounded-2xl border border-accent-800/70 bg-accent-950/20 overflow-hidden"
           style={{ height: "calc(100vh - 12rem)" }}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {messages.length === 0 && (
            <p className="text-sm text-theme-muted text-center mt-8">שאל אותי על קניות, משימות, אירועים, או עדכון תאריכים ושעות.</p>
          )}
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={
                "max-w-[80%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed " +
                (m.role === "user"
                  ? "bg-accent-700/80 text-white self-end ms-auto rounded-br-sm"
                  : "bg-slate-800 text-theme self-start rounded-bl-sm")
              }
            >
              {m.text}
            </div>
          ))}
          {isLoading && (
            <div className="max-w-[80%] px-4 py-2.5 rounded-2xl bg-slate-800 text-theme-muted text-sm self-start rounded-bl-sm animate-pulse">
              חושב...
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        {/* Input pinned at bottom */}
        {inputRow}
      </div>
    );
  }

  return (
    <section className="mb-5 rounded-2xl border border-accent-800/70 bg-accent-950/20">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center justify-between px-4 py-3 text-right"
      >
        <div>
          <h3 className="text-sm font-semibold text-theme flex items-center gap-2">
            <Icon name="chat" className="w-4 h-4 text-accent-400" />
            סוכן חכם לקניות, משימות ואירועים
          </h3>
          <p className="text-xs text-theme-muted mt-1">לדוגמה: "תוסיף חלב", "קבעי אירוע ביום חמישי", או "תדחי משימה בחודש"</p>
        </div>
        <Icon name={open ? "chevron-up" : "chevron-down"} className="w-4 h-4 text-theme-muted" />
      </button>

      {open && (
        <div className="flex flex-col border-t border-slate-800">
          <div className="max-h-56 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 && <p className="text-xs text-theme-muted">אפשר ליצור קניות/משימות/אירועים ולעדכן תאריכים.</p>}
            {messages.map((m, idx) => (
              <div key={idx} className={"text-xs whitespace-pre-wrap " + (m.role === "user" ? "text-accent-300" : "text-theme")}>{m.text}</div>
            ))}
          </div>
          {inputRow}
        </div>
      )}
    </section>
  );
}

