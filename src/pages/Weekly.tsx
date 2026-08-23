import { useMemo, useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppointments } from "../hooks/useBaby";
import { useTasks } from "../hooks/useTasks";
import Icon from "../components/Icon";
import AppCalendar from "../components/AppCalendar";
import { usePreferencesStore } from "../state/stores/preferencesStore";
import {
  formatInTimeZone,
  getNowInTimeZoneInput,
  getTodayInTimeZone,
  utcIsoToDateTimeInput,
  zonedDateTimeToUtcIso,
} from "../lib/datetime";

type Row = Record<string, any>;

function startOfWeek(dateIso: string) {
  const d = new Date(dateIso + "T12:00:00");
  const diffToSunday = d.getDay();
  d.setDate(d.getDate() - diffToSunday);
  return d.toISOString().slice(0, 10);
}

function addDays(dateIso: string, days: number) {
  const d = new Date(dateIso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "מחר", "2 ימים", "4.9", etc. */
function daysUntilLabel(isoDatetime: string, today: string, timeZone: string): { text: string; color: string } {
  const eventDate = isoDatetime.slice(0, 10);
  const diff = Math.round((new Date(eventDate + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime()) / 86400000);
  if (diff < 0) return { text: `איחור ${Math.abs(diff)} יום`, color: "text-red-400" };
  if (diff === 0) return { text: "היום", color: "text-accent-400" };
  if (diff === 1) return { text: "מחר", color: "text-emerald-400" };
  if (diff <= 7) return { text: `בעוד ${diff} ימים`, color: "text-amber-400" };
  return { text: formatInTimeZone(isoDatetime, timeZone, { day: "numeric", month: "numeric" }), color: "text-theme-muted" };
}

/* ─── Add Event Modal ─── */
function AddEventModal({ onClose, onSave, timeZone, defaultDate }: {
  onClose: () => void; onSave: (a: Row) => void; timeZone: string; defaultDate?: string;
}) {
  const [title, setTitle] = useState("");
  const defaultStart = defaultDate
    ? defaultDate + "T09:00"
    : getNowInTimeZoneInput(timeZone);
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [provider, setProvider] = useState("");
  const [loc, setLoc] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ title, starts_at: startsAt ? zonedDateTimeToUtcIso(startsAt, timeZone) : null, provider_name: provider || null, location: loc || null, notes: notes || null, status: "scheduled" });
          onClose();
        }}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm space-y-4 overflow-y-auto max-h-[92dvh]"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-theme">אירוע חדש</h3>
          <button type="button" onClick={onClose} className="text-theme-muted hover:text-theme"><Icon name="x" className="w-4 h-4" /></button>
        </div>
        <div>
          <label className="text-xs text-theme-muted block mb-1">כותרת *</label>
          <input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} className="input-base w-full" placeholder="רופא / יציאה / גן / תור / סידור" />
        </div>
        <AppCalendar mode="datetime" value={startsAt} onChange={setStartsAt} label="תאריך ושעה *" inline />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-theme-muted block mb-1">איש קשר / רופא</label>
            <input value={provider} onChange={(e) => setProvider(e.target.value)} className="input-base w-full" placeholder='ד"ר כהן' />
          </div>
          <div>
            <label className="text-xs text-theme-muted block mb-1">מיקום</label>
            <input value={loc} onChange={(e) => setLoc(e.target.value)} className="input-base w-full" placeholder="כתובת / זום" />
          </div>
        </div>
        <div>
          <label className="text-xs text-theme-muted block mb-1">הערות</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input-base w-full" placeholder="פרטים נוספים..." />
        </div>
        <button type="submit" disabled={!title || !startsAt} className="w-full bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
          שמור אירוע
        </button>
      </form>
    </div>
  );
}

/* ─── Edit Event Modal ─── */
function EditEventModal({ event, onClose, onSave, timeZone }: {
  event: Row; onClose: () => void; onSave: (a: Row) => void; timeZone: string;
}) {
  const [title, setTitle] = useState(event.title ?? "");
  const [startsAt, setStartsAt] = useState(event.starts_at ? utcIsoToDateTimeInput(event.starts_at, timeZone) : getNowInTimeZoneInput(timeZone));
  const [provider, setProvider] = useState(event.provider_name ?? "");
  const [loc, setLoc] = useState(event.location ?? "");
  const [notes, setNotes] = useState(event.notes ?? "");

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ id: event.id, title, starts_at: startsAt ? zonedDateTimeToUtcIso(startsAt, timeZone) : null, provider_name: provider || null, location: loc || null, notes: notes || null });
          onClose();
        }}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm space-y-4 overflow-y-auto max-h-[92dvh]"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-theme">עריכת אירוע</h3>
          <button type="button" onClick={onClose} className="text-theme-muted hover:text-theme"><Icon name="x" className="w-4 h-4" /></button>
        </div>
        <div>
          <label className="text-xs text-theme-muted block mb-1">כותרת *</label>
          <input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} className="input-base w-full" />
        </div>
        <AppCalendar mode="datetime" value={startsAt} onChange={setStartsAt} label="תאריך ושעה" inline />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-theme-muted block mb-1">איש קשר / רופא</label>
            <input value={provider} onChange={(e) => setProvider(e.target.value)} className="input-base w-full" />
          </div>
          <div>
            <label className="text-xs text-theme-muted block mb-1">מיקום</label>
            <input value={loc} onChange={(e) => setLoc(e.target.value)} className="input-base w-full" />
          </div>
        </div>
        <div>
          <label className="text-xs text-theme-muted block mb-1">הערות</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input-base w-full" />
        </div>
        <button type="submit" className="w-full bg-accent-600 hover:bg-accent-500 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">שמור</button>
      </form>
    </div>
  );
}

/* ─── Delete Confirm ─── */
function DeleteConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <div className="flex items-center gap-2 mb-1">
          <Icon name="warning" className="w-5 h-5 text-red-400" />
          <h3 className="text-base font-semibold text-theme">למחוק אירוע זה?</h3>
        </div>
        <p className="text-sm text-theme-muted mt-1">הפעולה אינה ניתנת לביטול.</p>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm bg-slate-800 text-theme-muted hover:bg-slate-700">ביטול</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-500">מחיקה</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Weekly Page ─── */
export default function Weekly() {
  const navigate = useNavigate();
  const timeZone = usePreferencesStore((s) => s.timeZone);
  const { data: appointments = [], upsertAppointment, deleteAppointment } = useAppointments();
  const { data: tasks = [] } = useTasks();

  const today = getTodayInTimeZone(timeZone);
  const [weekAnchor, setWeekAnchor] = useState(today);
  const [addModal, setAddModal] = useState(false);
  const [addDefaultDate, setAddDefaultDate] = useState<string | undefined>();
  const [editingEvent, setEditingEvent] = useState<Row | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const weekStart = startOfWeek(weekAnchor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = addDays(weekStart, 7);

  const DAY_NAMES_FULL = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

  // Week label
  const weekLabel = (() => {
    const s = formatInTimeZone(weekDays[0] + "T12:00:00", timeZone, { day: "numeric", month: "numeric" });
    const e = formatInTimeZone(weekDays[6] + "T12:00:00", timeZone, { day: "numeric", month: "numeric", year: "numeric" });
    return `${s} – ${e}`;
  })();

  const weeklyItems = useMemo(() => {
    const inWeek = (iso: string | null | undefined) => !!iso && iso >= weekStart && iso < weekEnd;
    const eventRows = appointments.filter((a) => inWeek(a.starts_at)).map((a) => ({
      id: `event-${a.id}`, kind: "event" as const, at: a.starts_at as string,
      title: a.title as string,
      meta: [a.provider_name, a.location].filter(Boolean).join(" · "),
      raw: a,
    }));
    const taskRows = tasks
      .filter((t) => t.status !== "done" && t.status !== "cancelled")
      .filter((t) => inWeek(t.scheduled_start_at ?? t.due_at))
      .map((t) => ({
        id: `task-${t.id}`, kind: "task" as const,
        at: (t.scheduled_start_at ?? t.due_at) as string,
        title: t.title as string,
        meta: t.is_recurring ? "חזרתי" : "",
        raw: t,
      }));
    return [...eventRows, ...taskRows].sort((a, b) => a.at.localeCompare(b.at));
  }, [appointments, tasks, weekStart, weekEnd]);

  const upcomingEvents = useMemo(
    () => appointments.filter((a) => (a.starts_at ?? "") >= new Date().toISOString())
      .sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? "")),
    [appointments]
  );

  // Scroll today into view in horizontal grid
  const gridRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (todayRef.current && gridRef.current) {
      const container = gridRef.current;
      const el = todayRef.current;
      const containerLeft = container.getBoundingClientRect().left;
      const elLeft = el.getBoundingClientRect().left;
      container.scrollLeft += elLeft - containerLeft - 8;
    }
  }, [weekStart]);

  const openAddForDay = (day: string) => {
    setAddDefaultDate(day);
    setAddModal(true);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-theme">תכנון שבועי</h2>
          <p className="text-theme-muted text-sm mt-0.5">אירועים, יציאות, תורים ומשימות — הכול במקום אחד.</p>
        </div>
        <button
          onClick={() => { setAddDefaultDate(undefined); setAddModal(true); }}
          className="bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
        >
          <Icon name="plus" className="w-3.5 h-3.5" /> אירוע חדש
        </button>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-theme-muted hover:text-theme active:bg-slate-800 transition-colors">
          <Icon name="chevron-right" className="w-4 h-4" />
        </button>
        <span className="flex-1 text-sm font-medium text-theme text-center">{weekLabel}</span>
        <button onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-theme-muted hover:text-theme active:bg-slate-800 transition-colors">
          <Icon name="chevron-left" className="w-4 h-4" />
        </button>
        {weekStart !== startOfWeek(today) && (
          <button onClick={() => setWeekAnchor(today)}
            className="px-3 py-1.5 rounded-lg bg-accent-900/40 border border-accent-700 text-xs text-accent-300 hover:text-accent-200 font-medium transition-colors">
            השבוע
          </button>
        )}
      </div>

      {/* Horizontal scrollable week grid */}
      <div ref={gridRef} className="overflow-x-auto pb-2 mb-6 -mx-4 px-4 scroll-smooth">
        <div className="flex gap-2" style={{ minWidth: "max-content" }}>
          {weekDays.map((day, idx) => {
            const dayItems = weeklyItems.filter((item) => item.at.slice(0, 10) === day);
            const isToday = day === today;
            const isPast = day < today;

            return (
              <div
                key={day}
                ref={isToday ? todayRef : undefined}
                className={
                  "flex flex-col rounded-xl border p-3 transition-colors " +
                  (isToday
                    ? "border-accent-600 bg-accent-950/30 w-44 flex-shrink-0"
                    : isPast
                    ? "border-slate-800 bg-slate-950/20 opacity-60 w-36 flex-shrink-0"
                    : "border-slate-800 bg-slate-950/40 w-36 flex-shrink-0")
                }
              >
                {/* Day header */}
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className={"text-xs font-bold " + (isToday ? "text-accent-300" : isPast ? "text-slate-500" : "text-theme-muted")}>
                      {DAY_NAMES_FULL[idx]}
                    </div>
                    <div className={"text-lg font-bold leading-none mt-0.5 " + (isToday ? "text-accent-400" : isPast ? "text-slate-500" : "text-theme")}>
                      {formatInTimeZone(day + "T12:00:00", timeZone, { day: "numeric" })}
                    </div>
                    <div className={"text-[10px] " + (isToday ? "text-accent-400/70" : "text-theme-muted opacity-60")}>
                      {formatInTimeZone(day + "T12:00:00", timeZone, { month: "long" })}
                    </div>
                  </div>
                  {!isPast && (
                    <button
                      onClick={() => openAddForDay(day)}
                      className="p-1 rounded-lg text-slate-600 hover:text-accent-400 hover:bg-slate-800 transition-colors"
                      title="הוסף אירוע"
                    >
                      <Icon name="plus" className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Items */}
                <div className="flex flex-col gap-1.5 flex-1">
                  {dayItems.length === 0 && (
                    <div className={"text-[11px] mt-1 " + (isPast ? "text-slate-700" : "text-slate-600")}>
                      {isPast ? "—" : "פנוי"}
                    </div>
                  )}
                  {dayItems.map((item) => (
                    <div
                      key={item.id}
                      className={
                        "rounded-lg border px-2 py-1.5 " +
                        (item.kind === "event"
                          ? "border-accent-800/60 bg-accent-950/40"
                          : "border-slate-700/60 bg-slate-900/60")
                      }
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] text-accent-400/80 font-medium mb-0.5">
                            {formatInTimeZone(item.at, timeZone, { hour: "2-digit", minute: "2-digit" })}
                          </div>
                          <div className="text-[11px] text-theme font-medium leading-snug truncate">{item.title}</div>
                          {item.meta && <div className="text-[10px] text-theme-muted opacity-60 truncate">{item.meta}</div>}
                        </div>
                        {item.kind === "event" && (
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button onClick={() => setEditingEvent(item.raw)} className="p-0.5 text-slate-600 hover:text-accent-400 transition-colors">
                              <Icon name="edit" className="w-3 h-3" />
                            </button>
                            <button onClick={() => setDeletingId(item.raw.id)} className="p-0.5 text-slate-600 hover:text-red-400 transition-colors">
                              <Icon name="trash" className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        {item.kind === "task" && (
                          <button onClick={() => navigate("/tasks")} className="p-0.5 text-slate-600 hover:text-accent-400 transition-colors" title="עבור למשימות">
                            <Icon name="chevron-left" className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming events list */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-theme flex items-center gap-2">
          <Icon name="calendar" className="w-4 h-4 text-accent-400" /> אירועים קרובים
          {upcomingEvents.length > 0 && (
            <span className="text-xs bg-accent-900 text-accent-300 rounded-full px-2 py-0.5">{upcomingEvents.length}</span>
          )}
        </h3>
      </div>

      {upcomingEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 py-10 text-center">
          <Icon name="calendar" className="w-10 h-10 mx-auto text-slate-600 mb-3" />
          <p className="text-sm text-slate-500 mb-3">אין אירועים קרובים מתוכננים</p>
          <button
            onClick={() => { setAddDefaultDate(undefined); setAddModal(true); }}
            className="px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white text-sm rounded-lg transition-colors"
          >
            הוסף אירוע ראשון
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {upcomingEvents.map((appt) => {
            const { text: dueText, color: dueColor } = daysUntilLabel(appt.starts_at, today, timeZone);
            return (
              <div key={appt.id} className="flex items-start gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                {/* Date block */}
                <div className="shrink-0 w-11 text-center bg-slate-800 rounded-xl py-1.5 px-1">
                  <div className="text-base font-bold text-theme leading-none">
                    {formatInTimeZone(appt.starts_at, timeZone, { day: "numeric" })}
                  </div>
                  <div className="text-[10px] text-theme-muted mt-0.5">
                    {formatInTimeZone(appt.starts_at, timeZone, { month: "short" })}
                  </div>
                </div>
                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-theme truncate">{appt.title}</div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-theme-muted">
                      {formatInTimeZone(appt.starts_at, timeZone, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {appt.provider_name && <span className="text-xs text-theme-muted">· {appt.provider_name}</span>}
                    {appt.location && <span className="text-xs text-theme-muted opacity-70">· {appt.location}</span>}
                  </div>
                  {appt.notes && <div className="text-xs text-theme-muted opacity-60 mt-0.5 truncate">{appt.notes}</div>}
                  <div className={"text-[11px] font-medium mt-1 " + dueColor}>{dueText}</div>
                </div>
                {/* Actions - always visible */}
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setEditingEvent(appt)} className="p-1.5 rounded-lg text-slate-600 hover:text-accent-400 hover:bg-slate-800 transition-colors">
                    <Icon name="edit" className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDeletingId(appt.id)} className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-slate-800 transition-colors">
                    <Icon name="trash" className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {addModal && (
        <AddEventModal onClose={() => { setAddModal(false); setAddDefaultDate(undefined); }} onSave={(data) => upsertAppointment.mutate(data)} timeZone={timeZone} defaultDate={addDefaultDate} />
      )}
      {editingEvent && (
        <EditEventModal event={editingEvent} onClose={() => setEditingEvent(null)} onSave={(data) => upsertAppointment.mutate(data)} timeZone={timeZone} />
      )}
      {deletingId && (
        <DeleteConfirm onConfirm={() => { deleteAppointment.mutate(deletingId); setDeletingId(null); }} onCancel={() => setDeletingId(null)} />
      )}
    </div>
  );
}

