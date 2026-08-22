import { DEFAULT_TIMEZONE } from "../state/stores/preferencesStore";

function two(n: number): string {
  return String(n).padStart(2, "0");
}

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getZonedParts(date: Date, timeZone: string): DateParts {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

export function getNowInTimeZoneInput(timeZone = DEFAULT_TIMEZONE): string {
  const p = getZonedParts(new Date(), timeZone);
  return `${p.year}-${two(p.month)}-${two(p.day)}T${two(p.hour)}:${two(p.minute)}`;
}

export function getTodayInTimeZone(timeZone = DEFAULT_TIMEZONE): string {
  const p = getZonedParts(new Date(), timeZone);
  return `${p.year}-${two(p.month)}-${two(p.day)}`;
}

export function dateToIsoInTimeZone(date: Date, timeZone = DEFAULT_TIMEZONE): string {
  const p = getZonedParts(date, timeZone);
  return `${p.year}-${two(p.month)}-${two(p.day)}`;
}

export function utcIsoToDateTimeInput(iso: string, timeZone = DEFAULT_TIMEZONE): string {
  const p = getZonedParts(new Date(iso), timeZone);
  return `${p.year}-${two(p.month)}-${two(p.day)}T${two(p.hour)}:${two(p.minute)}`;
}

export function utcIsoToDateInput(iso: string, timeZone = DEFAULT_TIMEZONE): string {
  const p = getZonedParts(new Date(iso), timeZone);
  return `${p.year}-${two(p.month)}-${two(p.day)}`;
}

export function zonedDateTimeToUtcIso(input: string, timeZone = DEFAULT_TIMEZONE): string {
  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error("Invalid datetime input format");
  }
  const [, ys, ms, ds, hs, mins] = match;
  const year = Number(ys);
  const month = Number(ms);
  const day = Number(ds);
  const hour = Number(hs);
  const minute = Number(mins);

  let guessMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const desiredMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let i = 0; i < 3; i++) {
    const p = getZonedParts(new Date(guessMs), timeZone);
    const seenMs = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
    const deltaMs = desiredMs - seenMs;
    if (deltaMs === 0) break;
    guessMs += deltaMs;
  }

  return new Date(guessMs).toISOString();
}

export function formatInTimeZone(
  value: string | Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
  locale = "he-IL"
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString(locale, { ...options, timeZone });
}


