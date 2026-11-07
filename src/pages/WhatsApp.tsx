import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Icon from "../components/Icon";
import { formatInTimeZone } from "../lib/datetime";
import { useHouseholdSettings } from "../hooks/useHouseholdSettings";
import {
  DEFAULT_SETTINGS, useWhatsapp, whatsappAction,
  type SummarySection, type WeeklySection, type WhatsappLogEntry, type WhatsappMessage,
} from "../hooks/useWhatsapp";

const SECTION_LABELS: [SummarySection, string][] = [
  ["events", "אירועים היום"],
  ["today", "משימות להיום"],
  ["overdue", "באיחור"],
  ["shopping", "רשימת קניות"],
  ["tomorrow", "מה מחר"],
];
const WEEKLY_SECTION_LABELS: [WeeklySection, string][] = [
  ["events", "אירועים"],
  ["tasks", "משימות"],
  ["overdue", "באיחור"],
  ["shopping", "רשימת קניות"],
];
const DAY_LETTERS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const KIND_LABEL: Record<WhatsappLogEntry["kind"], string> = {
  daily: "סיכום יומי", weekly: "סיכום שבועי", custom: "הודעה חוזרת", reminder: "תזכורת", manual: "נשלח ידנית",
  assistant: "תשובה לפקודה",
};
const COMMAND_EXAMPLES = [
  "תוסיף חלב ולחם לרשימה",
  "קניתי 2 קרטוני חלב (עובד גם בלי מילת ההפעלה)",
  "סמני את הארנונה כבוצע",
  "תעביר את איסוף מהגן ללינוי",
  "תמחק את המשימה להחליף מצעים",
  "מה צריך לקנות?",
];

function daysText(days: number[]) {
  if (days.length === 7) return "כל יום";
  if (days.length === 5 && [0, 1, 2, 3, 4].every((d) => days.includes(d))) return "א׳–ה׳";
  return [...days].sort().map((d) => DAY_LETTERS[d]).join(" ");
}

/** WhatsApp-style *bold* rendering for previews */
function WhatsappText({ text }: { text: string }) {
  return (
    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-theme">
      {text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
        part.startsWith("*") && part.endsWith("*") && part.length > 2 ? <strong key={i}>{part.slice(1, -1)}</strong> : part
      )}
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={"relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors " + (on ? "bg-accent-600" : "bg-slate-700")}>
      <span className={"inline-block h-5 w-5 rounded-full bg-white shadow transition-transform " + (on ? "-translate-x-6" : "-translate-x-1")} />
    </button>
  );
}

function Card({ title, icon, children, action }: { title: string; icon: Parameters<typeof Icon>[0]["name"]; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5 mb-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-base font-semibold text-theme flex items-center gap-2">
          <Icon name={icon} className="w-4 h-4 text-accent-400" /> {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel bg-slate-900 border-slate-700 sm:max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-theme">{title}</h3>
          <button type="button" onClick={onClose} className="-m-2 p-2 rounded-lg text-theme-muted hover:text-theme" aria-label="סגור"><Icon name="x" className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function GroupPicker({ onPick, onClose }: { onPick: (g: { id: string; name: string }) => void; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const groups = useQuery({
    queryKey: ["whatsapp_groups"],
    queryFn: () => whatsappAction<{ groups: { id: string; name: string }[] }>("groups").then((r) => r.groups),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const filtered = (groups.data ?? []).filter((g) => g.name.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <Sheet title="בחירת קבוצה" onClose={onClose}>
      <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} className="input-base w-full" placeholder="חיפוש קבוצה..." type="search" />
      {groups.isLoading && <p className="text-sm text-theme-muted animate-pulse">טוען קבוצות...</p>}
      {groups.error && <p className="text-sm text-danger">{(groups.error as Error).message}</p>}
      <ul className="max-h-[50dvh] overflow-y-auto -mx-2">
        {filtered.map((g) => (
          <li key={g.id}>
            <button type="button" onClick={() => onPick(g)} className="w-full text-right rounded-lg px-3 py-3 hover:bg-slate-800 text-sm text-theme">
              {g.name}
            </button>
          </li>
        ))}
        {groups.data && filtered.length === 0 && <li className="px-3 py-3 text-sm text-theme-muted">לא נמצאו קבוצות</li>}
      </ul>
    </Sheet>
  );
}

function MessageEditor({ initial, onSave, onDelete, onClose }: {
  initial: Partial<WhatsappMessage>;
  onSave: (m: Partial<WhatsappMessage> & { text: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initial.text ?? "");
  const [days, setDays] = useState<number[]>(initial.weekdays ?? [0, 1, 2, 3, 4, 5, 6]);
  const [time, setTime] = useState((initial.send_time ?? "20:00").slice(0, 5));
  const toggleDay = (d: number) => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  const valid = text.trim() && days.length > 0 && time;
  return (
    <Sheet title={initial.id ? "עריכת הודעה חוזרת" : "הודעה חוזרת חדשה"} onClose={onClose}>
      <div>
        <label className="text-xs text-theme-muted block mb-1">טקסט ההודעה</label>
        <textarea autoFocus={!initial.id} rows={3} value={text} onChange={(e) => setText(e.target.value)} className="input-base w-full resize-none"
          placeholder="לדוגמה: 🗑️ פח ירוק הערב!" />
        <p className="text-[11px] text-theme-muted mt-1">אפשר *כוכביות* להדגשה, כמו בוואטסאפ.</p>
      </div>
      <div>
        <label className="text-xs text-theme-muted block mb-1.5">באילו ימים</label>
        <div className="grid grid-cols-7 gap-1.5">
          {DAY_LETTERS.map((l, d) => (
            <button key={d} type="button" onClick={() => toggleDay(d)}
              className={"h-10 rounded-lg text-sm font-semibold border transition-colors " +
                (days.includes(d) ? "bg-accent-600 border-accent-600 text-white" : "border-slate-700 text-theme-muted")}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex gap-3 mt-2 text-xs">
          <button type="button" onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])} className="text-accent-400 py-1">כל יום</button>
          <button type="button" onClick={() => setDays([0, 1, 2, 3, 4])} className="text-accent-400 py-1">א׳–ה׳</button>
        </div>
      </div>
      <div>
        <label className="text-xs text-theme-muted block mb-1">שעה</label>
        <input type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} className="input-base w-36" dir="ltr" />
      </div>
      <div className="flex gap-2">
        {onDelete && (
          <button type="button" onClick={onDelete} className="px-4 py-3 sm:py-2.5 rounded-xl sm:rounded-lg bg-red-950/50 text-red-300" aria-label="מחיקה">
            <Icon name="trash" className="w-4 h-4" />
          </button>
        )}
        <button type="button" disabled={!valid}
          onClick={() => onSave({ ...(initial.id ? { id: initial.id } : {}), text: text.trim(), weekdays: days, send_time: time, enabled: initial.enabled ?? true })}
          className="flex-1 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white font-medium py-3 sm:py-2.5 rounded-xl sm:rounded-lg text-sm">
          שמור
        </button>
      </div>
    </Sheet>
  );
}

export default function WhatsApp() {
  const { settings, isLoading, loadError, messages, log, saveSettings, upsertMessage, deleteMessage, sendNow } = useWhatsapp();
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<Partial<WhatsappMessage> | null>(null);
  const [preview, setPreview] = useState<{ text: string; kind: "daily" | "weekly" } | null>(null);
  const [previewLoading, setPreviewLoading] = useState<"daily" | "weekly" | null>(null);
  const [freeText, setFreeText] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const { data: householdSettings, setAssistantModelForHousehold } = useHouseholdSettings();
  const models = useQuery({
    queryKey: ["assistant_models"],
    queryFn: async () => {
      const res = await fetch("/api/assistant");
      const data = (await res.json()) as { models?: string[]; recommendedModel?: string };
      return { models: data.models ?? [], recommended: data.recommendedModel ?? "" };
    },
    staleTime: 10 * 60_000,
    retry: false,
  });
  const familyModel = householdSettings?.assistant_model || "";
  const connectListening = async () => {
    setConnecting(true);
    try {
      await whatsappAction("setup_webhook");
      flash(true, "ההאזנה לקבוצה הופעלה. ייתכן שייקח עד כמה דקות עד שזה יתחיל לעבוד.");
      void status.refetch();
    } catch (e) {
      flash(false, e instanceof Error ? e.message : "לא הצלחתי להפעיל האזנה");
    } finally {
      setConnecting(false);
    }
  };

  const status = useQuery({
    queryKey: ["whatsapp_status"],
    queryFn: () => whatsappAction<{ state: string; groupId: string | null; groupName: string | null; listening: boolean }>("status"),
    retry: false,
    staleTime: 60_000,
  });

  const s = settings ?? { ...DEFAULT_SETTINGS, household_id: "" };
  const sections = s.sections;
  const tz = s.time_zone;
  const connected = status.data?.state === "authorized";
  const groupLabel = s.group_name ?? (status.data?.groupId ? "קבוצת ברירת מחדל" : null);

  const flash = (ok: boolean, text: string) => {
    setNotice({ ok, text });
    setTimeout(() => setNotice(null), 4000);
  };
  const send = (action: "send_text" | "send_summary", text?: string, kind?: "daily" | "weekly") =>
    sendNow.mutate({ action, text, kind }, {
      onSuccess: () => { flash(true, "נשלח לקבוצה ✓"); if (action === "send_text") setFreeText(""); setPreview(null); },
      onError: (e) => flash(false, e instanceof Error ? e.message : "השליחה נכשלה"),
    });
  const openPreview = async (kind: "daily" | "weekly") => {
    setPreviewLoading(kind);
    try {
      const r = await whatsappAction<{ message: string }>("preview", { kind });
      setPreview({ text: r.message, kind });
    } catch (e) {
      flash(false, e instanceof Error ? e.message : "לא הצלחתי ליצור תצוגה מקדימה");
    } finally {
      setPreviewLoading(null);
    }
  };

  const sortedMessages = useMemo(() => [...messages].sort((a, b) => a.send_time.localeCompare(b.send_time)), [messages]);

  if (isLoading) return <div className="text-sm text-theme-muted animate-pulse py-10 text-center">טוען...</div>;
  if (loadError) {
    return (
      <div className="rounded-2xl border alert-warning p-4 text-sm text-warning">
        הגדרות הוואטסאפ עוד לא זמינות במסד הנתונים. צריך להריץ ב-Supabase את קובץ ההגדרה (008_whatsapp.sql).
        <div className="text-xs text-theme-muted mt-2 font-mono" dir="ltr">{loadError.message}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-theme">וואטסאפ</h2>
        <p className="text-theme-muted text-sm mt-0.5">הודעות אוטומטיות לקבוצה המשפחתית.</p>
      </div>

      {notice && (
        <div className={"mb-4 rounded-xl px-4 py-3 text-sm " + (notice.ok ? "bg-emerald-950/50 text-emerald-300 border border-emerald-800" : "bg-red-950/50 text-red-300 border border-red-800")}>
          {notice.text}
        </div>
      )}

      {/* Connection + group */}
      <Card title="חיבור וקבוצה" icon="chat"
        action={<Toggle label="שליחת הודעות פעילה" on={s.enabled} onChange={(v) => saveSettings.mutate({ enabled: v })} />}>
        <div className="flex items-center gap-2 text-sm mb-3">
          <span className={"w-2.5 h-2.5 rounded-full " + (connected ? "bg-emerald-500" : status.isLoading ? "bg-slate-500" : "bg-red-500")} />
          <span className="text-theme">
            {status.isLoading ? "בודק חיבור..." : connected ? "וואטסאפ מחובר" : status.error ? "לא ניתן לבדוק את החיבור" : "וואטסאפ לא מחובר"}
          </span>
          {!s.enabled && <span className="text-xs text-warning">· השליחה מושבתת</span>}
        </div>
        <button type="button" onClick={() => setPicking(true)}
          className="w-full flex items-center justify-between gap-3 rounded-xl bg-slate-800 px-4 py-3 text-right">
          <div className="min-w-0">
            <div className="text-xs text-theme-muted">קבוצה</div>
            <div className="text-sm font-medium text-theme truncate">{groupLabel ?? "לא נבחרה קבוצה"}</div>
          </div>
          <span className="text-xs text-accent-400 shrink-0">{groupLabel ? "החלפה" : "בחירה"}</span>
        </button>
      </Card>

      {/* Daily summary */}
      <Card title="סיכום יומי" icon="clipboard"
        action={<Toggle label="סיכום יומי פעיל" on={s.daily_enabled} onChange={(v) => saveSettings.mutate({ daily_enabled: v })} />}>
        <div className={s.daily_enabled ? "" : "opacity-50 pointer-events-none"}>
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm text-theme" htmlFor="daily-time">שעת שליחה כל יום</label>
            <input id="daily-time" type="time" step={300} defaultValue={s.daily_time.slice(0, 5)} key={s.daily_time}
              onBlur={(e) => e.target.value && e.target.value !== s.daily_time.slice(0, 5) && saveSettings.mutate({ daily_time: e.target.value })}
              className="input-base w-32" dir="ltr" />
          </div>
          <div className="text-xs text-theme-muted mb-2">מה לכלול</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {SECTION_LABELS.map(([key, label]) => {
              const on = sections[key] !== false;
              return (
                <button key={key} type="button" onClick={() => saveSettings.mutate({ sections: { ...sections, [key]: !on } })}
                  className={"px-3 py-2 rounded-lg text-sm border transition-colors flex items-center gap-1.5 " +
                    (on ? "bg-accent-600 border-accent-600 text-white" : "border-slate-700 text-theme-muted")}>
                  {on && <Icon name="check" className="w-3.5 h-3.5" />} {label}
                </button>
              );
            })}
          </div>
          <label className="text-xs text-theme-muted block mb-1" htmlFor="greeting">ברכת פתיחה (אופציונלי)</label>
          <input id="greeting" defaultValue={s.greeting ?? ""} key={s.greeting ?? ""} placeholder="בוקר טוב משפחה! ☀️"
            onBlur={(e) => (e.target.value.trim() || null) !== s.greeting && saveSettings.mutate({ greeting: e.target.value.trim() || null })}
            className="input-base w-full mb-4" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => openPreview("daily")} disabled={!!previewLoading}
            className="py-2.5 rounded-lg bg-slate-800 text-theme text-sm flex items-center justify-center gap-1.5">
            <Icon name="eye" className="w-4 h-4" /> {previewLoading === "daily" ? "טוען..." : "תצוגה מקדימה"}
          </button>
          <button type="button" onClick={() => send("send_summary", undefined, "daily")} disabled={sendNow.isPending}
            className="py-2.5 rounded-lg bg-accent-600 hover:bg-accent-500 text-white text-sm flex items-center justify-center gap-1.5">
            <Icon name="send" className="w-4 h-4" /> שלח עכשיו
          </button>
        </div>
      </Card>

      {/* Weekly summary */}
      <Card title="סיכום שבועי" icon="calendar"
        action={<Toggle label="סיכום שבועי פעיל" on={s.weekly_enabled} onChange={(v) => saveSettings.mutate({ weekly_enabled: v })} />}>
        <p className="text-xs text-theme-muted mb-3">
          השבוע הקרוב יום אחר יום. נשלח בערב? מכסה את 7 הימים שמתחילים מחר.
        </p>
        <div className={s.weekly_enabled ? "" : "opacity-50 pointer-events-none"}>
          <div className="text-xs text-theme-muted mb-1.5">באיזה יום</div>
          <div className="grid grid-cols-7 gap-1.5 mb-3">
            {DAY_LETTERS.map((l, d) => (
              <button key={d} type="button" onClick={() => saveSettings.mutate({ weekly_day: d })} aria-label={DAY_NAMES[d]}
                className={"h-10 rounded-lg text-sm font-semibold border transition-colors " +
                  (s.weekly_day === d ? "bg-accent-600 border-accent-600 text-white" : "border-slate-700 text-theme-muted")}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm text-theme" htmlFor="weekly-time">שעה</label>
            <input id="weekly-time" type="time" step={300} defaultValue={s.weekly_time.slice(0, 5)} key={s.weekly_time}
              onBlur={(e) => e.target.value && e.target.value !== s.weekly_time.slice(0, 5) && saveSettings.mutate({ weekly_time: e.target.value })}
              className="input-base w-32" dir="ltr" />
            <span className="text-xs text-theme-muted">כל יום {DAY_NAMES[s.weekly_day]}</span>
          </div>
          <div className="text-xs text-theme-muted mb-2">מה לכלול</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {WEEKLY_SECTION_LABELS.map(([key, label]) => {
              const on = s.weekly_sections[key] !== false;
              return (
                <button key={key} type="button" onClick={() => saveSettings.mutate({ weekly_sections: { ...s.weekly_sections, [key]: !on } })}
                  className={"px-3 py-2 rounded-lg text-sm border transition-colors flex items-center gap-1.5 " +
                    (on ? "bg-accent-600 border-accent-600 text-white" : "border-slate-700 text-theme-muted")}>
                  {on && <Icon name="check" className="w-3.5 h-3.5" />} {label}
                </button>
              );
            })}
          </div>
          <label className="text-xs text-theme-muted block mb-1" htmlFor="weekly-greeting">כותרת (אופציונלי)</label>
          <input id="weekly-greeting" defaultValue={s.weekly_greeting ?? ""} key={s.weekly_greeting ?? ""} placeholder="השבוע הקרוב"
            onBlur={(e) => (e.target.value.trim() || null) !== s.weekly_greeting && saveSettings.mutate({ weekly_greeting: e.target.value.trim() || null })}
            className="input-base w-full mb-4" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => openPreview("weekly")} disabled={!!previewLoading}
            className="py-2.5 rounded-lg bg-slate-800 text-theme text-sm flex items-center justify-center gap-1.5">
            <Icon name="eye" className="w-4 h-4" /> {previewLoading === "weekly" ? "טוען..." : "תצוגה מקדימה"}
          </button>
          <button type="button" onClick={() => send("send_summary", undefined, "weekly")} disabled={sendNow.isPending}
            className="py-2.5 rounded-lg bg-accent-600 hover:bg-accent-500 text-white text-sm flex items-center justify-center gap-1.5">
            <Icon name="send" className="w-4 h-4" /> שלח עכשיו
          </button>
        </div>
      </Card>

      {/* Shopping list in the summaries */}
      <Card title="רשימת קניות בסיכומים" icon="package">
        <p className="text-xs text-theme-muted mb-3">אילו מוצרים יופיעו תחת "לקנות" בסיכום היומי והשבועי.</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {([
            ["low", "מלאי נמוך", "מתחת למינימום"],
            ["at_or_below", "כולל על הסף", "במינימום או מתחתיו"],
            ["out", "רק מה שנגמר", "לא נשאר כלום"],
          ] as const).map(([value, label, hint]) => (
            <button key={value} type="button" onClick={() => saveSettings.mutate({ shopping_filter: value })}
              className={"rounded-xl border px-2 py-2.5 text-center transition-colors " +
                (s.shopping_filter === value ? "bg-accent-600 border-accent-600 text-white" : "border-slate-700 text-theme-muted hover:text-theme")}>
              <div className="text-sm font-medium">{label}</div>
              <div className="text-[11px] opacity-80 mt-0.5">{hint}</div>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-theme">להראות כמה חסר</div>
            <div className="text-xs text-theme-muted">לדוגמה: פפסי (חסר 1)</div>
          </div>
          <Toggle label="להראות כמה חסר" on={s.shopping_show_missing} onChange={(v) => saveSettings.mutate({ shopping_show_missing: v })} />
        </div>
      </Card>

      {/* Recurring messages */}
      <Card title="הודעות חוזרות" icon="repeat"
        action={<button type="button" onClick={() => setEditing({})} className="text-sm text-accent-400 flex items-center gap-1 py-1"><Icon name="plus" className="w-4 h-4" /> הוספה</button>}>
        {sortedMessages.length === 0 ? (
          <p className="text-sm text-theme-muted">לדוגמה: "🗑️ פח ירוק הערב" כל יום ג׳ ב-20:00, או "שבת שלום" כל יום ו׳.</p>
        ) : (
          <ul className="space-y-2">
            {sortedMessages.map((m) => (
              <li key={m.id} className={"flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 ps-3 pe-2 py-2 " + (m.enabled ? "" : "opacity-60")}>
                <button type="button" onClick={() => setEditing(m)} className="flex-1 min-w-0 text-right py-1">
                  <div className="text-sm text-theme line-clamp-2">{m.text}</div>
                  <div className="text-xs text-theme-muted mt-0.5"><span dir="ltr">{m.send_time.slice(0, 5)}</span> · {daysText(m.weekdays)}</div>
                </button>
                <Toggle label="הודעה פעילה" on={m.enabled} onChange={(v) => upsertMessage.mutate({ id: m.id, text: m.text, enabled: v })} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Commands from the group */}
      <Card title="פקודות מהקבוצה" icon="chat"
        action={<Toggle label="פקודות מהקבוצה פעילות" on={s.assistant_enabled} onChange={(v) => saveSettings.mutate({ assistant_enabled: v })} />}>
        <p className="text-sm text-theme-muted mb-3">
          כותבים בקבוצה הודעה שמתחילה במילה <strong className="text-theme">{s.assistant_trigger || "פאמי"}</strong>, והעוזר מוסיף, עורך, מוחק או מסמן משימות ופריטים — ועונה בקבוצה.
        </p>
        <div className={s.assistant_enabled ? "" : "opacity-50 pointer-events-none"}>
          <div className="flex items-center gap-2 text-sm mb-3">
            <span className={"w-2.5 h-2.5 rounded-full " + (status.data?.listening ? "bg-emerald-500" : "bg-amber-500")} />
            <span className="text-theme">{status.data?.listening ? "מאזין לקבוצה" : "ההאזנה עוד לא הופעלה"}</span>
          </div>
          {!status.data?.listening && (
            <button type="button" onClick={connectListening} disabled={connecting}
              className="w-full mb-4 py-2.5 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white text-sm font-medium">
              {connecting ? "מפעיל..." : "הפעל האזנה לקבוצה"}
            </button>
          )}
          <div className="flex items-start justify-between gap-3 rounded-xl bg-slate-800 px-4 py-3 mb-4">
            <div>
              <div className="text-sm text-theme font-medium">זיהוי קניות אוטומטי</div>
              <div className="text-xs text-theme-muted mt-0.5">
                "קניתי חלב" מעדכן את המלאי ועונה מה נשאר לקנות — גם בלי מילת ההפעלה. הודעות שלא קשורות למלאי לא יקבלו תשובה.
              </div>
            </div>
            <Toggle label="זיהוי קניות אוטומטי" on={s.purchase_detection} onChange={(v) => saveSettings.mutate({ purchase_detection: v })} />
          </div>
          <label className="text-xs text-theme-muted block mb-1" htmlFor="wa-model">מודל AI (משותף לכל המשפחה, גם לצ'אט באפליקציה)</label>
          <select id="wa-model" value={familyModel}
            onChange={(e) => setAssistantModelForHousehold.mutate(e.target.value, {
              onSuccess: () => flash(true, e.target.value ? `המודל עודכן: ${e.target.value}` : "חזרה לבחירה אוטומטית"),
              onError: (err) => flash(false, err instanceof Error ? err.message : "שמירת המודל נכשלה"),
            })}
            className="input-base w-full mb-1" dir="ltr">
            <option value="">אוטומטי ({models.data?.recommended || "gemini-3.6-flash"})</option>
            {Array.from(new Set([familyModel, ...(models.data?.models ?? [])].filter(Boolean))).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <p className="text-[11px] text-theme-muted mb-4">אם המודל שנבחר לא עונה תוך 8 שניות, עוברים אוטומטית למודל ברירת המחדל.</p>
          <label className="text-xs text-theme-muted block mb-1" htmlFor="trigger">מילת הפעלה</label>
          <input id="trigger" defaultValue={s.assistant_trigger} key={s.assistant_trigger}
            onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== s.assistant_trigger && saveSettings.mutate({ assistant_trigger: e.target.value.trim() })}
            className="input-base w-40 mb-4" />
          <div className="text-xs text-theme-muted mb-1.5">דוגמאות</div>
          <ul className="space-y-1.5">
            {COMMAND_EXAMPLES.map((ex) => (
              <li key={ex} className="text-sm text-theme rounded-lg bg-slate-800 px-3 py-2">
                <strong>{s.assistant_trigger || "פאמי"}</strong> {ex}
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {/* Per-item reminders hint */}
      <div className="mb-4 rounded-2xl border border-dashed border-slate-700 px-4 py-3 text-sm text-theme-muted flex gap-2">
        <Icon name="clock" className="w-4 h-4 shrink-0 mt-0.5 text-accent-400" />
        <span>תזכורת למשימה או לאירוע מסוים? פותחים אותו ובוחרים "תזכורת לקבוצת הוואטסאפ" — בזמן, שעה לפני, ערב לפני ועוד.</span>
      </div>

      {/* One-off message */}
      <Card title="שליחת הודעה עכשיו" icon="send">
        <textarea rows={2} value={freeText} onChange={(e) => setFreeText(e.target.value)} className="input-base w-full resize-none mb-2"
          placeholder="כתוב הודעה לקבוצה..." />
        <button type="button" disabled={!freeText.trim() || sendNow.isPending} onClick={() => send("send_text", freeText.trim())}
          className="w-full py-2.5 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white text-sm font-medium">
          {sendNow.isPending ? "שולח..." : "שלח לקבוצה"}
        </button>
      </Card>

      {/* History */}
      <Card title="היסטוריית שליחה" icon="clock">
        {log.length === 0 ? (
          <p className="text-sm text-theme-muted">עוד לא נשלחו הודעות.</p>
        ) : (
          <ul className="divide-y divide-slate-800 -mx-1">
            {log.map((l) => (
              <li key={l.id}>
                <button type="button" onClick={() => setOpenLog(openLog === l.id ? null : l.id)} className="w-full text-right px-1 py-2.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className={l.ok ? "text-success" : "text-danger"}>{l.ok ? "✓" : "✗"}</span>
                    <span className="text-theme font-medium">{KIND_LABEL[l.kind]}</span>
                    <span className="text-theme-muted">{formatInTimeZone(l.sent_at, tz, { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  {openLog === l.id ? (
                    <div className="mt-2 rounded-lg bg-slate-800 p-3">
                      <WhatsappText text={l.message} />
                      {l.error && <p className="text-xs text-danger mt-2" dir="ltr">{l.error}</p>}
                    </div>
                  ) : (
                    <p className="text-sm text-theme-muted truncate mt-0.5">{l.message.replace(/\*/g, "").split("\n")[0]}</p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {picking && (
        <GroupPicker onClose={() => setPicking(false)}
          onPick={(g) => { saveSettings.mutate({ group_id: g.id, group_name: g.name }); setPicking(false); flash(true, `הקבוצה נקבעה: ${g.name}`); }} />
      )}
      {editing && (
        <MessageEditor initial={editing} onClose={() => setEditing(null)}
          onSave={(m) => { upsertMessage.mutate(m); setEditing(null); }}
          onDelete={editing.id ? () => { deleteMessage.mutate(editing.id!); setEditing(null); } : undefined} />
      )}
      {preview && (
        <Sheet title={preview.kind === "weekly" ? "תצוגה מקדימה · סיכום שבועי" : "תצוגה מקדימה · סיכום יומי"} onClose={() => setPreview(null)}>
          <div className="rounded-xl bg-emerald-950/30 border border-emerald-900/50 p-3 max-h-[55dvh] overflow-y-auto"><WhatsappText text={preview.text} /></div>
          <button type="button" onClick={() => send("send_summary", undefined, preview.kind)} disabled={sendNow.isPending}
            className="w-full py-3 sm:py-2.5 rounded-xl sm:rounded-lg bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium">
            {sendNow.isPending ? "שולח..." : "שלח לקבוצה עכשיו"}
          </button>
        </Sheet>
      )}
    </div>
  );
}
