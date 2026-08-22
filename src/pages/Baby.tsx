import { useState, useMemo } from "react";
import { useChildren, useBabyLogs, useAppointments } from "../hooks/useBaby";
import Icon from "../components/Icon";
import AppCalendar from "../components/AppCalendar";
import { usePreferencesStore } from "../state/stores/preferencesStore";
import {
  dateToIsoInTimeZone,
  formatInTimeZone,
  getNowInTimeZoneInput,
  getTodayInTimeZone,
  utcIsoToDateInput,
  utcIsoToDateTimeInput,
  zonedDateTimeToUtcIso,
} from "../lib/datetime";

type Row = Record<string, any>;

// ── Shared helpers ─────────────────────────────────────────────────
function formatMinutes(mins: number) {
  if (mins < 60) return `${mins} דק'`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} שע' ${m} דק'` : `${h} שעה`;
}

/** Returns current local time as "YYYY-MM-DDTHH:mm" (for datetime-local / AppCalendar) */
function nowLocal(timeZone: string): string {
  return getNowInTimeZoneInput(timeZone);
}

const LOG_LABELS: Record<string, string> = {
  feeding: "האכלה",
  diaper_change: "החלפת חיתול",
  sleep: "שינה",
  bio_gaia: "ביו גאיה",
  vitamin_d: "ויטמין D",
  leczchik: "ליקצ׳יק",
  tummy_time: "זמן בטן",
  note: "הערה",
};

const DIAPER_TYPES: { id: string; label: string }[] = [
  { id: "pee", label: "פיפי" },
  { id: "poop", label: "קקי" },
  { id: "diarrhea", label: "שלשול" },
];

function LogIcon({ type }: { type: string }) {
  switch (type) {
    case "feeding": return <Icon name="bottle" className="w-5 h-5 text-accent-400" />;
    case "diaper_change": return <Icon name="diaper" className="w-5 h-5 text-amber-400" />;
    case "sleep": return <Icon name="moon" className="w-5 h-5 text-indigo-400" />;
    case "tummy_time": return <Icon name="baby" className="w-5 h-5 text-pink-400" />;
    case "bio_gaia": case "vitamin_d": case "leczchik": return <Icon name="pill" className="w-5 h-5 text-emerald-400" />;
    default: return <Icon name="clipboard" className="w-5 h-5 text-slate-400" />;
  }
}

/* ─── Add Log Modal ─── */
function AddLogModal({ logType, lastAmount, onClose, onSave }: {
  logType: string;
  lastAmount?: number;
  onClose: () => void;
  onSave: (log: Row) => void;
}) {
  const timeZone = usePreferencesStore((s) => s.timeZone);
  const [eventAt, setEventAt] = useState(nowLocal(timeZone));
  const [amount, setAmount] = useState(lastAmount ?? 120);
  const [tummyMinutes, setTummyMinutes] = useState(10);
  const [diaperTypes, setDiaperTypes] = useState<string[]>(["pee"]);
  const [sleepStart, setSleepStart] = useState(nowLocal(timeZone));
  const [notes, setNotes] = useState("");

  const currentDate = (logType === "sleep" ? sleepStart : eventAt).slice(0, 10);
  const currentTime = (logType === "sleep" ? sleepStart : eventAt).slice(11, 16);

  const toggleDiaper = (id: string) => {
    setDiaperTypes(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const base: Row = { event_at: zonedDateTimeToUtcIso(eventAt, timeZone), notes: notes || null };

    if (logType === "feeding") {
      onSave({ ...base, log_type: "feeding", amount, unit: "מ״ל" });
    } else if (logType === "diaper_change") {
      onSave({ ...base, log_type: "diaper_change", notes: diaperTypes.join(", ") + (notes ? ` | ${notes}` : "") });
    } else if (logType === "sleep") {
      onSave({ ...base, log_type: "sleep", event_at: zonedDateTimeToUtcIso(sleepStart, timeZone), notes: notes || "התחלת שינה" });
    } else if (logType === "tummy_time") {
      onSave({ ...base, log_type: "tummy_time", amount: tummyMinutes, unit: "דקות" });
    } else {
      onSave({ ...base, log_type: logType });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm space-y-4 overflow-y-auto max-h-[92dvh]">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-theme">{LOG_LABELS[logType] ?? logType}</h3>
          <button type="button" onClick={onClose} className="text-theme-muted hover:text-theme"><Icon name="x" className="w-4 h-4" /></button>
        </div>

        {/* Date + time split is easier to edit than combined datetime picker */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <AppCalendar
            mode="date"
            value={currentDate}
            onChange={(date) => {
              const next = `${date}T${currentTime || "09:00"}`;
              if (logType === "sleep") setSleepStart(next); else setEventAt(next);
            }}
            label="תאריך"
          />
          <div>
            <label className="text-xs text-theme-muted block mb-1">שעה</label>
            <input
              type="time"
              value={currentTime}
              onChange={(e) => {
                const next = `${currentDate || getTodayInTimeZone(timeZone)}T${e.target.value}`;
                if (logType === "sleep") setSleepStart(next); else setEventAt(next);
              }}
              className="input-base w-full"
            />
          </div>
        </div>

        {/* Feeding amount */}
        {logType === "feeding" && (
          <div>
            <label className="text-xs text-theme-muted block mb-1">כמות (מ״ל)</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setAmount(a => Math.max(0, a - 30))}
                className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-theme-muted hover:text-theme hover:bg-slate-700">
                <Icon name="chevron-right" className="w-4 h-4" />
              </button>
              <input type="number" min="0" step="5" value={amount} onChange={e => setAmount(Number(e.target.value))}
                className="input-base w-full text-center text-lg font-bold" />
              <button type="button" onClick={() => setAmount(a => a + 30)}
                className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-theme-muted hover:text-theme hover:bg-slate-700">
                <Icon name="chevron-left" className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Tummy time duration */}
        {logType === "tummy_time" && (
          <div>
            <label className="text-xs text-theme-muted block mb-1">משך (דקות)</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setTummyMinutes(m => Math.max(1, m - 5))}
                className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-theme-muted hover:text-theme hover:bg-slate-700">
                <Icon name="chevron-right" className="w-4 h-4" />
              </button>
              <input type="number" min="1" step="1" value={tummyMinutes} onChange={e => setTummyMinutes(Number(e.target.value))}
                className="input-base w-full text-center text-lg font-bold" />
              <button type="button" onClick={() => setTummyMinutes(m => m + 5)}
                className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-theme-muted hover:text-theme hover:bg-slate-700">
                <Icon name="chevron-left" className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-theme-muted mt-1.5 text-center">{formatMinutes(tummyMinutes)}</p>
          </div>
        )}

        {/* Diaper types */}
        {logType === "diaper_change" && (
          <div>
            <label className="text-xs text-theme-muted block mb-1">סוג (ניתן לבחור מספר)</label>
            <div className="flex gap-2">
              {DIAPER_TYPES.map(dt => (
                <button key={dt.id} type="button" onClick={() => toggleDiaper(dt.id)}
                  className={"px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors " +
                    (diaperTypes.includes(dt.id) ? "bg-accent-600 border-accent-500 text-white" : "bg-slate-800 border-slate-700 text-theme-muted hover:border-slate-500")
                  }>
                  {dt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="text-xs text-theme-muted block mb-1">הערות</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} className="input-base w-full" placeholder="אופציונלי" />
        </div>

        <button type="submit" className="w-full bg-accent-600 hover:bg-accent-500 text-white font-medium py-2 rounded-lg text-sm transition-colors">
          שמור
        </button>
      </form>
    </div>
  );
}

/* ─── Edit Log Modal ─── */
function EditLogModal({ log, onClose, onSave }: { log: Row; onClose: () => void; onSave: (l: Row) => void }) {
  const timeZone = usePreferencesStore((s) => s.timeZone);
  const [eventAt, setEventAt] = useState(log.event_at ? utcIsoToDateTimeInput(log.event_at, timeZone) : nowLocal(timeZone));
  const [amount, setAmount] = useState(log.amount ?? 0);
  const [notes, setNotes] = useState(log.notes ?? "");
  const isTummy = log.log_type === "tummy_time";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <form onSubmit={e => {
        e.preventDefault();
        onSave({ id: log.id, event_at: zonedDateTimeToUtcIso(eventAt, timeZone), amount: (log.log_type === "feeding" || isTummy) ? amount : log.amount, notes: notes || null });
        onClose();
      }}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm space-y-4 overflow-y-auto max-h-[92dvh]">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-theme">עריכת {LOG_LABELS[log.log_type] ?? log.log_type}</h3>
          <button type="button" onClick={onClose} className="text-theme-muted hover:text-theme"><Icon name="x" className="w-4 h-4" /></button>
        </div>

        <AppCalendar mode="datetime" value={eventAt} onChange={setEventAt} label="זמן" inline />

        {log.log_type === "feeding" && (
          <div>
            <label className="text-xs text-theme-muted block mb-1">כמות (מ״ל)</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setAmount((a: number) => Math.max(0, a - 30))}
                className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-theme-muted hover:text-theme">
                <Icon name="chevron-right" className="w-4 h-4" />
              </button>
              <input type="number" min="0" step="5" value={amount} onChange={e => setAmount(Number(e.target.value))}
                className="input-base w-full text-center text-lg font-bold" />
              <button type="button" onClick={() => setAmount((a: number) => a + 30)}
                className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-theme-muted hover:text-theme">
                <Icon name="chevron-left" className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        {isTummy && (
          <div>
            <label className="text-xs text-theme-muted block mb-1">משך (דקות)</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setAmount((a: number) => Math.max(1, a - 5))}
                className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-theme-muted hover:text-theme">
                <Icon name="chevron-right" className="w-4 h-4" />
              </button>
              <input type="number" min="1" step="1" value={amount} onChange={e => setAmount(Number(e.target.value))}
                className="input-base w-full text-center text-lg font-bold" />
              <button type="button" onClick={() => setAmount((a: number) => a + 5)}
                className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-theme-muted hover:text-theme">
                <Icon name="chevron-left" className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-theme-muted mt-1.5 text-center">{formatMinutes(amount)}</p>
          </div>
        )}
        <div>
          <label className="text-xs text-theme-muted block mb-1">הערות</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} className="input-base w-full" />
        </div>
        <button type="submit" className="w-full bg-accent-600 hover:bg-accent-500 text-white font-medium py-2 rounded-lg text-sm transition-colors">עדכן</button>
      </form>
    </div>
  );
}

/* ─── Add Event Modal ─── */
function AddEventModal({ children, onClose, onSave }: { children: Row[]; onClose: () => void; onSave: (a: Row) => void }) {
  const timeZone = usePreferencesStore((s) => s.timeZone);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState(nowLocal(timeZone));
  const [childId, setChildId] = useState(children[0]?.id ?? "");
  const [provider, setProvider] = useState("");
  const [loc, setLoc] = useState("");
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <form onSubmit={e => {
        e.preventDefault();
        onSave({ title, starts_at: startsAt ? zonedDateTimeToUtcIso(startsAt, timeZone) : null, child_id: childId || null, provider_name: provider || null, location: loc || null, status: "scheduled" });
        onClose();
      }}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm space-y-4 overflow-y-auto max-h-[92dvh]">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-theme">אירוע חדש</h3>
          <button type="button" onClick={onClose} className="text-theme-muted hover:text-theme"><Icon name="x" className="w-4 h-4" /></button>
        </div>
        <div>
          <label className="text-xs text-theme-muted block mb-1">כותרת *</label>
          <input required value={title} onChange={e => setTitle(e.target.value)} className="input-base w-full" placeholder="ביקור רופא / חיסון / אירוע" />
        </div>
        <AppCalendar mode="datetime" value={startsAt} onChange={setStartsAt} label="תאריך ושעה *" inline />
        {children.length > 0 && (
          <div>
            <label className="text-xs text-theme-muted block mb-1">תינוק/ת</label>
            <select value={childId} onChange={e => setChildId(e.target.value)} className="input-base w-full">
              <option value="">— כללי —</option>
              {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs text-theme-muted block mb-1">רופא / מטפל</label>
          <input value={provider} onChange={e => setProvider(e.target.value)} className="input-base w-full" placeholder='ד"ר כהן' />
        </div>
        <div>
          <label className="text-xs text-theme-muted block mb-1">מיקום</label>
          <input value={loc} onChange={e => setLoc(e.target.value)} className="input-base w-full" placeholder="כתובת" />
        </div>
        <button type="submit" disabled={!title || !startsAt} className="w-full bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors">שמור אירוע</button>
      </form>
    </div>
  );
}

/* ─── Edit Event Modal ─── */
function EditEventModal({ event, children, onClose, onSave }: { event: Row; children: Row[]; onClose: () => void; onSave: (a: Row) => void }) {
  const timeZone = usePreferencesStore((s) => s.timeZone);
  const [title, setTitle] = useState(event.title ?? "");
  const [startsAt, setStartsAt] = useState(event.starts_at ? utcIsoToDateTimeInput(event.starts_at, timeZone) : nowLocal(timeZone));
  const [childId, setChildId] = useState(event.child_id ?? "");
  const [provider, setProvider] = useState(event.provider_name ?? "");
  const [loc, setLoc] = useState(event.location ?? "");
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <form onSubmit={e => {
        e.preventDefault();
        onSave({ id: event.id, title, starts_at: startsAt ? zonedDateTimeToUtcIso(startsAt, timeZone) : null, child_id: childId || null, provider_name: provider || null, location: loc || null });
        onClose();
      }}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm space-y-4 overflow-y-auto max-h-[92dvh]">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-theme">עריכת אירוע</h3>
          <button type="button" onClick={onClose} className="text-theme-muted hover:text-theme"><Icon name="x" className="w-4 h-4" /></button>
        </div>
        <div>
          <label className="text-xs text-theme-muted block mb-1">כותרת *</label>
          <input required value={title} onChange={e => setTitle(e.target.value)} className="input-base w-full" />
        </div>
        <AppCalendar mode="datetime" value={startsAt} onChange={setStartsAt} label="תאריך ושעה" inline />
        {children.length > 0 && (
          <div>
            <label className="text-xs text-theme-muted block mb-1">תינוק/ת</label>
            <select value={childId} onChange={e => setChildId(e.target.value)} className="input-base w-full">
              <option value="">— כללי —</option>
              {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs text-theme-muted block mb-1">רופא / מטפל</label>
          <input value={provider} onChange={e => setProvider(e.target.value)} className="input-base w-full" placeholder='ד"ר כהן' />
        </div>
        <div>
          <label className="text-xs text-theme-muted block mb-1">מיקום</label>
          <input value={loc} onChange={e => setLoc(e.target.value)} className="input-base w-full" placeholder="כתובת" />
        </div>
        <button type="submit" className="w-full bg-accent-600 hover:bg-accent-500 text-white font-medium py-2 rounded-lg text-sm transition-colors">שמור</button>
      </form>
    </div>
  );
}

/* ─── Simple Daily Charts ─── */
function DailyCharts({ logs, days = 7, timeZone }: { logs: Row[]; days?: number; timeZone: string }) {
  const chartData = useMemo(() => {
    const result: { date: string; feedings: number; ml: number; diapers: number; sleeps: number; tummyTime: number }[] = [];
    const today = new Date(getTodayInTimeZone(timeZone) + "T12:00:00");
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = dateToIsoInTimeZone(d, timeZone);
      const dayLogs = logs.filter((l) => l.event_at && utcIsoToDateInput(l.event_at, timeZone) === dateStr);
      result.push({
        date: dateStr,
        feedings: dayLogs.filter(l => l.log_type === "feeding").length,
        ml: dayLogs.filter(l => l.log_type === "feeding").reduce((s, l) => s + (l.amount ?? 0), 0),
        diapers: dayLogs.filter(l => l.log_type === "diaper_change").length,
        sleeps: dayLogs.filter(l => l.log_type === "sleep").length,
        tummyTime: dayLogs.filter(l => l.log_type === "tummy_time").reduce((s, l) => s + (l.amount ?? 0), 0),
      });
    }
    return result;
  }, [logs, days, timeZone]);

  const maxMl = Math.max(...chartData.map(d => d.ml), 1);
  const maxTummy = Math.max(...chartData.map(d => d.tummyTime), 1);

  return (
    <div className="space-y-4">
      {/* Feeding ML chart */}
      <div>
        <h4 className="text-xs font-semibold text-theme-muted mb-2 flex items-center gap-1.5">
          <Icon name="bottle" className="w-3.5 h-3.5" /> כמות אכילה יומית (מ״ל)
        </h4>
        <div className="flex items-end gap-1 h-24">
          {chartData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-slate-800 rounded-t-sm relative overflow-hidden" style={{ height: "100%" }}>
                <div className="absolute bottom-0 w-full bg-accent-600 rounded-t-sm transition-all" style={{ height: `${(d.ml / maxMl) * 100}%` }} />
              </div>
              <span className="text-[9px] text-theme-muted">{new Date(d.date).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })}</span>
              <span className="text-[9px] text-accent-400 font-medium">{d.ml}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tummy time chart */}
      <div>
        <h4 className="text-xs font-semibold text-theme-muted mb-2 flex items-center gap-1.5">
          <Icon name="baby" className="w-3.5 h-3.5 text-pink-400" /> זמן בטן יומי (דקות)
        </h4>
        <div className="flex items-end gap-1 h-20">
          {chartData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-slate-800 rounded-t-sm relative overflow-hidden" style={{ height: "100%" }}>
                <div className="absolute bottom-0 w-full bg-pink-600 rounded-t-sm transition-all" style={{ height: `${(d.tummyTime / maxTummy) * 100}%` }} />
              </div>
              <span className="text-[9px] text-theme-muted">{new Date(d.date).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })}</span>
              <span className="text-[9px] text-pink-400 font-medium">{d.tummyTime > 0 ? d.tummyTime : "—"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Counts chart */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-theme">{chartData[chartData.length - 1]?.feedings ?? 0}</div>
          <div className="text-[10px] text-theme-muted">האכלות היום</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-theme">{chartData[chartData.length - 1]?.diapers ?? 0}</div>
          <div className="text-[10px] text-theme-muted">חיתולים היום</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-theme">{chartData[chartData.length - 1]?.ml ?? 0}</div>
          <div className="text-[10px] text-theme-muted">מ״ל היום</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-pink-400">
            {chartData[chartData.length - 1]?.tummyTime ? formatMinutes(chartData[chartData.length - 1].tummyTime) : "—"}
          </div>
          <div className="text-[10px] text-theme-muted">זמן בטן היום</div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Baby Component ─── */
export default function Baby() {
  const timeZone = usePreferencesStore((s) => s.timeZone);
  const { data: children = [] } = useChildren();
  const [activeChild, setActiveChild] = useState<string>("");
  const cid = activeChild || children[0]?.id;
  const activeChildData = children.find(c => c.id === cid);
  const { data: logs = [], addLog, updateLog, deleteLog } = useBabyLogs(cid);
  const { data: appointments = [], upsertAppointment, deleteAppointment } = useAppointments();
  const [tab, setTab] = useState<"logs" | "charts" | "events">("logs");
  const [eventModal, setEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Row | null>(null);
  const [addLogType, setAddLogType] = useState<string | null>(null);
  const [editingLog, setEditingLog] = useState<Row | null>(null);
  const [selectedDate, setSelectedDate] = useState(getTodayInTimeZone(timeZone));

  const dateLogs = logs.filter((l) => l.event_at && utcIsoToDateInput(l.event_at, timeZone) === selectedDate);
  const feedings = dateLogs.filter(l => l.log_type === "feeding");
  const totalMl = feedings.reduce((s, f) => s + (f.amount ?? 0), 0);
  const tummyTimeLogs = dateLogs.filter(l => l.log_type === "tummy_time");
  const totalTummyMinutes = tummyTimeLogs.reduce((s, l) => s + (l.amount ?? 0), 0);

  const navigateDate = (delta: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const today = getTodayInTimeZone(timeZone);
  const isToday = selectedDate === today;

  const lastFeedingAmount = useMemo(() => {
    const lastFeeding = logs.find(l => l.log_type === "feeding" && l.amount);
    return lastFeeding?.amount ?? 120;
  }, [logs]);

  const logTypes = [
    { id: "feeding",      label: "האכלה",    icon: "bottle"    as const, color: "text-accent-400" },
    { id: "diaper_change",label: "חיתול",    icon: "diaper"    as const, color: "text-amber-400"  },
    { id: "sleep",        label: "שינה",     icon: "moon"      as const, color: "text-indigo-400" },
    { id: "tummy_time",   label: "זמן בטן",  icon: "baby"      as const, color: "text-pink-400"   },
    { id: "bio_gaia",     label: "ביו גאיה", icon: "pill"      as const, color: "text-emerald-400"},
    { id: "vitamin_d",    label: "ויטמין D", icon: "pill"      as const, color: "text-yellow-400" },
    { id: "leczchik",     label: "ליקצ׳יק",  icon: "pill"      as const, color: "text-teal-400"   },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-theme">תינוקות</h2>
          {activeChildData && <p className="text-accent-400 font-medium mt-0.5">{activeChildData.name}</p>}
        </div>
        <div className="flex gap-2">
          {tab === "events" && (
            <button onClick={() => setEventModal(true)} className="bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5">
              <Icon name="plus" className="w-3.5 h-3.5" /> אירוע
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {children.length === 0 && (
        <div className="text-center py-16 text-theme-muted">
          <Icon name="baby" className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="mb-2">עדיין לא הוספת תינוק/ת</p>
          <p className="text-xs">ניתן להוסיף תינוקות דרך ההגדרות</p>
        </div>
      )}

      {/* Child selector */}
      {children.length >= 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {children.map(c => (
            <button key={c.id} onClick={() => setActiveChild(c.id)}
              className={"px-3 py-1.5 rounded-lg text-sm font-medium transition-colors " + (cid === c.id ? "bg-accent-600 text-white" : "bg-slate-800 text-theme-muted hover:bg-slate-700")}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Date Navigation */}
      {children.length > 0 && tab === "logs" && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <button onClick={() => navigateDate(-1)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-theme-muted hover:text-theme transition-colors shrink-0">
            <Icon name="chevron-right" className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <AppCalendar value={selectedDate} onChange={setSelectedDate} placeholder="בחר תאריך" />
          </div>
          {!isToday && (
            <button onClick={() => setSelectedDate(today)}
              className="text-xs text-accent-400 hover:text-accent-300 font-medium shrink-0">
              היום
            </button>
          )}
          <button onClick={() => navigateDate(1)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-theme-muted hover:text-theme transition-colors shrink-0">
            <Icon name="chevron-left" className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      {children.length > 0 && (
        <>
          <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5 w-fit mb-5">
            {(["logs", "charts", "events"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={"px-4 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 " + (tab === t ? "bg-accent-700 text-white" : "text-theme-muted hover:text-theme")}>
                {t === "logs" && <><Icon name="clipboard" className="w-3.5 h-3.5" /> יומן היום</>}
                {t === "charts" && <><Icon name="chart" className="w-3.5 h-3.5" /> גרפים</>}
                {t === "events" && <><Icon name="calendar" className="w-3.5 h-3.5" /> אירועים</>}
              </button>
            ))}
          </div>

          {/* ─── Logs Tab ─── */}
          {tab === "logs" && (
            <div>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-theme">{feedings.length}</div>
                  <div className="text-xs text-theme-muted mt-1">האכלות</div>
                  {feedings.length > 0 && <div className="text-xs text-accent-400 mt-0.5">{totalMl} מ״ל</div>}
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-theme">{dateLogs.filter(l => l.log_type === "diaper_change").length}</div>
                  <div className="text-xs text-theme-muted mt-1">חיתולים</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center col-span-2 sm:col-span-1">
                  <div className={`text-2xl font-bold ${totalTummyMinutes > 0 ? "text-pink-400" : "text-theme"}`}>
                    {totalTummyMinutes > 0 ? formatMinutes(totalTummyMinutes) : "—"}
                  </div>
                  <div className="text-xs text-theme-muted mt-1">זמן בטן</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-theme">{dateLogs.length}</div>
                  <div className="text-xs text-theme-muted mt-1">סה״כ</div>
                </div>
              </div>

              {/* Quick add buttons */}
              <div className="flex gap-2 flex-wrap mb-5">
                {logTypes.map(lt => (
                  <button key={lt.id} onClick={() => setAddLogType(lt.id)}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl px-3 py-2 text-sm font-medium transition-colors text-theme">
                    <Icon name={lt.icon} className={`w-4 h-4 ${lt.color}`} /> {lt.label}
                  </button>
                ))}
              </div>

              {/* Today's log list */}
              <div className="space-y-2">
                {dateLogs.map(log => (
                  <div key={log.id} className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 group">
                    <LogIcon type={log.log_type} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-theme">{LOG_LABELS[log.log_type] ?? log.log_type}</div>
                      {log.amount != null && (
                        <div className="text-xs text-theme-muted">
                          {log.log_type === "tummy_time" ? formatMinutes(log.amount) : `${log.amount} ${log.unit ?? "מ״ל"}`}
                        </div>
                      )}
                      {log.notes && <div className="text-xs text-theme-muted opacity-70 truncate">{log.notes}</div>}
                    </div>
                    <span className="text-xs text-theme-muted shrink-0">{formatInTimeZone(log.event_at, timeZone, { hour: "2-digit", minute: "2-digit" })}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingLog(log)} className="text-theme-muted hover:text-accent-400">
                        <Icon name="edit" className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteLog.mutate(log.id)} className="text-theme-muted hover:text-red-400">
                        <Icon name="trash" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {dateLogs.length === 0 && <div className="text-center py-10 text-theme-muted">אין רשומות להיום. השתמש בכפתורים למעלה.</div>}
              </div>
            </div>
          )}

          {/* ─── Charts Tab ─── */}
          {tab === "charts" && (
            <DailyCharts logs={logs} days={7} timeZone={timeZone} />
          )}

          {/* ─── Events Tab ─── */}
          {tab === "events" && (
            <div className="space-y-3">
              {appointments.length === 0 && <div className="text-center py-10 text-theme-muted">אין אירועים. הוסף אירוע חדש.</div>}
              {appointments.map(appt => (
                <div key={appt.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-start gap-4 group">
                  <div className="text-center shrink-0">
                    <div className="text-sm font-bold text-accent-400">{formatInTimeZone(appt.starts_at, timeZone, { month: "short", day: "numeric" })}</div>
                    <div className="text-xs text-theme-muted">{formatInTimeZone(appt.starts_at, timeZone, { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-theme truncate">{appt.title}</div>
                    {appt.provider_name && <div className="text-xs text-theme-muted mt-0.5">{appt.provider_name}</div>}
                    {appt.location && <div className="text-xs text-theme-muted opacity-70 truncate">{appt.location}</div>}
                  </div>
                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditingEvent(appt)} className="text-theme-muted hover:text-accent-400 transition-colors">
                      <Icon name="edit" className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteAppointment.mutate(appt.id)} className="text-theme-muted hover:text-red-400 transition-colors">
                      <Icon name="trash" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {addLogType && (
        <AddLogModal
          logType={addLogType}
          lastAmount={addLogType === "feeding" ? lastFeedingAmount : undefined}
          onClose={() => setAddLogType(null)}
          onSave={log => { if (cid) addLog.mutate({ ...log, child_id: cid }); }}
        />
      )}
      {editingLog && (
        <EditLogModal log={editingLog} onClose={() => setEditingLog(null)} onSave={log => updateLog.mutate(log)} />
      )}
      {eventModal && (
        <AddEventModal children={children} onClose={() => setEventModal(false)} onSave={data => upsertAppointment.mutate(data)} />
      )}
      {editingEvent && (
        <EditEventModal event={editingEvent} children={children} onClose={() => setEditingEvent(null)} onSave={data => upsertAppointment.mutate(data)} />
      )}
    </div>
  );
}

