// Builds the daily WhatsApp summary. Pure functions (no I/O) so it can be tested locally.
// Files starting with "_" in api/ are not deployed as endpoints by Vercel.

export interface DigestTask {
  title: string;
  status: string;
  module: string;
  due_at: string | null;
  scheduled_start_at: string | null;
  assigned_to: string | null;
}
export interface DigestEvent {
  title: string;
  starts_at: string;
  location: string | null;
  provider_name: string | null;
  status: string;
}
export interface DigestStockItem {
  name: string;
  quantity: number | string;
  critical_threshold: number | string;
  unit: string;
}
export interface DigestInput {
  now: Date;
  timeZone: string;
  tasks: DigestTask[];
  events: DigestEvent[];
  inventory: DigestStockItem[];
  members: Record<string, string>; // user id → display name
}

/** YYYY-MM-DD of an instant in the given time zone */
export function localDate(at: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
}

/** Hour (0–23) of an instant in the given time zone */
export function localHour(at: Date, timeZone: string): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hour12: false }).format(at)) % 24;
}

const hhmm = (at: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(at));
const ddmm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
const addDay = (iso: string) => new Date(Date.parse(iso + "T12:00:00Z") + 86_400_000).toISOString().slice(0, 10);

const OPEN = (t: DigestTask) => t.status !== "done" && t.status !== "cancelled";
// Shopping tasks are covered by the shopping list section
const EVERYDAY = (t: DigestTask) => t.module !== "inventory";
const when = (t: DigestTask) => t.scheduled_start_at ?? t.due_at;

export function buildDigest(input: DigestInput): string {
  const { now, timeZone, members } = input;
  const today = localDate(now, timeZone);
  const tomorrow = addDay(today);
  const weekday = (iso: string) =>
    new Intl.DateTimeFormat("he-IL", { timeZone: "UTC", weekday: "long" }).format(new Date(iso + "T12:00:00Z"));

  const tasks = input.tasks.filter((t) => OPEN(t) && EVERYDAY(t) && when(t));
  const onDay = (day: string) => tasks
    .filter((t) => localDate(when(t)!, timeZone) === day)
    .sort((a, b) => when(a)!.localeCompare(when(b)!));
  const overdue = tasks
    .filter((t) => localDate(when(t)!, timeZone) < today)
    .sort((a, b) => when(a)!.localeCompare(when(b)!));
  const events = input.events.filter((e) => e.status !== "cancelled");
  const eventsOn = (day: string) => events
    .filter((e) => localDate(e.starts_at, timeZone) === day)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const shopping = input.inventory
    .filter((i) => Number(i.quantity) < Number(i.critical_threshold))
    .map((i) => i.name);

  const taskLine = (t: DigestTask) => {
    const time = t.scheduled_start_at ? `${hhmm(t.scheduled_start_at, timeZone)} ` : "";
    const who = t.assigned_to && members[t.assigned_to] ? ` — ${members[t.assigned_to]}` : "";
    return `• ${time}${t.title}${who}`;
  };
  const eventLine = (e: DigestEvent) => {
    const extra = [e.provider_name, e.location].filter(Boolean).join(", ");
    return `• ${hhmm(e.starts_at, timeZone)} ${e.title}${extra ? ` (${extra})` : ""}`;
  };

  const sections: string[] = [];
  const todayEvents = eventsOn(today);
  const todayTasks = onDay(today);
  if (todayEvents.length) sections.push(["📅 *אירועים היום*", ...todayEvents.map(eventLine)].join("\n"));
  if (todayTasks.length) sections.push(["✅ *משימות להיום*", ...todayTasks.map(taskLine)].join("\n"));
  if (overdue.length) {
    sections.push(["⚠️ *באיחור*", ...overdue.slice(0, 8).map((t) => `${taskLine(t)} (מ-${ddmm(localDate(when(t)!, timeZone))})`),
      ...(overdue.length > 8 ? [`ועוד ${overdue.length - 8}...`] : [])].join("\n"));
  }
  if (shopping.length) sections.push(`🛒 *לקנות*\n${shopping.join(", ")}`);

  const tomorrowLines = [...eventsOn(tomorrow).map(eventLine), ...onDay(tomorrow).map(taskLine)];
  if (tomorrowLines.length) sections.push([`🔜 *מחר (${weekday(tomorrow)})*`, ...tomorrowLines].join("\n"));

  const header = `☀️ *בוקר טוב! ${weekday(today)} ${ddmm(today)}*`;
  if (!sections.length) return `${header}\n\nאין משימות או אירועים להיום, והמלאי מלא. יום נעים! 🎉`;
  return [header, ...sections].join("\n\n");
}
