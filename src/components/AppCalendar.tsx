import { useState, useRef, useEffect } from "react";
import Icon from "./Icon";
import { usePreferencesStore } from "../state/stores/preferencesStore";
import {
  getNowInTimeZoneInput,
  getTodayInTimeZone,
  utcIsoToDateTimeInput,
  formatInTimeZone,
} from "../lib/datetime";
const MONTH_NAMES = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
const DAY_NAMES = ["א","ב","ג","ד","ה","ו","ש"];

interface AppCalendarProps {
  value: string;
  onChange: (val: string) => void;
  mode?: "date" | "datetime";
  placeholder?: string;
  label?: string;
  className?: string;
  inline?: boolean;
}

export default function AppCalendar({
  value, onChange, mode = "date", placeholder, label, className, inline = false
}: AppCalendarProps) {
  const timeZone = usePreferencesStore((s) => s.timeZone);
  const [open, setOpen] = useState(inline);
  const ref = useRef<HTMLDivElement>(null);
  const normalizedValue = mode === "datetime" && /Z$|[+-]\d{2}:\d{2}$/.test(value)
    ? utcIsoToDateTimeInput(value, timeZone)
    : value;
  const selectedDate = normalizedValue ? normalizedValue.slice(0, 10) : "";
  const [view, setView] = useState(() => {
    const d = selectedDate ? new Date(selectedDate + "T12:00:00") : new Date(getNowInTimeZoneInput(timeZone));
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [time, setTime] = useState(
    normalizedValue && normalizedValue.includes("T") ? normalizedValue.slice(11, 16) : "09:00"
  );
  const today = getTodayInTimeZone(timeZone);

  useEffect(() => {
    if (inline) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [inline]);

  useEffect(() => {
    if (normalizedValue && normalizedValue.includes("T")) setTime(normalizedValue.slice(11, 16));
  }, [normalizedValue]);

  useEffect(() => {
    if (selectedDate) {
      const d = new Date(selectedDate + "T12:00:00");
      setView({ year: d.getFullYear(), month: d.getMonth() });
    }
  }, [selectedDate]);

  const prevMonth = () => setView(v =>
    v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 }
  );
  const nextMonth = () => setView(v =>
    v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 }
  );
  const selectDay = (day: number) => {
    const m = String(view.month + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    const ds = view.year + "-" + m + "-" + d;
    if (mode === "datetime") {
      onChange(ds + "T" + time);
      if (!inline) setOpen(false);
    } else {
      onChange(ds);
      if (!inline) setOpen(false);
    }
  };
  const handleTimeChange = (newTime: string) => {
    setTime(newTime);
    if (selectedDate) onChange(selectedDate + "T" + newTime);
  };
  const goToday = () => {
    const now = new Date(getNowInTimeZoneInput(timeZone));
    setView({ year: now.getFullYear(), month: now.getMonth() });
    if (mode === "datetime") {
      onChange(getNowInTimeZoneInput(timeZone));
      if (!inline) setOpen(false);
    } else {
      onChange(today);
      if (!inline) setOpen(false);
    }
  };

  const firstDow = new Date(view.year, view.month, 1).getDay();
  const lastDate = new Date(view.year, view.month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) days.push(null);
  for (let d = 1; d <= lastDate; d++) days.push(d);

  const displayValue = selectedDate
    ? (mode === "datetime" && normalizedValue.includes("T")
        ? formatInTimeZone(normalizedValue, timeZone, {
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit",
          })
        : formatInTimeZone(selectedDate + "T12:00:00", timeZone, {
            year: "numeric", month: "2-digit", day: "2-digit",
          }))
    : "";

  const Panel = () => (
    <div
      className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 w-72"
      dir="rtl"
      style={{ minWidth: "272px" }}
    >
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth}
          className="text-theme-muted hover:text-theme p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
          <Icon name="chevron-right" className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-theme">
            {MONTH_NAMES[view.month]} {view.year}
          </span>
        </div>
        <button type="button" onClick={nextMonth}
          className="text-theme-muted hover:text-theme p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
          <Icon name="chevron-left" className="w-4 h-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-[10px] text-theme-muted py-1 font-medium">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, i) => {
          if (day === null) return <div key={i} />;
          const mm = String(view.month + 1).padStart(2, "0");
          const dd = String(day).padStart(2, "0");
          const iso = view.year + "-" + mm + "-" + dd;
          const isSel = iso === selectedDate;
          const isTod = iso === today;
          return (
            <button key={i} type="button" onClick={() => selectDay(day)}
              className={
                "text-xs py-1.5 rounded-lg transition-colors text-center font-medium " +
                (isSel
                  ? "bg-accent-600 text-white"
                  : isTod
                  ? "border border-accent-500 text-accent-400 hover:bg-slate-800"
                  : "text-theme hover:bg-slate-800")
              }>
              {day}
            </button>
          );
        })}
      </div>

      {/* Today button */}
      <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between">
        <button type="button" onClick={goToday}
          className="text-xs text-accent-400 hover:text-accent-300 font-medium transition-colors">
          היום
        </button>
        {selectedDate && (
          <span className="text-[10px] text-theme-muted">
            {formatInTimeZone(selectedDate + "T12:00:00", timeZone, { weekday: "long", day: "numeric", month: "long" })}
          </span>
        )}
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className={className}>
        {label && <label className="text-xs text-theme-muted block mb-1">{label}</label>}
        <Panel />
        {mode === "datetime" && (
          <div className="mt-2">
            <label className="text-xs text-theme-muted block mb-1">שעה</label>
            <input
              type="time"
              value={time}
              onChange={e => handleTimeChange(e.target.value)}
              className="input-base w-full text-sm py-1.5"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className={"relative " + (className ?? "")}>
      {label && <label className="text-xs text-theme-muted block mb-1">{label}</label>}
      <button type="button" onClick={() => setOpen(prev => !prev)}
        className="input-base w-full flex items-center justify-between gap-2 text-sm">
        <span className={displayValue ? "text-theme" : "text-slate-500"}>
          {displayValue || placeholder || "בחר תאריך"}
        </span>
        <Icon name="calendar" className="w-4 h-4 text-theme-muted shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full mt-1.5 z-[60] start-0 max-w-[calc(100vw-2rem)]">
          <Panel />
        </div>
      )}
      {mode === "datetime" && (
        <div className="mt-2">
          <label className="text-xs text-theme-muted block mb-1">שעה</label>
          <input
            type="time"
            value={time}
            onChange={e => handleTimeChange(e.target.value)}
            className="input-base w-full text-sm py-1.5"
          />
        </div>
      )}
    </div>
  );
}
