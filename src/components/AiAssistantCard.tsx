import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import { useQueryClient } from "@tanstack/react-query";
import { usePreferencesStore } from "../state/stores/preferencesStore";
import { supabase } from "../lib/supabase";

type Msg = { role: "user" | "assistant"; text: string };
type MsgUpdater = Msg[] | ((prev: Msg[]) => Msg[]);

const FALLBACK_MODELS = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.5-pro"];

export default function AiAssistantCard({
  preferredModel = "",
  standalone = false,
  initialMessage,
  messages: externalMessages,
  onMessagesChange,
}: {
  preferredModel?: string;
  standalone?: boolean;
  initialMessage?: string;
  messages?: Msg[];
  onMessagesChange?: (messages: Msg[]) => void;
}) {
  const timeZone = usePreferencesStore((s) => s.timeZone);
  const queryClient = useQueryClient();
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

  const send = async (rawMessage?: string) => {
    const message = (rawMessage ?? input).trim();
    if (!message || isLoading) return;

    setMessages((prev) => [...prev, { role: "user", text: message }]);
    if (!rawMessage) setInput("");
    setIsLoading(true);

    try {
      // The server reads the household data and makes the changes as this user
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.session?.access_token ?? ""}` },
        body: JSON.stringify({ message, model: assistantModel || preferredModel || undefined, timeZone }),
      });

      const data = (await res.json().catch(() => ({}))) as { reply?: string; results?: string[]; error?: string; detail?: string };
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", text: `לא הצלחתי כרגע: ${data.detail || data.error || `שגיאה ${res.status}`}` }]);
        return;
      }

      const results = Array.isArray(data.results) ? data.results : [];
      if (results.length) {
        for (const key of ["tasks", "inventory", "appointments"]) void queryClient.invalidateQueries({ queryKey: [key] });
      }
      setMessages((prev) => [...prev, { role: "assistant", text: [data.reply ?? "בוצע.", ...results].join("\n") }]);
    } catch (err) {
      const text = err instanceof Error ? err.message : "שגיאת רשת";
      setMessages((prev) => [...prev, { role: "assistant", text: `לא הצלחתי כרגע: ${text}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Scroll only the message list, not the whole page
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
    <div className="flex flex-col sm:flex-row gap-2 p-2 sm:p-3 border-t border-slate-800 bg-slate-950/60">
      <div className="flex items-center gap-2 sm:max-w-[320px]">
        <select
          value={assistantModel}
          onChange={(e) => setAssistantModel(e.target.value)}
          className="input-base min-w-0 flex-1 sm:flex-none text-xs !min-h-0 py-1.5"
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
          className="px-2 py-1.5 sm:py-2 rounded-lg border border-slate-700 text-theme-muted hover:text-theme hover:border-slate-500 text-xs shrink-0"
          disabled={isLoadingModels}
          title="רענון רשימת מודלים"
        >
          {isLoadingModels ? "..." : "רענן"}
        </button>
      </div>
      {modelLoadFailed && (
        <span className="text-[11px] text-amber-300 self-center sm:self-auto">לא נטענה רשימת מודלים מהשרת, מוצגת רשימת ברירת מחדל.</span>
      )}
      <div className="flex gap-2 flex-1 min-w-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void send();
            }
          }}
          className="input-base flex-1 min-w-0"
          placeholder="כתבו בקשה חופשית..."
          enterKeyHint="send"
          // Don't pop the keyboard over the conversation on phones
          autoFocus={standalone && window.matchMedia("(min-width: 768px)").matches}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={isLoading || !input.trim()}
          className="px-3 min-w-[2.75rem] rounded-lg bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white text-sm shrink-0 flex items-center justify-center gap-1.5"
          aria-label="שלח"
        >
          <Icon name="send" className="w-4 h-4 sm:hidden" />
          <span className="hidden sm:inline">{isLoading ? "חושב..." : "שלח"}</span>
        </button>
      </div>
    </div>
  );

  if (standalone) {
    return (
      <div className="chat-pane flex flex-col rounded-2xl border border-accent-800/70 bg-accent-950/20 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 flex flex-col gap-3">
          {messages.length === 0 && (
            <p className="text-sm text-theme-muted text-center mt-8">שאל אותי על קניות, משימות, אירועים, או עדכון תאריכים ושעות.</p>
          )}
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={
                "max-w-[88%] sm:max-w-[80%] px-4 py-2.5 rounded-2xl text-[15px] sm:text-sm whitespace-pre-wrap break-words leading-relaxed " +
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

