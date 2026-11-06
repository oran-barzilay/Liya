import Icon from "./Icon";
import AppCalendar from "./AppCalendar";
import { REMINDER_LABELS, computeRemindAt, reminderPresets, type ReminderValue } from "../lib/reminders";
import { formatInTimeZone } from "../lib/datetime";

/** "Remind the WhatsApp group" picker used in task and event forms */
export default function ReminderPicker({ value, onChange, itemIso, timeZone }: {
  value: ReminderValue;
  onChange: (v: ReminderValue) => void;
  /** The task/event time (UTC ISO), or null when no date is set yet */
  itemIso: string | null;
  timeZone: string;
}) {
  const presets = reminderPresets(itemIso, timeZone);
  // Keep a preset that no longer fits (e.g. date became date-only) visible but switchable
  const options = presets.includes(value.preset) ? presets : [...presets, value.preset];
  const remindAt = computeRemindAt(value, itemIso, timeZone);
  // The server sends up to 2 hours late, then gives up
  const lateMin = remindAt ? (Date.now() - Date.parse(remindAt)) / 60_000 : 0;

  return (
    <div>
      <label className="text-xs text-theme-muted mb-1.5 flex items-center gap-1.5">
        <Icon name="chat" className="w-3.5 h-3.5" /> תזכורת לקבוצת הוואטסאפ
      </label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((p) => (
          <button key={p} type="button" onClick={() => onChange({ ...value, preset: p })}
            className={"px-2.5 py-2 sm:py-1.5 rounded-lg text-xs font-medium border transition-colors " +
              (value.preset === p ? "bg-accent-600 border-accent-600 text-white" : "border-slate-700 text-theme-muted hover:text-theme")}>
            {REMINDER_LABELS[p]}
          </button>
        ))}
      </div>
      {value.preset === "custom" && (
        <div className="mt-2">
          <AppCalendar mode="datetime" value={value.custom} onChange={(v) => onChange({ ...value, custom: v })} placeholder="מתי לשלוח" />
        </div>
      )}
      {remindAt && (
        <p className={"text-xs mt-1.5 " + (lateMin >= 120 ? "text-warning" : "text-theme-muted")}>
          {lateMin >= 120 ? "הזמן הזה כבר עבר — התזכורת לא תישלח" : lateMin > 0 ? "תישלח בדקות הקרובות" : `תישלח ${formatInTimeZone(remindAt, timeZone, { weekday: "long", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}`}
        </p>
      )}
    </div>
  );
}
