import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Icon from "../components/Icon";
import Fab from "../components/Fab";
import AppCalendar from "../components/AppCalendar";
import { useTrip, useTrips } from "../hooks/useTrips";
import { usePreferencesStore } from "../state/stores/preferencesStore";
import { getTodayInTimeZone } from "../lib/datetime";
import {
  KIND_META, STATUS_LABEL, buildTripDays, daysBetween, formatDayLabel, formatMoney, formatShortDate, nightsOf, summarizeTrip,
  type Trip, type TripDay, type TripItem, type TripItemKind, type TripItemStatus,
} from "../lib/trips";

type Draft = Partial<TripItem> & { title: string; start_date: string };

const KIND_CHOICES: TripItemKind[] = ["activity", "hotel", "flight", "car", "transport", "food", "note", "other"];

const STATUS_PILL: Record<TripItemStatus, string> = {
  planned: "badge-neutral",
  booked: "badge-info",
  done: "bg-emerald-950/60 text-emerald-300",
};

/* ─── Add / edit any trip item (bookings and optional activities share one form) ─── */
function ItemSheet({ draft, trip, onClose, onSave, onDelete }: {
  draft: Draft; trip: Trip; onClose: () => void; onSave: (d: Draft) => void; onDelete?: () => void;
}) {
  const [d, setD] = useState<Draft>(draft);
  const [copied, setCopied] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const isHotel = d.kind === "hotel";
  const endLabel = isHotel ? "צ'ק-אאוט" : d.kind === "flight" ? "נחיתה (אם ביום אחר)" : "עד תאריך (אופציונלי)";
  const valid = d.title.trim() && d.start_date && (!d.end_date || d.end_date >= d.start_date);

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form
        onSubmit={(e) => { e.preventDefault(); if (valid) onSave({ ...d, title: d.title.trim() }); }}
        className="modal-panel bg-slate-900 border-slate-700 sm:max-w-md space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-theme">
            {d.id ? "עריכה" : d.is_optional ? "פעילות אופציונלית" : "פריט חדש"}
          </h3>
          <button type="button" onClick={onClose} className="-m-2 p-2 rounded-lg text-theme-muted hover:text-theme" aria-label="סגור"><Icon name="x" className="w-5 h-5" /></button>
        </div>

        {/* Quick actions for existing bookings */}
        {(d.link || d.booking_ref) && d.id && (
          <div className="flex gap-2">
            {d.link && (
              <a href={d.link} target="_blank" rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 py-2.5 text-sm text-theme">
                <Icon name="external-link" className="w-4 h-4" /> פתח הזמנה
              </a>
            )}
            {d.booking_ref && (
              <button type="button"
                onClick={() => { void navigator.clipboard.writeText(d.booking_ref ?? ""); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 py-2.5 text-sm text-theme">
                <Icon name={copied ? "check" : "copy"} className="w-4 h-4" /> {copied ? "הועתק" : "העתק קוד"}
              </button>
            )}
          </div>
        )}

        <div>
          <label className="text-xs text-theme-muted block mb-1.5">סוג</label>
          <div className="grid grid-cols-4 gap-1.5">
            {KIND_CHOICES.map((k) => (
              <button key={k} type="button" onClick={() => set("kind", k)}
                className={"flex flex-col items-center gap-1 rounded-lg border py-2 text-[11px] transition-colors " +
                  (d.kind === k ? "bg-accent-600 border-accent-600 text-white" : "border-slate-700 text-theme-muted hover:text-theme")}>
                <Icon name={KIND_META[k].icon} className="w-4 h-4" />
                {KIND_META[k].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-theme-muted block mb-1">שם *</label>
          <input autoFocus={!d.id} required value={d.title} onChange={(e) => set("title", e.target.value)} className="input-base w-full"
            placeholder={d.is_optional ? "שנירקול בסנוטה, ארוחה ב..." : "שם המלון / טיסה / פעילות"} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <AppCalendar label={isHotel ? "צ'ק-אין *" : "תאריך *"} value={d.start_date} onChange={(v) => set("start_date", v)} />
          <AppCalendar label={endLabel} value={d.end_date ?? ""} onChange={(v) => set("end_date", v || null)} placeholder="—" />
        </div>
        {isHotel && d.end_date && d.end_date > d.start_date && (
          <p className="text-xs text-theme-muted -mt-2">{daysBetween(d.start_date, d.end_date)} לילות</p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-theme-muted block mb-1">שעה</label>
            <input value={d.time_text ?? ""} onChange={(e) => set("time_text", e.target.value || null)} className="input-base w-full" placeholder="09:00 / 16:05-20:30" dir="ltr" />
          </div>
          <div>
            <label className="text-xs text-theme-muted block mb-1">מחיר ({trip.currency})</label>
            <input type="number" inputMode="decimal" min="0" step="any" value={d.price ?? ""}
              onChange={(e) => set("price", e.target.value === "" ? null : Number(e.target.value))} className="input-base w-full" />
          </div>
        </div>

        <div>
          <label className="text-xs text-theme-muted block mb-1">פרטים</label>
          <textarea rows={2} value={d.details ?? ""} onChange={(e) => set("details", e.target.value || null)} className="input-base w-full resize-none"
            placeholder={isHotel ? "סוג חדר, ארוחת בוקר..." : "פרטים, טיפים, מה להביא..."} />
        </div>

        <div>
          <label className="text-xs text-theme-muted block mb-1">קישור</label>
          <input type="url" inputMode="url" value={d.link ?? ""} onChange={(e) => set("link", e.target.value || null)} className="input-base w-full" placeholder="https://" dir="ltr" />
        </div>

        {!d.is_optional && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-theme-muted block mb-1">מספר הזמנה</label>
                <input value={d.booking_ref ?? ""} onChange={(e) => set("booking_ref", e.target.value || null)} className="input-base w-full" dir="ltr" />
              </div>
              <AppCalendar label="ביטול חינם עד" value={d.free_cancel_until ?? ""} onChange={(v) => set("free_cancel_until", v || null)} placeholder="—" />
            </div>
            <div>
              <label className="text-xs text-theme-muted block mb-1.5">סטטוס</label>
              <div className="grid grid-cols-3 gap-2">
                {(["planned", "booked", "done"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => set("status", s)}
                    className={"py-2.5 sm:py-2 rounded-lg text-sm border transition-colors " +
                      ((d.status ?? "planned") === s ? "bg-accent-600 border-accent-600 text-white" : "border-slate-700 text-theme-muted hover:text-theme")}>
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-theme-muted block mb-1">לטפל (משימה פתוחה)</label>
              <input value={d.todo ?? ""} onChange={(e) => set("todo", e.target.value || null)} className="input-base w-full" placeholder="להזמין שאטל, למלא טופס..." />
            </div>
          </>
        )}

        <label className="flex items-center gap-3 cursor-pointer py-1">
          <input type="checkbox" checked={!!d.is_optional} onChange={(e) => set("is_optional", e.target.checked)}
            className="w-5 h-5 sm:w-4 sm:h-4 accent-[rgb(var(--accent-600))]" />
          <span className="text-sm text-theme">אופציונלי (רעיון, עוד לא בתוכנית)</span>
        </label>

        <div className="flex gap-2">
          {onDelete && (
            <button type="button" onClick={onDelete}
              className="px-4 py-3 sm:py-2.5 rounded-xl sm:rounded-lg text-sm font-medium bg-red-950/50 text-red-300 hover:bg-red-900/50" aria-label="מחיקה">
              <Icon name="trash" className="w-4 h-4" />
            </button>
          )}
          <button type="submit" disabled={!valid}
            className="flex-1 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white font-medium py-3 sm:py-2.5 rounded-xl sm:rounded-lg text-sm">
            {d.id ? "שמור" : "הוסף"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── Trip settings (rename, dates, currency, delete) ─── */
function TripSettingsSheet({ trip, onClose, onSave, onDelete }: {
  trip: Trip; onClose: () => void; onSave: (p: Partial<Trip>) => void; onDelete: () => void;
}) {
  const [name, setName] = useState(trip.name);
  const [destination, setDestination] = useState(trip.destination ?? "");
  const [start, setStart] = useState(trip.start_date);
  const [end, setEnd] = useState(trip.end_date);
  const [currency, setCurrency] = useState(trip.currency);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const valid = name.trim() && start && end && end >= start;
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={(e) => { e.preventDefault(); if (valid) onSave({ name: name.trim(), destination: destination.trim() || null, start_date: start, end_date: end, currency }); }}
        className="modal-panel bg-slate-900 border-slate-700 sm:max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-theme">הגדרות טיול</h3>
          <button type="button" onClick={onClose} className="-m-2 p-2 rounded-lg text-theme-muted hover:text-theme" aria-label="סגור"><Icon name="x" className="w-5 h-5" /></button>
        </div>
        <div>
          <label className="text-xs text-theme-muted block mb-1">שם</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input-base w-full" />
        </div>
        <div>
          <label className="text-xs text-theme-muted block mb-1">יעד</label>
          <input value={destination} onChange={(e) => setDestination(e.target.value)} className="input-base w-full" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <AppCalendar label="יציאה" value={start} onChange={setStart} />
          <AppCalendar label="חזרה" value={end} onChange={setEnd} />
        </div>
        <div>
          <label className="text-xs text-theme-muted block mb-1">מטבע</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input-base w-full">
            <option value="USD">דולר $</option><option value="EUR">יורו €</option><option value="ILS">שקל ₪</option>
          </select>
        </div>
        <button type="submit" disabled={!valid} className="w-full bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white font-medium py-3 sm:py-2.5 rounded-xl sm:rounded-lg text-sm">שמור</button>
        {confirmDelete ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirmDelete(false)} className="py-2.5 rounded-xl sm:rounded-lg text-sm bg-slate-800 text-theme-muted">ביטול</button>
            <button type="button" onClick={onDelete} className="py-2.5 rounded-xl sm:rounded-lg text-sm bg-red-600 text-white">מחק את כל הטיול</button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="w-full py-2.5 text-sm text-danger">מחיקת הטיול...</button>
        )}
      </form>
    </div>
  );
}

/* ─── One booking / planned row ─── */
function ItemRow({ item, currency, onOpen }: { item: TripItem; currency: string; onOpen: () => void }) {
  const nights = item.kind === "hotel" ? nightsOf(item) : 0;
  const sub = [
    item.kind === "hotel" ? `צ'ק-אין · ${nights} ${nights === 1 ? "לילה" : "לילות"}` : null,
    item.kind === "flight" && item.end_date ? `נחיתה ${formatShortDate(item.end_date)}` : null,
    item.details,
  ].filter(Boolean).join(" · ");
  return (
    <button type="button" onClick={onOpen} className="w-full text-right flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-800/60 transition-colors">
      <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
        <Icon name={KIND_META[item.kind].icon} className="w-4 h-4 text-accent-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          {item.time_text && <span className="text-xs font-semibold text-accent-400 shrink-0" dir="ltr">{item.time_text}</span>}
          <span className="text-[15px] sm:text-sm font-medium text-theme leading-snug">{item.title}</span>
        </div>
        {sub && <p className="text-xs text-theme-muted mt-0.5 line-clamp-2">{sub}</p>}
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          <span className={"text-[11px] px-1.5 py-0.5 rounded-full font-medium " + STATUS_PILL[item.status]}>{STATUS_LABEL[item.status]}</span>
          {item.price != null && <span className="text-xs text-theme-muted">{formatMoney(item.price, currency)}</span>}
          {item.link && <Icon name="link" className="w-3.5 h-3.5 text-theme-muted" />}
        </div>
        {item.todo && (
          <p className="text-xs text-warning mt-1 flex items-center gap-1"><Icon name="alert" className="w-3.5 h-3.5 shrink-0" /> {item.todo}</p>
        )}
      </div>
    </button>
  );
}

/* ─── A single day ─── */
function DayCard({ day, trip, isToday, expanded, onToggle, onOpen, onQuickAddOption, onPromote, onDeleteOption, onAddItem }: {
  day: TripDay; trip: Trip; isToday: boolean; expanded: boolean; onToggle: () => void;
  onOpen: (item: TripItem) => void;
  onQuickAddOption: (date: string, title: string) => void;
  onPromote: (item: TripItem) => void;
  onDeleteOption: (item: TripItem) => void;
  onAddItem: (date: string, optional: boolean) => void;
}) {
  const [idea, setIdea] = useState("");
  const { weekday, date } = formatDayLabel(day.date);
  // Check-in days already show the hotel as a row; this line covers the nights in between
  const tonight = day.stayingAt?.item;
  const submitIdea = () => {
    if (!idea.trim()) return;
    onQuickAddOption(day.date, idea.trim());
    setIdea("");
  };

  // Collapsed summary: the day's flights (with times) and where we sleep tonight
  const flights = day.items.filter((i) => i.kind === "flight");
  const checkIn = day.items.find((i) => i.kind === "hotel");
  const sleepHotel = checkIn ?? day.stayingAt?.item;
  const otherCount = day.items.filter((i) => i.kind !== "flight" && i.kind !== "hotel").length;
  const hasTodo = day.items.some((i) => i.todo?.trim());

  return (
    <section id={`day-${day.date}`} className={"rounded-2xl border bg-slate-900 overflow-hidden " + (isToday ? "border-accent-600" : "border-slate-800")}>
      {/* Header + summary — tap to expand */}
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="w-full text-right px-4 pt-3 pb-3 hover:bg-slate-800/40 transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-xs font-bold text-accent-400 shrink-0">יום {day.index + 1}</span>
            <h3 className="text-base font-semibold text-theme">{weekday}</h3>
            <span className="text-sm text-theme-muted">{date}</span>
            {isToday && <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-accent-900 text-accent-300">היום</span>}
          </div>
          <Icon name={expanded ? "chevron-up" : "chevron-down"} className="w-5 h-5 text-theme-muted shrink-0" />
        </div>

        {!expanded && (
          <div className="mt-2 space-y-1.5">
            {flights.map((f) => (
              <div key={f.id} className="flex items-center gap-2 min-w-0">
                <Icon name="plane" className="w-4 h-4 text-accent-400 shrink-0" />
                {f.time_text && <span className="text-sm font-semibold text-theme shrink-0" dir="ltr">{f.time_text}</span>}
                <span className="text-sm text-theme truncate">{f.title}</span>
              </div>
            ))}
            {sleepHotel ? (
              <div className="flex items-center gap-2 min-w-0">
                <Icon name="bed" className="w-4 h-4 text-accent-400 shrink-0" />
                <span className="text-sm text-theme truncate">{sleepHotel.title}</span>
                <span className="text-xs text-theme-muted shrink-0">
                  {checkIn ? "צ'ק-אין" : `לילה ${day.stayingAt!.night}/${day.stayingAt!.nights}`}
                </span>
              </div>
            ) : flights.length === 0 && (
              <p className="text-sm text-theme-muted">{day.checkouts.length ? `צ'ק-אאוט: ${day.checkouts[0].title}` : "יום פתוח"}</p>
            )}
            {(otherCount > 0 || day.options.length > 0 || hasTodo) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-xs text-theme-muted">
                {otherCount > 0 && <span>+{otherCount} נוספים</span>}
                {day.options.length > 0 && <span className="flex items-center gap-1"><Icon name="star" className="w-3.5 h-3.5" /> {day.options.length} רעיונות</span>}
                {hasTodo && <span className="flex items-center gap-1 text-warning"><Icon name="alert" className="w-3.5 h-3.5" /> לטפל</span>}
              </div>
            )}
          </div>
        )}
      </button>

      {expanded && (<>
      <div className="flex justify-end px-2 -mt-2">
        <button type="button" onClick={() => onAddItem(day.date, false)}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-theme-muted hover:text-accent-400" aria-label="הוסף פריט ליום">
          <Icon name="plus" className="w-4 h-4" /> פריט ליום
        </button>
      </div>

      {/* Where we sleep tonight */}
      {tonight && (
        <button type="button" onClick={() => onOpen(tonight)} className="mx-4 mb-1 flex items-center gap-1.5 text-xs text-theme-muted hover:text-theme max-w-[calc(100%-2rem)]">
          <Icon name="bed" className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            לינה: {tonight.title}
            {day.stayingAt ? ` · לילה ${day.stayingAt.night}/${day.stayingAt.nights}` : ""}
          </span>
        </button>
      )}
      {day.checkouts.map((h) => (
        <p key={h.id} className="mx-4 mb-1 text-xs text-theme-muted flex items-center gap-1.5">
          <Icon name="logout" className="w-3.5 h-3.5 shrink-0" /> צ'ק-אאוט: {h.title}
        </p>
      ))}

      {/* Committed plan */}
      <div className="px-1 pb-1">
        {day.items.map((item) => <ItemRow key={item.id} item={item} currency={trip.currency} onOpen={() => onOpen(item)} />)}
        {day.items.length === 0 && !day.stayingAt && day.checkouts.length === 0 && (
          <p className="px-3 py-2 text-xs text-theme-muted">יום פתוח — אפשר להוסיף רעיונות למטה</p>
        )}
      </div>

      {/* Optional activities */}
      <div className="border-t border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-theme-muted flex items-center gap-1.5">
            <Icon name="star" className="w-3.5 h-3.5" /> פעילויות אופציונליות
            {day.options.length > 0 && <span className="text-theme-muted font-normal">({day.options.length})</span>}
          </h4>
        </div>
        {day.options.length > 0 && (
          <ul className="space-y-1.5 mb-2">
            {day.options.map((opt) => (
              <li key={opt.id} className="flex items-center gap-1 rounded-xl border border-dashed border-slate-700 ps-3 pe-1 py-1">
                <button type="button" onClick={() => onOpen(opt)} className="flex-1 min-w-0 text-right py-1.5">
                  <span className="text-sm text-theme">{opt.title}</span>
                  {(opt.time_text || opt.price != null || opt.details) && (
                    <span className="block text-xs text-theme-muted truncate">
                      {[opt.time_text, opt.price != null ? formatMoney(opt.price, trip.currency) : null, opt.details].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </button>
                {opt.link && (
                  <a href={opt.link} target="_blank" rel="noreferrer" className="p-2 text-theme-muted hover:text-accent-400" aria-label="קישור">
                    <Icon name="external-link" className="w-4 h-4" />
                  </a>
                )}
                <button type="button" onClick={() => onPromote(opt)}
                  className="shrink-0 rounded-lg bg-accent-600 hover:bg-accent-500 text-white text-xs font-medium px-2.5 py-2 flex items-center gap-1">
                  <Icon name="check" className="w-3.5 h-3.5" /> לתוכנית
                </button>
                <button type="button" onClick={() => onDeleteOption(opt)} className="p-2 text-theme-muted hover:text-danger" aria-label="הסר אפשרות">
                  <Icon name="x" className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {/* Quick add: type an idea + Enter; the ⋯ opens the full form (price, link, time) */}
        <div className="flex gap-2">
          <input value={idea} onChange={(e) => setIdea(e.target.value)} enterKeyHint="done"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitIdea(); } }}
            className="input-base flex-1 min-w-0 text-sm" placeholder="הוסף רעיון לפעילות..." />
          {idea.trim() ? (
            <button type="button" onClick={submitIdea} className="shrink-0 px-3 rounded-lg bg-accent-600 text-white text-sm" aria-label="הוסף">
              <Icon name="plus" className="w-4 h-4" />
            </button>
          ) : (
            <button type="button" onClick={() => onAddItem(day.date, true)} className="shrink-0 px-3 rounded-lg bg-slate-800 text-theme-muted text-sm" aria-label="רעיון עם פרטים">
              <Icon name="more" className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      </>)}
    </section>
  );
}

const PAGE_SIZE = 3;

export default function TripDetail() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const timeZone = usePreferencesStore((s) => s.timeZone);
  const today = getTodayInTimeZone(timeZone);
  const { trip, items, isLoading, updateTrip, upsertItem, deleteItem } = useTrip(tripId);
  const { deleteTrip } = useTrips();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showTodos, setShowTodos] = useState(false);
  const [pageStart, setPageStart] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const stripRef = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const days = useMemo(() => (trip ? buildTripDays(trip, items) : []), [trip, items]);
  // Open on the 3-day page containing today while travelling, otherwise the first page
  const todayIndex = days.findIndex((d) => d.date === today);
  const start = pageStart ?? (todayIndex >= 0 ? Math.floor(todayIndex / PAGE_SIZE) * PAGE_SIZE : 0);
  const visibleDays = days.slice(start, start + PAGE_SIZE);
  const canPrev = start > 0;
  const canNext = start + PAGE_SIZE < days.length;
  const goTo = (s: number) => setPageStart(Math.max(0, Math.min(s, Math.max(0, days.length - 1))));

  // Keep the current page's chips in view in the day strip
  useEffect(() => {
    stripRef.current?.querySelector<HTMLElement>(`[data-day-index="${start}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [start]);
  const summary = useMemo(() => summarizeTrip(items, today), [items, today]);
  const outOfRange = useMemo(
    () => (trip ? items.filter((i) => i.start_date < trip.start_date || i.start_date > trip.end_date) : []),
    [trip, items]
  );

  if (isLoading) return <div className="text-sm text-theme-muted animate-pulse py-10 text-center">טוען...</div>;
  if (!trip) {
    return (
      <div className="py-16 text-center">
        <p className="text-theme mb-3">הטיול לא נמצא</p>
        <Link to="/trips" className="text-accent-400 text-sm">חזרה לטיולים</Link>
      </div>
    );
  }

  const nights = daysBetween(trip.start_date, trip.end_date);
  const toStart = daysBetween(today, trip.start_date);
  const soonDeadlines = summary.deadlines.filter((i) => daysBetween(today, i.free_cancel_until!) <= 30);

  const newDraft = (date: string, optional: boolean): Draft => ({
    title: "", start_date: date, end_date: null, kind: "activity", is_optional: optional, status: "planned",
  });

  const save = (d: Draft) => {
    const { id, ...rest } = d;
    // Optional items never carry booking state
    const payload = d.is_optional ? { ...rest, status: "planned" as const } : rest;
    upsertItem.mutate(id ? { id, ...payload } : payload);
    setEditing(null);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <Link to="/trips" className="inline-flex items-center gap-1 text-xs text-theme-muted hover:text-theme mb-2 py-1">
          <Icon name="chevron-right" className="w-3.5 h-3.5" /> כל הטיולים
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-theme leading-tight">{trip.name}</h2>
            <p className="text-sm text-theme-muted mt-1">
              {formatShortDate(trip.start_date)} – {formatShortDate(trip.end_date)}.{trip.end_date.slice(0, 4)} · {nights} לילות
              {toStart > 0 && <span className="text-accent-400 font-medium"> · בעוד {toStart} ימים</span>}
            </p>
            {trip.destination && <p className="text-xs text-theme-muted mt-0.5 flex items-center gap-1"><Icon name="map-pin" className="w-3.5 h-3.5" /> {trip.destination}</p>}
          </div>
          <button type="button" onClick={() => setShowSettings(true)} className="-me-2 p-2.5 rounded-xl text-theme-muted hover:text-theme hover:bg-slate-800" aria-label="הגדרות טיול">
            <Icon name="settings" className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-xl bg-slate-900 border border-slate-800 px-2 py-3 text-center min-w-0">
          <div className="text-base sm:text-lg font-bold text-theme truncate">{formatMoney(summary.plannedTotal, trip.currency)}</div>
          <div className="text-[11px] text-theme-muted">עלות מתוכננת</div>
        </div>
        <button type="button" onClick={() => setShowTodos(true)} className="rounded-xl bg-slate-900 border border-slate-800 px-2 py-3 text-center min-w-0">
          <div className={"text-base sm:text-lg font-bold " + (summary.todos.length ? "text-warning" : "text-theme")}>{summary.todos.length}</div>
          <div className="text-[11px] text-theme-muted">לטפל</div>
        </button>
        <div className="rounded-xl bg-slate-900 border border-slate-800 px-2 py-3 text-center min-w-0">
          <div className="text-base sm:text-lg font-bold text-theme">{summary.optionsCount}</div>
          <div className="text-[11px] text-theme-muted">רעיונות לפעילות</div>
        </div>
      </div>

      {/* To handle: open to-dos + free-cancellation deadlines in the next 30 days */}
      {(summary.todos.length > 0 || soonDeadlines.length > 0) && (
        <section className="mb-4 rounded-2xl border alert-warning">
          <button type="button" onClick={() => setShowTodos((s) => !s)} className="w-full flex items-center justify-between px-4 py-3">
            <span className="text-sm font-semibold text-warning flex items-center gap-2"><Icon name="alert" className="w-4 h-4" /> לטפל לפני הטיול</span>
            <Icon name={showTodos ? "chevron-up" : "chevron-down"} className="w-4 h-4 text-warning" />
          </button>
          {showTodos && (
            <ul className="px-2 pb-2 space-y-0.5">
              {summary.todos.map((i) => (
                <li key={i.id}>
                  <button type="button" onClick={() => setEditing(i)} className="w-full text-right rounded-lg px-2 py-2 hover:bg-black/10">
                    <span className="block text-sm text-theme">{i.todo}</span>
                    <span className="block text-xs text-theme-muted">{i.title} · {formatShortDate(i.start_date)}</span>
                  </button>
                </li>
              ))}
              {soonDeadlines.map((i) => (
                <li key={`d-${i.id}`}>
                  <button type="button" onClick={() => setEditing(i)} className="w-full text-right rounded-lg px-2 py-2 hover:bg-black/10">
                    <span className="block text-sm text-theme">ביטול חינם עד {formatShortDate(i.free_cancel_until)} ({daysBetween(today, i.free_cancel_until!)} ימים)</span>
                    <span className="block text-xs text-theme-muted">{i.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Day strip: jump anywhere; the current 3-day page is highlighted */}
      <div ref={stripRef} className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 pb-2" aria-label="ימי הטיול">
        {days.map((d) => {
          const { date } = formatDayLabel(d.date);
          const inPage = d.index >= start && d.index < start + PAGE_SIZE;
          return (
            <button key={d.date} type="button" data-day-index={d.index}
              onClick={() => { goTo(Math.floor(d.index / PAGE_SIZE) * PAGE_SIZE); setExpanded((prev) => new Set(prev).add(d.date)); }}
              className={"shrink-0 w-12 rounded-lg border py-1.5 text-center transition-colors " +
                (inPage ? "border-accent-600 bg-accent-950/40" : "border-slate-800 bg-slate-900 hover:bg-slate-800")}>
              <span className={"block text-[11px] font-semibold " + (d.date === today ? "text-accent-400" : "text-theme")}>{d.index + 1}</span>
              <span className="block text-[10px] text-theme-muted">{date}</span>
            </button>
          );
        })}
      </div>

      {/* Pager */}
      <div className="flex items-center gap-2 mb-3">
        <button type="button" onClick={() => goTo(start - PAGE_SIZE)} disabled={!canPrev} aria-label="3 ימים קודמים"
          className="p-3 sm:p-2 rounded-xl bg-slate-900 border border-slate-800 text-theme disabled:opacity-30">
          <Icon name="chevron-right" className="w-5 h-5" />
        </button>
        <div className="flex-1 text-center">
          <div className="text-sm font-semibold text-theme">
            ימים {start + 1}–{start + visibleDays.length} מתוך {days.length}
          </div>
          {visibleDays.length > 0 && (
            <div className="text-xs text-theme-muted">
              {formatShortDate(visibleDays[0].date)} – {formatShortDate(visibleDays[visibleDays.length - 1].date)}
            </div>
          )}
        </div>
        <button type="button" onClick={() => goTo(start + PAGE_SIZE)} disabled={!canNext} aria-label="3 ימים הבאים"
          className="p-3 sm:p-2 rounded-xl bg-slate-900 border border-slate-800 text-theme disabled:opacity-30">
          <Icon name="chevron-left" className="w-5 h-5" />
        </button>
      </div>

      {/* Current 3 days — swipe to page (RTL: drag right for the next days) */}
      <div
        key={start}
        className="space-y-3"
        style={{ animation: "modal-fade 180ms ease-out" }}
        onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={(e) => {
          const t0 = touch.current;
          touch.current = null;
          if (!t0) return;
          const dx = e.changedTouches[0].clientX - t0.x;
          const dy = e.changedTouches[0].clientY - t0.y;
          if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
          if (dx > 0 && canNext) goTo(start + PAGE_SIZE);
          if (dx < 0 && canPrev) goTo(start - PAGE_SIZE);
        }}
      >
        {visibleDays.map((day) => (
          <DayCard key={day.date} day={day} trip={trip} isToday={day.date === today}
            expanded={expanded.has(day.date)}
            onToggle={() => setExpanded((prev) => {
              const next = new Set(prev);
              if (next.has(day.date)) next.delete(day.date); else next.add(day.date);
              return next;
            })}
            onOpen={(item) => setEditing(item)}
            onAddItem={(date, optional) => setEditing(newDraft(date, optional))}
            onQuickAddOption={(date, title) => upsertItem.mutate({ title, start_date: date, kind: "activity", is_optional: true, status: "planned" })}
            onPromote={(item) => upsertItem.mutate({ id: item.id, title: item.title, start_date: item.start_date, is_optional: false })}
            onDeleteOption={(item) => deleteItem.mutate(item.id)}
          />
        ))}
      </div>

      {outOfRange.length > 0 && (
        <section className="mt-4 rounded-2xl border border-slate-800 bg-slate-900 p-3">
          <h3 className="text-xs font-semibold text-theme-muted mb-1 px-1">מחוץ לתאריכי הטיול</h3>
          {outOfRange.map((i) => <ItemRow key={i.id} item={i} currency={trip.currency} onOpen={() => setEditing(i)} />)}
        </section>
      )}

      <div className="h-20 md:hidden" aria-hidden="true" />
      <Fab label="פריט" onClick={() => setEditing(newDraft(visibleDays[0]?.date ?? trip.start_date, false))} />

      {editing && (
        <ItemSheet
          key={editing.id ?? "new"}
          draft={editing}
          trip={trip}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={editing.id ? () => { deleteItem.mutate(editing.id!); setEditing(null); } : undefined}
        />
      )}
      {showSettings && (
        <TripSettingsSheet trip={trip} onClose={() => setShowSettings(false)}
          onSave={(p) => { updateTrip.mutate(p); setShowSettings(false); }}
          onDelete={() => deleteTrip.mutate(trip.id, { onSuccess: () => navigate("/trips", { replace: true }) })} />
      )}
    </div>
  );
}
