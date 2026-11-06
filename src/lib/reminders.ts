// WhatsApp reminder presets for tasks and events, computed in the household time zone.
import { utcIsoToDateInput, utcIsoToDateTimeInput, zonedDateTimeToUtcIso } from "./datetime";

export type ReminderPreset = "none" | "at_time" | "15_before" | "hour_before" | "morning_of" | "evening_before" | "custom";

export interface ReminderValue {
  preset: ReminderPreset;
  /** Local "YYYY-MM-DDTHH:mm" for the custom preset */
  custom: string;
}

export const REMINDER_LABELS: Record<ReminderPreset, string> = {
  none: "ללא",
  at_time: "בזמן",
  "15_before": "15 דק' לפני",
  hour_before: "שעה לפני",
  morning_of: "בבוקר (08:00)",
  evening_before: "ערב לפני (20:00)",
  custom: "מותאם…",
};

/** Date-only items are stored at local midnight, so "before the time" presets don't apply */
export function isDateOnly(itemIso: string | null, timeZone: string): boolean {
  return !itemIso || utcIsoToDateTimeInput(itemIso, timeZone).endsWith("T00:00");
}

export function reminderPresets(itemIso: string | null, timeZone: string): ReminderPreset[] {
  if (!itemIso) return ["none", "custom"];
  return isDateOnly(itemIso, timeZone)
    ? ["none", "morning_of", "evening_before", "custom"]
    : ["none", "at_time", "15_before", "hour_before", "morning_of", "evening_before", "custom"];
}

const shiftDay = (date: string, days: number) =>
  new Date(Date.parse(date + "T12:00:00Z") + days * 86_400_000).toISOString().slice(0, 10);

/** UTC ISO of when the reminder should go out, or null for none / invalid */
export function computeRemindAt(value: ReminderValue, itemIso: string | null, timeZone: string): string | null {
  if (value.preset === "none") return null;
  if (value.preset === "custom") return value.custom ? zonedDateTimeToUtcIso(value.custom, timeZone) : null;
  if (!itemIso) return null;
  const at = Date.parse(itemIso);
  const day = utcIsoToDateInput(itemIso, timeZone);
  switch (value.preset) {
    case "at_time": return new Date(at).toISOString();
    case "15_before": return new Date(at - 15 * 60_000).toISOString();
    case "hour_before": return new Date(at - 60 * 60_000).toISOString();
    case "morning_of": return zonedDateTimeToUtcIso(`${day}T08:00`, timeZone);
    case "evening_before": return zonedDateTimeToUtcIso(`${shiftDay(day, -1)}T20:00`, timeZone);
  }
}

/** Initial picker state from a saved row */
export function reminderFromRow(row: { whatsapp_remind?: string | null; whatsapp_remind_at?: string | null }, timeZone: string): ReminderValue {
  const preset = (row.whatsapp_remind as ReminderPreset | null) ?? "none";
  return {
    preset,
    custom: preset === "custom" && row.whatsapp_remind_at ? utcIsoToDateTimeInput(row.whatsapp_remind_at, timeZone) : "",
  };
}

/** Columns to save; re-arms the reminder only when its time actually changed */
export function reminderColumns(value: ReminderValue, itemIso: string | null, timeZone: string, previousRemindAt?: string | null) {
  const remindAt = computeRemindAt(value, itemIso, timeZone);
  const changed = (remindAt ?? null) !== (previousRemindAt ?? null);
  return {
    whatsapp_remind: value.preset === "none" ? null : value.preset,
    whatsapp_remind_at: remindAt,
    ...(changed ? { whatsapp_reminded_at: null } : {}),
  };
}
