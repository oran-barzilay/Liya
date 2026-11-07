// Builds the daily WhatsApp summary. Pure functions (no I/O) so it can be tested locally.
// Files starting with "_" in api/ are not deployed as endpoints by Vercel.

export interface DigestTask {
  id?: string;
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
  id?: string;
  name: string;
  quantity: number | string;
  critical_threshold: number | string;
  unit: string;
}
export type DigestSection = "events" | "today" | "overdue" | "shopping" | "tomorrow";
export type WeeklySection = "events" | "tasks" | "overdue" | "shopping";

export interface DigestInput {
  now: Date;
  /** Sections to include (all when omitted) */
  sections?: Partial<Record<DigestSection, boolean>>;
  /** Replaces the time-of-day greeting in the header */
  greeting?: string | null;
  timeZone: string;
  tasks: DigestTask[];
  events: DigestEvent[];
  inventory: DigestStockItem[];
  members: Record<string, string>; // user id → display name
  /** App address; when set, tasks get a tap-to-open link and long lists are trimmed */
  site?: string | null;
}

/** Lists in WhatsApp show at most this many items, then a link to the full list */
export const LIST_LIMIT = 5;

/** Deep links into the app (see the /t and /b routes in src/App.tsx) */
export const links = {
  task: (site: string, id: string) => `${site}/t/${id}`,
  buy: (site: string, itemId: string) => `${site}/b/${itemId}`,
  tasks: (site: string) => `${site}/tasks`,
  shopping: (site: string) => `${site}/tasks?scope=shopping`,
};

/** First LIST_LIMIT lines, then "ועוד N" with a link to the full list */
function capped(lines: string[], moreLink: string | null): string[] {
  if (!moreLink || lines.length <= LIST_LIMIT) return lines;
  return [...lines.slice(0, LIST_LIMIT), `ועוד ${lines.length - LIST_LIMIT} — הרשימה המלאה:`, moreLink];
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
const weekdayName = (iso: string) =>
  new Intl.DateTimeFormat("he-IL", { timeZone: "UTC", weekday: "long" }).format(new Date(iso + "T12:00:00Z"));

/** Shared building blocks for the daily and weekly summaries */
function prepare(input: Omit<DigestInput, "sections" | "greeting">) {
  const { timeZone, members } = input;
  const site = input.site || null;
  const today = localDate(input.now, timeZone);
  const tasks = input.tasks.filter((t) => OPEN(t) && EVERYDAY(t) && when(t));
  const events = input.events.filter((e) => e.status !== "cancelled");
  const taskLine = (t: DigestTask) => {
    // Date-only tasks are stored at local midnight: no time prefix
    const time = t.scheduled_start_at && hhmm(t.scheduled_start_at, timeZone) !== "00:00" ? `${hhmm(t.scheduled_start_at, timeZone)} ` : "";
    const who = t.assigned_to && members[t.assigned_to] ? ` — ${members[t.assigned_to]}` : "";
    return `• ${time}${t.title}${who}${site && t.id ? `\n   ${links.task(site, t.id)}` : ""}`;
  };
  const shoppingItems = input.inventory.filter((i) => Number(i.quantity) < Number(i.critical_threshold));
  return {
    today,
    site,
    tasksOn: (day: string) => tasks
      .filter((t) => localDate(when(t)!, timeZone) === day)
      .sort((a, b) => when(a)!.localeCompare(when(b)!)),
    eventsOn: (day: string) => events
      .filter((e) => localDate(e.starts_at, timeZone) === day)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    overdue: tasks
      .filter((t) => localDate(when(t)!, timeZone) < today)
      .sort((a, b) => when(a)!.localeCompare(when(b)!)),
    shopping: shoppingItems.map((i) => i.name),
    taskLine,
    eventLine: (e: DigestEvent) => {
      const extra = [e.provider_name, e.location].filter(Boolean).join(", ");
      return `• ${hhmm(e.starts_at, timeZone)} ${e.title}${extra ? ` (${extra})` : ""}`;
    },
    /** A task section: header + (capped) task lines */
    taskSection: (header: string, list: DigestTask[], suffix?: (t: DigestTask) => string) =>
      [header, ...capped(list.map((t) => suffix ? taskLine(t).replace(/^(• [^\n]*)/, `$1${suffix(t)}`) : taskLine(t)),
        site ? links.tasks(site) : null)].join("\n"),
    /** Compact shopping section: names (capped) + link to the full list */
    shoppingSection: () => {
      const names = shoppingItems.map((i) => i.name);
      if (!site || names.length <= LIST_LIMIT) return `🛒 *לקנות*\n${names.join(", ")}`;
      return `🛒 *לקנות*\n${names.slice(0, LIST_LIMIT).join(", ")} ועוד ${names.length - LIST_LIMIT}\nהרשימה המלאה: ${links.shopping(site)}`;
    },
  };
}

const sinceSuffix = (timeZone: string) => (t: DigestTask) => ` (מ-${ddmm(localDate(when(t)!, timeZone))})`;

export function buildDigest(input: DigestInput): string {
  const { now, timeZone } = input;
  const on = (s: DigestSection) => input.sections?.[s] !== false;
  const p = prepare(input);
  const tomorrow = addDay(p.today);

  const sections: string[] = [];
  const todayEvents = p.eventsOn(p.today);
  const todayTasks = p.tasksOn(p.today);
  if (on("events") && todayEvents.length) sections.push(["📅 *אירועים היום*", ...todayEvents.map(p.eventLine)].join("\n"));
  if (on("today") && todayTasks.length) sections.push(p.taskSection("✅ *משימות להיום*", todayTasks));
  if (on("overdue") && p.overdue.length) sections.push(p.taskSection("⚠️ *באיחור*", p.overdue, sinceSuffix(timeZone)));
  if (on("shopping") && p.shopping.length) sections.push(p.shoppingSection());

  const tomorrowLines = [...p.eventsOn(tomorrow).map(p.eventLine), ...p.tasksOn(tomorrow).map(p.taskLine)];
  if (on("tomorrow") && tomorrowLines.length) sections.push([`🔜 *מחר (${weekdayName(tomorrow)})*`, ...tomorrowLines].join("\n"));

  const hour = localHour(now, timeZone);
  const [icon, hello] = hour < 12 ? ["☀️", "בוקר טוב!"] : hour < 17 ? ["🌤️", "צהריים טובים!"] : ["🌙", "ערב טוב!"];
  const header = `${icon} *${input.greeting?.trim() || hello} ${weekdayName(p.today)} ${ddmm(p.today)}*`;
  if (!sections.length) return `${header}\n\nאין משהו מיוחד על הלוח. יום נעים! 🎉`;
  return [header, ...sections].join("\n\n");
}

export interface WeeklyInput extends Omit<DigestInput, "sections"> {
  sections?: Partial<Record<WeeklySection, boolean>>;
}

/**
 * The coming week, day by day. Sent in the afternoon/evening it covers the 7 days
 * starting tomorrow (e.g. Saturday night → Sunday–Saturday); sent earlier, it starts today.
 */
export function buildWeekly(input: WeeklyInput): string {
  const on = (s: WeeklySection) => input.sections?.[s] !== false;
  const p = prepare(input);
  const first = localHour(input.now, input.timeZone) >= 15 ? addDay(p.today) : p.today;
  const days = [first];
  while (days.length < 7) days.push(addDay(days[days.length - 1]));

  const dayBlocks = days.flatMap((day) => {
    const lines = [
      ...(on("events") ? p.eventsOn(day).map(p.eventLine) : []),
      ...(on("tasks") ? p.tasksOn(day).map(p.taskLine) : []),
    ];
    return lines.length ? [[`*${weekdayName(day)} ${ddmm(day)}*`, ...lines].join("\n")] : [];
  });

  const sections: string[] = [];
  if (on("events") || on("tasks")) sections.push(dayBlocks.length ? dayBlocks.join("\n\n") : "השבוע פנוי — אין אירועים או משימות מתוכננים 🌴");
  if (on("overdue") && p.overdue.length) sections.push(p.taskSection("⚠️ *באיחור*", p.overdue, sinceSuffix(input.timeZone)));
  if (on("shopping") && p.shopping.length) sections.push(p.shoppingSection());

  const header = `🗓️ *${input.greeting?.trim() || "השבוע הקרוב"} · ${ddmm(days[0])}–${ddmm(days[6])}*`;
  return [header, ...sections].join("\n\n");
}

/** A dedicated reminder for one task or event */
export function buildReminder(item: { title: string; at: string | null; kind: "task" | "event"; location?: string | null; who?: string | null; link?: string | null }, timeZone: string): string {
  // Date-only tasks are stored at local midnight: show just the day
  const time = item.at ? hhmm(item.at, timeZone) : null;
  const day = item.at ? localDate(item.at, timeZone) : null;
  const when = day
    ? `${day === localDate(new Date(), timeZone) ? "היום" : ddmm(day)}${time && time !== "00:00" ? ` ב-${time}` : ""}`
    : "";
  const lines = [
    `⏰ *תזכורת: ${item.title}*`,
    when ? `${item.kind === "event" ? "📅" : "🗓️"} ${when}` : null,
    item.location ? `📍 ${item.location}` : null,
    item.who ? `👤 ${item.who}` : null,
    item.link ? `לסימון / עדכון: ${item.link}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

/** "What do we need to buy?" — each item links to its "how much did you buy?" sheet */
export function renderShoppingList(inventory: DigestStockItem[], site: string | null): string {
  const items = inventory.filter((i) => Number(i.quantity) < Number(i.critical_threshold));
  if (!items.length) return "🎉 רשימת הקניות ריקה — יש הכל בבית";
  const lines = items.map((i) => {
    const need = Number(i.critical_threshold) - Number(i.quantity);
    return `• ${i.name} (חסר ${need} ${i.unit})${site && i.id ? `\n   ${links.buy(site, i.id)}` : ""}`;
  });
  return ["🛒 *רשימת הקניות*", ...capped(lines, site ? links.shopping(site) : null)].join("\n");
}

/** "Which tasks…?" — each task links to its page in the app */
export function renderTaskList(title: string, tasks: DigestTask[], members: Record<string, string>, timeZone: string, site: string | null): string {
  if (!tasks.length) return `${title}\nאין משימות 🎉`;
  const p = prepare({ now: new Date(), timeZone, tasks: [], events: [], inventory: [], members, site });
  const lines = tasks.map((t) => {
    const at = when(t);
    const date = at && localDate(at, timeZone) !== p.today ? ` (${ddmm(localDate(at, timeZone))})` : "";
    return p.taskLine(t).replace(/^(• [^\n]*)/, `$1${date}`);
  });
  return [title, ...capped(lines, site ? links.tasks(site) : null)].join("\n");
}
