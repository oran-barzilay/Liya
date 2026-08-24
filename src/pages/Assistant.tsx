import { useMemo, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import AiAssistantCard from "../components/AiAssistantCard";
import { useInventory } from "../hooks/useInventory";
import { useTasks } from "../hooks/useTasks";
import { useChatHistory } from "../hooks/useChatHistory";
import Icon from "../components/Icon";

export default function Assistant() {
  const [params, setParams] = useSearchParams();
  const [pendingInitialMessage, setPendingInitialMessage] = useState(() => (params.get("q") ?? "").trim());

  const { data: inventory = [], upsertItem } = useInventory();
  const { data: tasks = [], createTask } = useTasks();

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

  const description = useMemo(
    () => `אפשר לשאול שאלות על קניות ולבקש יצירת משימות. כרגע ${inventory.length} פריטים במלאי ו-${tasks.length} משימות במערכת.`,
    [inventory.length, tasks.length]
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

      <div className="flex gap-4 items-start">
        {/* Sidebar – conversation history */}
        <aside className="w-56 shrink-0 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium transition-colors"
          >
            <Icon name="plus" className="w-4 h-4" />
            שיחה חדשה
          </button>

          <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto">
            {conversations.length === 0 && (
              <p className="text-xs text-theme-muted text-center py-4">אין שיחות קודמות</p>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setActiveId(conv.id)}
                className={
                  "group flex items-start justify-between gap-1 px-3 py-2 rounded-xl cursor-pointer border transition-colors " +
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
                  className="opacity-0 group-hover:opacity-100 shrink-0 p-1 rounded-lg hover:bg-red-900/50 text-red-400 transition-all"
                  title="מחק שיחה"
                >
                  <Icon name="trash" className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* Main chat area */}
        <div className="flex-1 min-w-0">
          {activeConversation ? (
            <AiAssistantCard
              key={activeConversation.id}
              standalone
              initialMessage={pendingInitialMessage || undefined}
              inventory={inventory as Array<Record<string, any>>}
              tasks={tasks as Array<Record<string, any>>}
              onAddInventoryItem={addInventoryFromAi}
              onAddTask={addTaskFromAi}
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

