import { useMemo, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import AiAssistantCard from "../components/AiAssistantCard";
import { useInventory } from "../hooks/useInventory";
import { useTasks } from "../hooks/useTasks";
import { useAppointments } from "../hooks/useBaby";
import { useChatHistory } from "../hooks/useChatHistory";
import { useHouseholdSettings } from "../hooks/useHouseholdSettings";
import Icon from "../components/Icon";



export default function Assistant() {
  const [params, setParams] = useSearchParams();
  const [pendingInitialMessage, setPendingInitialMessage] = useState(() => (params.get("q") ?? "").trim());

  const { data: inventory = [] } = useInventory();
  const { data: tasks = [] } = useTasks();
  const { data: appointments = [] } = useAppointments();
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
      <div className="mb-3 md:mb-4">
        <h2 className="hidden md:block text-2xl font-bold text-theme">צ'אט עם הסוכן</h2>
        <p className="text-theme-muted text-xs md:text-sm md:mt-1 truncate md:whitespace-normal">{description}</p>
      </div>

      <div className="flex flex-col gap-3 md:gap-4 items-start xl:flex-row">
        {/* Sidebar – conversation history (a single scrolling strip on phones) */}
        <aside className="w-full xl:w-56 shrink-0 flex xl:flex-col gap-2">
          <button
            type="button"
            onClick={handleNewChat}
            className="shrink-0 xl:w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium transition-colors"
            aria-label="שיחה חדשה"
          >
            <Icon name="plus" className="w-4 h-4" />
            <span className="hidden sm:inline">שיחה חדשה</span>
          </button>

          <div className="flex xl:flex-col gap-1 min-w-0 flex-1 xl:max-h-[70vh] overflow-x-auto no-scrollbar xl:overflow-y-auto">
            {conversations.length === 0 && (
              <p className="text-xs text-theme-muted text-center py-4 w-full">אין שיחות קודמות</p>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setActiveId(conv.id)}
                className={
                  "group min-w-[150px] max-w-[200px] xl:max-w-none xl:min-w-0 shrink-0 xl:shrink flex items-start justify-between gap-1 px-3 py-2 rounded-xl cursor-pointer border transition-colors " +
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
                  className="opacity-100 xl:opacity-0 xl:group-hover:opacity-100 shrink-0 p-1.5 -m-1 rounded-lg hover:bg-red-900/50 text-red-400 transition-all"
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
