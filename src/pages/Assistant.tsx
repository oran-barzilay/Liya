import { useMemo, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import AiAssistantCard from "../components/AiAssistantCard";
import { useInventory } from "../hooks/useInventory";
import { useTasks } from "../hooks/useTasks";
import { useAppointments } from "../hooks/useBaby";
import { useChatHistory } from "../hooks/useChatHistory";
import { useHouseholdSettings } from "../hooks/useHouseholdSettings";
import Icon from "../components/Icon";

function normalizeTitle(val: string): string {
  return val.trim().toLowerCase();
}

function shiftIsoDate(iso: string, hoursDelta: number, monthsDelta: number): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  if (monthsDelta) d.setMonth(d.getMonth() + monthsDelta);
  if (hoursDelta) d.setHours(d.getHours() + hoursDelta);
  return d.toISOString();
}

export default function Assistant() {
  const [params, setParams] = useSearchParams();
  const [pendingInitialMessage, setPendingInitialMessage] = useState(() => (params.get("q") ?? "").trim());

  const { data: inventory = [], upsertItem } = useInventory();
  const { data: tasks = [], createTask, updateTask } = useTasks();
  const { data: appointments = [], upsertAppointment } = useAppointments();
  const { data: householdSettings } = useHouseholdSettings();

  const {
    conversations,
    activeId,
    activeConversation,
    setActiveId,
    createConversation,
    updateConversation,
    deleteConversation,
  } = useChatHistory();

  // Create first conversation if none exist
  useEffect(() => {
    if (conversations.length === 0) {
      createConversation();
    }
  }, []);

  const addInventoryFromAi = (item: Record<string, any>) =>
    new Promise<void>((resolve, reject) => {
      upsertItem.mutate(item, {
        onSuccess: () => resolve(),
        onError: (err) => reject(err),
      });
    });

  const addTaskFromAi = (task: Record<string, any>) =>
    new Promise<void>((resolve, reject) => {
      createTask.mutate(task, {
        onSuccess: () => resolve(),
        onError: (err) => reject(err),
      });
    });

  const addEventFromAi = (event: Record<string, any>) =>
    new Promise<void>((resolve, reject) => {
      upsertAppointment.mutate(event, {
        onSuccess: () => resolve(),
        onError: (err) => reject(err),
      });
    });

  const shiftTaskFromAi = (payload: Record<string, any>) =>
    new Promise<void>((resolve, reject) => {
      const title = normalizeTitle(String(payload.title ?? ""));
      if (!title) {
        resolve();
        return;
      }

      const hoursDelta = Number(payload.hours_delta ?? 0);
      const monthsDelta = Number(payload.months_delta ?? 0);
      const exactMatches = tasks.filter((t) => normalizeTitle(String(t.title ?? "")) === title);
      const fallbackMatches = tasks.filter((t) => normalizeTitle(String(t.title ?? "")).includes(title));
      const candidates = (exactMatches.length ? exactMatches : fallbackMatches)
        .filter((t) => t.status !== "done" && t.status !== "cancelled")
        .sort((a, b) => {
          const aAt = String(a.scheduled_start_at ?? a.due_at ?? "9999-12-31T00:00:00.000Z");
          const bAt = String(b.scheduled_start_at ?? b.due_at ?? "9999-12-31T00:00:00.000Z");
          return aAt.localeCompare(bAt);
        });
      const target = candidates[0];
      if (!target) {
        resolve();
        return;
      }

      const dateField = target.task_type === "time_sensitive" ? "scheduled_start_at" : "due_at";
      const currentIso = String(target[dateField] ?? target.scheduled_start_at ?? target.due_at ?? "");
      if (!currentIso) {
        resolve();
        return;
      }

      const shifted = shiftIsoDate(currentIso, Number.isFinite(hoursDelta) ? hoursDelta : 0, Number.isFinite(monthsDelta) ? monthsDelta : 0);
      if (!shifted) {
        resolve();
        return;
      }

      updateTask.mutate(
        { id: target.id, [dateField]: shifted },
        {
          onSuccess: () => resolve(),
          onError: (err) => reject(err),
        }
      );
    });

  const shiftEventFromAi = (payload: Record<string, any>) =>
    new Promise<void>((resolve, reject) => {
      const title = normalizeTitle(String(payload.title ?? ""));
      if (!title) {
        resolve();
        return;
      }

      const hoursDelta = Number(payload.hours_delta ?? 0);
      const monthsDelta = Number(payload.months_delta ?? 0);
      const nowIso = new Date().toISOString();
      const exactMatches = appointments.filter((a) => normalizeTitle(String(a.title ?? "")) === title);
      const fallbackMatches = appointments.filter((a) => normalizeTitle(String(a.title ?? "")).includes(title));
      const candidates = (exactMatches.length ? exactMatches : fallbackMatches)
        .sort((a, b) => {
          const aAt = String(a.starts_at ?? "9999-12-31T00:00:00.000Z");
          const bAt = String(b.starts_at ?? "9999-12-31T00:00:00.000Z");
          const aUpcoming = aAt >= nowIso ? 0 : 1;
          const bUpcoming = bAt >= nowIso ? 0 : 1;
          if (aUpcoming !== bUpcoming) return aUpcoming - bUpcoming;
          return aAt.localeCompare(bAt);
        });
      const target = candidates[0];
      if (!target?.starts_at) {
        resolve();
        return;
      }

      const shifted = shiftIsoDate(String(target.starts_at), Number.isFinite(hoursDelta) ? hoursDelta : 0, Number.isFinite(monthsDelta) ? monthsDelta : 0);
      if (!shifted) {
        resolve();
        return;
      }

      upsertAppointment.mutate(
        { id: target.id, starts_at: shifted },
        {
          onSuccess: () => resolve(),
          onError: (err) => reject(err),
        }
      );
    });

  const description = useMemo(
    () => `אפשר לשאול על קניות, משימות ואירועים. כרגע ${inventory.length} פריטים, ${tasks.length} משימות ו-${appointments.length} אירועים.`,
    [inventory.length, tasks.length, appointments.length]
  );

  const handleNewChat = () => {
    createConversation();
  };

  const consumePendingInitialMessage = useCallback(() => {
    if (!pendingInitialMessage) return;
    setPendingInitialMessage("");
    if (params.get("q")) {
      const next = new URLSearchParams(params);
      next.delete("q");
      setParams(next, { replace: true });
    }
  }, [pendingInitialMessage, params, setParams]);

  const handleDeleteConversation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteConversation(id);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-theme">צ'אט עם הסוכן</h2>
        <p className="text-theme-muted text-sm mt-1">{description}</p>
      </div>

      <div className="flex flex-col gap-4 items-start xl:flex-row">
        {/* Sidebar – conversation history */}
        <aside className="w-full xl:w-56 shrink-0 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium transition-colors"
          >
            <Icon name="plus" className="w-4 h-4" />
            שיחה חדשה
          </button>

          <div className="flex xl:flex-col gap-1 max-h-[60vh] xl:max-h-[70vh] overflow-x-auto xl:overflow-y-auto pb-1">
            {conversations.length === 0 && (
              <p className="text-xs text-theme-muted text-center py-4 w-full">אין שיחות קודמות</p>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setActiveId(conv.id)}
                className={
                  "group min-w-[180px] xl:min-w-0 flex items-start justify-between gap-1 px-3 py-2 rounded-xl cursor-pointer border transition-colors " +
                  (conv.id === activeId
                    ? "bg-accent-900/60 border-accent-600"
                    : "bg-slate-900/40 border-slate-800 hover:bg-slate-800/60")
                }
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-theme truncate leading-tight">{conv.title}</p>
                  <p className="text-[10px] text-theme-muted mt-0.5">{formatDate(conv.updatedAt)}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleDeleteConversation(e, conv.id)}
                  className="opacity-100 xl:opacity-0 xl:group-hover:opacity-100 shrink-0 p-1 rounded-lg hover:bg-red-900/50 text-red-400 transition-all"
                  title="מחק שיחה"
                >
                  <Icon name="trash" className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* Main chat area */}
        <div className="flex-1 min-w-0 w-full">
          {activeConversation ? (
            <AiAssistantCard
              key={activeConversation.id}
              standalone
              initialMessage={pendingInitialMessage || undefined}
              preferredModel={householdSettings?.assistant_model || ""}
              inventory={inventory as Array<Record<string, any>>}
              tasks={tasks as Array<Record<string, any>>}
              appointments={appointments as Array<Record<string, any>>}
              onAddInventoryItem={addInventoryFromAi}
              onAddTask={addTaskFromAi}
              onAddEvent={addEventFromAi}
              onShiftTaskSchedule={shiftTaskFromAi}
              onShiftEventSchedule={shiftEventFromAi}
              messages={activeConversation.messages}
              onMessagesChange={(msgs) => {
                if (pendingInitialMessage && msgs.length > 0) {
                  consumePendingInitialMessage();
                }
                updateConversation(activeConversation.id, msgs);
              }}
            />
          ) : (
            <div className="rounded-2xl border border-accent-800/70 bg-accent-950/20 p-8 text-center text-theme-muted text-sm">
              בחר שיחה או צור שיחה חדשה
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
