// Recurring tasks: rule format, labels and next-occurrence math, in the household time zone.
// No browser/store imports — shared by the app and the server (api/_assistant.ts).
//
// recurrence_rule JSON:
//   weekly / biweekly: { "freq": "weekly" | "biweekly", "days": [0-6], "time": "HH:mm" }  (legacy rules have no freq)
//   monthly-based: { "freq": "monthly" | "bimonthly" | "quarterly" | "semiannual" | "yearly",
//                    "day": 1-31, "time": "HH:mm" }   — the month comes from the current occurrence

export type Frequency = "weekly" | "biweekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "yearly";

/** Weekday-based rules (pick days of the week) vs. day-of-month rules */
export const isWeekBased = (f: Frequency) => f === "weekly" || f === "biweekly";

export interface RecurrenceRule {
  freq: Frequency;
  days?: number[];
  day?: number;
  time: string;
}

export const FREQUENCIES: Frequency[] = ["weekly", "biweekly", "monthly", "bimonthly", "quarterly", "semiannual", "yearly"];

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  weekly: "שבועית",
  biweekly: "דו-שבועית",
  monthly: "חודשית",
  bimonthly: "דו-חודשית",
  quarterly: "רבעונית",
  semiannual: "חצי שנתית",
  yearly: "שנתית",
};

const MONTHS_BETWEEN: Record<Exclude<Frequency, "weekly" | "biweekly">, number> = {
  monthly: 1, bimonthly: 2, quarterly: 3, semiannual: 6, yearly: 12,
};

export function parseRule(json: string | null | undefined): RecurrenceRule | null {
  if (!json) return null;
  try {
    const r = JSON.parse(json) as Partial<RecurrenceRule>;
    const freq = (FREQUENCIES as string[]).includes(String(r.freq)) ? (r.freq as Frequency) : "weekly";
    return { freq, days: r.days ?? [], day: r.day, time: r.time || "09:00" };
  } catch {
    return null;
  }
}

/** "כל שבוע · א׳ ג׳" / "כל 3 חודשים · ב-15" / "כל שנה · ב-15.03" */
export function describeRule(rule: RecurrenceRule, anchorDate?: string | null): string {
  if (isWeekBased(rule.freq)) {
    const letters = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
    const every = rule.freq === "biweekly" ? "כל שבועיים" : "כל שבוע";
    return `${every}${rule.days?.length ? ` · ${[...rule.days].sort().map((d) => letters[d]).join(" ")}` : ""}`;
  }
  const months = MONTHS_BETWEEN[rule.freq];
  const every = months === 1 ? "כל חודש" : months === 12 ? "כל שנה" : `כל ${months} חודשים`;
  if (rule.freq === "yearly" && anchorDate) return `${every} · ב-${anchorDate.slice(8, 10)}.${anchorDate.slice(5, 7)}`;
  return rule.day ? `${every} · ב-${rule.day} לחודש` : every;
}

/* ─────────────── Time zone helpers ─────────────── */

function localParts(date: Date, timeZone: string) {
  const map = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  }).formatToParts(date).map((p) => [p.type, p.value]));
  return {
    y: +map.year, m: +map.month, d: +map.day, h: +map.hour % 24, min: +map.minute,
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(map.weekday),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Local "YYYY-MM-DD" (+ optional "HH:mm") in a time zone → UTC ISO */
export function zonedToUtc(date: string, time: string | null | undefined, timeZone: string): string | null {
  const dm = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dm) return null;
  const tm = (time ?? "").match(/^(\d{1,2}):(\d{2})$/);
  const [y, mo, d, h, mi] = [+dm[1], +dm[2], +dm[3], tm ? +tm[1] : 0, tm ? +tm[2] : 0];
  const desired = Date.UTC(y, mo - 1, d, h, mi);
  let guess = desired;
  for (let i = 0; i < 3; i++) {
    const p = localParts(new Date(guess), timeZone);
    const delta = desired - Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
    if (!delta) break;
    guess += delta;
  }
  return new Date(guess).toISOString();
}

/** Local "YYYY-MM-DD" of an instant */
export function localDateOf(at: Date | string, timeZone: string): string {
  const p = localParts(new Date(at), timeZone);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** Sunday-based week index of a local date (only differences between weeks matter) */
const weekNumber = (date: string) => {
  const days = Math.round(Date.parse(`${date}T12:00:00Z`) / 86_400_000);
  return Math.floor((days + 4) / 7); // 1970-01-01 was a Thursday → shift so weeks start on Sunday
};

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Same day-of-month `months` later; a 31st becomes the month's last day (e.g. 31.01 → 28.02) */
function addMonths(date: string, months: number, day: number): string {
  const [y, m] = [+date.slice(0, 4), +date.slice(5, 7)];
  const total = (m - 1) + months;
  const ny = y + Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(day, daysInMonth(ny, nm)))}`;
}

/**
 * When the task comes up next, strictly after `after` (UTC ISO).
 * `current` is the occurrence just completed — monthly-based rules step from it,
 * skipping ahead if it was completed very late, so the schedule never drifts.
 */
export function nextOccurrence(rule: RecurrenceRule, timeZone: string, after: Date, current?: string | null): string | null {
  if (isWeekBased(rule.freq)) {
    const days = rule.days ?? [];
    if (!days.length) return null;
    // Bi-weekly: only weeks (Sunday-based) an even number of weeks from the current occurrence's week
    const anchorWeek = weekNumber(current ? localDateOf(current, timeZone) : localDateOf(after, timeZone));
    for (let i = 0; i <= 14; i++) {
      const date = localDateOf(new Date(after.getTime() + i * 86_400_000), timeZone);
      const weekday = localParts(new Date(`${date}T12:00:00Z`), "UTC").weekday;
      const onWeek = rule.freq === "weekly" || (weekNumber(date) - anchorWeek) % 2 === 0;
      const at = zonedToUtc(date, rule.time, timeZone);
      if (onWeek && days.includes(weekday) && at && Date.parse(at) > after.getTime()) return at;
    }
    return null;
  }

  const step = MONTHS_BETWEEN[rule.freq];
  let date = current ? localDateOf(current, timeZone) : localDateOf(after, timeZone);
  const day = rule.day ?? +date.slice(8, 10);
  for (let guard = 0; guard < 600; guard++) {
    date = addMonths(date, step, day);
    const at = zonedToUtc(date, rule.time, timeZone);
    if (at && Date.parse(at) > after.getTime()) return at;
  }
  return null;
}
