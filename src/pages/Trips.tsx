import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import Fab from "../components/Fab";
import AppCalendar from "../components/AppCalendar";
import { useTrips } from "../hooks/useTrips";
import { usePreferencesStore } from "../state/stores/preferencesStore";
import { getTodayInTimeZone } from "../lib/datetime";
import { daysBetween, formatMoney, formatShortDate, summarizeTrip, type Trip } from "../lib/trips";

const CURRENCIES = [["USD", "דולר $"], ["EUR", "יורו €"], ["ILS", "שקל ₪"]] as const;

function countdown(trip: Trip, today: string): { text: string; cls: string } {
  const toStart = daysBetween(today, trip.start_date);
  if (toStart > 0) return { text: toStart === 1 ? "מחר!" : `בעוד ${toStart} ימים`, cls: "text-accent-400" };
  if (today <= trip.end_date) return { text: `יום ${daysBetween(trip.start_date, today) + 1} בטיול`, cls: "text-success" };
  return { text: "הסתיים", cls: "text-theme-muted" };
}

function NewTripSheet({ onClose, onCreate }: { onClose: () => void; onCreate: (t: Pick<Trip, "name" | "start_date" | "end_date" | "currency"> & { destination: string | null }) => void }) {
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [currency, setCurrency] = useState("USD");
  const valid = name.trim() && start && end && end >= start;
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form
        onSubmit={(e) => { e.preventDefault(); if (valid) onCreate({ name: name.trim(), destination: destination.trim() || null, start_date: start, end_date: end, currency }); }}
        className="modal-panel bg-slate-900 border-slate-700 sm:max-w-md space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-theme">טיול חדש</h3>
          <button type="button" onClick={onClose} className="-m-2 p-2 rounded-lg text-theme-muted hover:text-theme" aria-label="סגור"><Icon name="x" className="w-5 h-5" /></button>
        </div>
        <div>
          <label className="text-xs text-theme-muted block mb-1">שם הטיול *</label>
          <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} className="input-base w-full" placeholder="טיול למקסיקו" />
        </div>
        <div>
          <label className="text-xs text-theme-muted block mb-1">יעד</label>
          <input value={destination} onChange={(e) => setDestination(e.target.value)} className="input-base w-full" placeholder="קנקון, טולום, הולבוש" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <AppCalendar label="יציאה *" value={start} onChange={setStart} placeholder="תאריך" />
          <AppCalendar label="חזרה *" value={end} onChange={setEnd} placeholder="תאריך" />
        </div>
        {start && end && end < start && <p className="text-xs text-danger">תאריך החזרה לפני היציאה</p>}
        <div>
          <label className="text-xs text-theme-muted block mb-1">מטבע</label>
          <div className="grid grid-cols-3 gap-2">
            {CURRENCIES.map(([c, label]) => (
              <button key={c} type="button" onClick={() => setCurrency(c)}
                className={"py-2.5 sm:py-2 rounded-lg text-sm border transition-colors " + (currency === c ? "bg-accent-600 border-accent-600 text-white" : "border-slate-700 text-theme-muted hover:text-theme")}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <button type="submit" disabled={!valid} className="w-full bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white font-medium py-3 sm:py-2.5 rounded-xl sm:rounded-lg text-sm">
          צור טיול
        </button>
      </form>
    </div>
  );
}

export default function Trips() {
  const navigate = useNavigate();
  const timeZone = usePreferencesStore((s) => s.timeZone);
  const today = getTodayInTimeZone(timeZone);
  const { data: trips = [], isLoading, allItems, createTrip } = useTrips();
  const [showNew, setShowNew] = useState(false);

  const { upcoming, past } = useMemo(() => ({
    upcoming: trips.filter((t) => t.end_date >= today),
    past: trips.filter((t) => t.end_date < today).reverse(),
  }), [trips, today]);

  const TripCard = ({ trip }: { trip: Trip }) => {
    const items = allItems.filter((i) => i.trip_id === trip.id);
    const s = summarizeTrip(items, today);
    const cd = countdown(trip, today);
    const nights = daysBetween(trip.start_date, trip.end_date);
    return (
      <button type="button" onClick={() => navigate(`/trips/${trip.id}`)}
        className="w-full text-right rounded-2xl border border-slate-800 bg-slate-900 p-4 hover:bg-slate-800/50 transition-colors">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-accent-950/40 border border-accent-800 flex items-center justify-center shrink-0">
            <Icon name="plane" className="w-5 h-5 text-accent-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold text-theme truncate">{trip.name}</h3>
              <span className={"text-xs font-medium shrink-0 " + cd.cls}>{cd.text}</span>
            </div>
            <p className="text-xs text-theme-muted mt-0.5 truncate">
              {formatShortDate(trip.start_date)} – {formatShortDate(trip.end_date)} · {nights} לילות{trip.destination ? ` · ${trip.destination}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
              {s.plannedTotal > 0 && <span className="text-theme font-medium">{formatMoney(s.plannedTotal, trip.currency)}</span>}
              {s.todos.length > 0 && <span className="text-warning">{s.todos.length} לטפל</span>}
              {s.optionsCount > 0 && <span className="text-theme-muted">{s.optionsCount} אפשרויות</span>}
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-theme">טיולים</h2>
          <p className="text-theme-muted text-sm mt-0.5">תכנון יום-יום: טיסות, לינות, הזמנות ופעילויות אופציונליות.</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="hidden md:flex text-sm font-medium px-4 py-2 rounded-lg bg-accent-600 hover:bg-accent-500 text-white items-center gap-1.5">
          <Icon name="plus" className="w-4 h-4" /> טיול חדש
        </button>
      </div>

      {!isLoading && trips.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-700 py-12 px-4 text-center">
          <Icon name="plane" className="w-10 h-10 mx-auto text-slate-500 mb-3" />
          <p className="text-sm text-theme mb-1">עוד אין טיולים</p>
          <p className="text-xs text-theme-muted mb-4">צור טיול, הוסף טיסות ולינות, ולכל יום רשימת פעילויות אופציונליות.</p>
          <button onClick={() => setShowNew(true)} className="px-4 py-2.5 rounded-lg bg-accent-600 text-white text-sm">טיול חדש</button>
        </div>
      )}

      <div className="space-y-3">
        {upcoming.map((t) => <TripCard key={t.id} trip={t} />)}
      </div>
      {past.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-theme-muted mt-6 mb-2">טיולים קודמים</h3>
          <div className="space-y-3 opacity-80">{past.map((t) => <TripCard key={t.id} trip={t} />)}</div>
        </>
      )}

      <div className="h-20 md:hidden" aria-hidden="true" />
      <Fab label="טיול" onClick={() => setShowNew(true)} />

      {showNew && (
        <NewTripSheet
          onClose={() => setShowNew(false)}
          onCreate={(trip) => createTrip.mutate(trip, { onSuccess: (t) => { setShowNew(false); navigate(`/trips/${t.id}`); } })}
        />
      )}
    </div>
  );
}
