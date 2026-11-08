import {
  buildDigest, buildReminder, buildWeekly, links, localDate,
  type DigestEvent, type DigestSection, type DigestStockItem, type DigestTask, type WeeklySection,
} from "./_digest";
import { askAssistant, executeActions, loadContext, makeDb, shoppingCompleteLine } from "./_assistant";

export const config = { runtime: "edge" };

/**
 * WhatsApp group messages via Green API.
 *
 * Scheduler — GET /api/whatsapp?tick=1 (CRON_SECRET as "Authorization: Bearer …" or ?secret=…).
 * Called every 5 minutes by Supabase pg_cron (plus a daily Vercel cron as backup). Each tick:
 *   • sends the daily summary once a day, at/after the configured time,
 *   • sends the weekly summary once a week, on the configured weekday and time,
 *   • sends recurring custom messages due today,
 *   • sends per-task / per-event reminders whose time has come.
 * Every send is "claimed" with a conditional update first, so overlapping ticks never double-send.
 * Items more than WINDOW_MIN late are skipped instead of flooding the group.
 *
 * Group commands — POST /api/whatsapp?hook=1 (Green API webhook, CRON_SECRET as token).
 * Messages in the family group that start with the trigger word (default "פאמי") go to the
 * household assistant, which can add / edit / delete / change status of tasks, shopping items
 * and events; the result is posted back as a reply. Our own API messages are ignored (no loops),
 * and each WhatsApp message id is processed once even if Green API retries the webhook.
 *
 * App actions — POST /api/whatsapp {action, ...} with the user's Supabase access token:
 *   status | groups | preview | send_summary | send_text | setup_webhook
 *
 * Env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET,
 *      GREEN_API_URL, GREEN_API_INSTANCE_ID, GREEN_API_TOKEN, WHATSAPP_GROUP_ID (optional default group)
 */

const WINDOW_MIN = 120;

type Settings = {
  household_id: string;
  enabled: boolean;
  group_id: string | null;
  group_name: string | null;
  daily_enabled: boolean;
  daily_time: string; // "HH:MM:SS"
  time_zone: string;
  sections: Partial<Record<DigestSection, boolean>>;
  greeting: string | null;
  last_daily_sent_on: string | null;
  weekly_enabled: boolean;
  weekly_day: number;
  weekly_time: string;
  weekly_sections: Partial<Record<WeeklySection, boolean>>;
  weekly_greeting: string | null;
  last_weekly_sent_on: string | null;
  assistant_enabled: boolean;
  assistant_trigger: string;
  purchase_detection: boolean;
  shopping_filter: "low" | "at_or_below" | "out";
  shopping_show_missing: boolean;
  tasks_filter: "all" | "high" | "assigned";
  tasks_show_assignee: boolean;
  events_show_details: boolean;
  activity_detection: boolean;
};
type Kind = "daily" | "weekly" | "custom" | "reminder" | "manual" | "assistant";
type CustomMessage = { id: string; text: string; weekdays: number[]; send_time: string; last_sent_on: string | null };

const env = (name: string) => process.env[name]?.trim() || undefined;
const json = (body: unknown, status = 200) => Response.json(body, { status });
const supabaseUrl = () => env("SUPABASE_URL") ?? env("VITE_SUPABASE_URL");
/** The app's public address, for tap-to-open links in messages */
const siteUrl = () => (env("SITE_URL") ?? env("VITE_SITE_URL"))?.replace(/\/$/, "") || null;

/** PostgREST call with the service-role key (server only) */
async function db<T = unknown>(path: string, init: { method?: string; body?: unknown; returning?: boolean } = {}): Promise<T> {
  const key = env("SUPABASE_SERVICE_ROLE_KEY")!;
  const res = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    method: init.method ?? "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(init.returning ? { Prefer: "return=representation" } : {}),
      ...(init.method === "POST" && !init.returning ? { Prefer: "return=minimal" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) throw new Error(`db ${path.split("?")[0]}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

function greenApi(method: string, body?: unknown) {
  const base = (env("GREEN_API_URL") ?? "https://api.green-api.com").replace(/\/$/, "");
  return fetch(`${base}/waInstance${env("GREEN_API_INSTANCE_ID")}/${method}/${env("GREEN_API_TOKEN")}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** Local date, weekday and minutes-since-midnight in a time zone */
function localClock(now: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(now).map((p) => [p.type, p.value])
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { date: localDate(now, timeZone), weekday, minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute) };
}
const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
/** True when `time` (HH:MM) has passed today, by less than the catch-up window */
const isDue = (time: string, nowMinutes: number) => {
  const late = nowMinutes - toMinutes(time);
  return late >= 0 && late < WINDOW_MIN;
};

async function send(householdId: string, groupId: string, kind: Kind, message: string, quotedMessageId?: string) {
  let ok = false;
  let error: string | null = null;
  try {
    const res = await greenApi("sendMessage", { chatId: groupId, message, ...(quotedMessageId ? { quotedMessageId } : {}) });
    ok = res.ok;
    if (!ok) error = `${res.status} ${(await res.text()).slice(0, 300)}`;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  await db("whatsapp_log", { method: "POST", body: { household_id: householdId, kind, message, ok, error } }).catch(() => {});
  return { ok, error };
}

type SummaryOverrides = { sections?: Record<string, boolean>; greeting?: string | null };

/** Builds the daily or weekly summary from the household's current data */
async function buildSummary(kind: "daily" | "weekly", s: Settings, now: Date, overrides: SummaryOverrides = {}) {
  const h = `household_id=eq.${s.household_id}`;
  const from = new Date(now.getTime() - 86_400_000).toISOString();
  const to = new Date(now.getTime() + (kind === "weekly" ? 9 : 3) * 86_400_000).toISOString();
  const [tasks, events, inventory, users] = await Promise.all([
    db<DigestTask[]>(`tasks?${h}&status=in.(todo,in_progress)&select=id,title,status,module,due_at,scheduled_start_at,assigned_to,priority_level,task_type`),
    db<DigestEvent[]>(`appointments?${h}&starts_at=gte.${from}&starts_at=lt.${to}&select=title,starts_at,location,provider_name,status`),
    db<DigestStockItem[]>(`inventory?${h}&select=id,name,quantity,critical_threshold,unit`),
    db<{ id: string; display_name: string }[]>(`users?${h}&select=id,display_name`),
  ]);
  const base = {
    now, timeZone: s.time_zone, tasks, events, inventory, site: siteUrl(),
    members: Object.fromEntries(users.map((u) => [u.id, u.display_name])),
    shoppingFilter: s.shopping_filter ?? "low", showMissing: !!s.shopping_show_missing,
    tasksFilter: s.tasks_filter ?? "all", showAssignee: s.tasks_show_assignee !== false, showEventDetails: s.events_show_details !== false,
  };
  return kind === "weekly"
    ? buildWeekly({ ...base, sections: overrides.sections ?? s.weekly_sections, greeting: overrides.greeting !== undefined ? overrides.greeting : s.weekly_greeting })
    : buildDigest({ ...base, sections: overrides.sections ?? s.sections, greeting: overrides.greeting !== undefined ? overrides.greeting : s.greeting });
}

/** Settings rows to process; bootstraps one from env for a single-household install */
async function loadAllSettings(): Promise<Settings[]> {
  const rows = await db<Settings[]>("whatsapp_settings?select=*");
  if (rows.length || !env("WHATSAPP_GROUP_ID")) return rows.filter((r) => r.enabled);
  const households = await db<{ id: string }[]>("households?select=id");
  if (households.length !== 1) return [];
  return db<Settings[]>("whatsapp_settings", {
    method: "POST", returning: true,
    body: { household_id: households[0].id, group_id: env("WHATSAPP_GROUP_ID") },
  });
}

async function tick(now: Date) {
  const report: Record<string, unknown>[] = [];
  for (const s of await loadAllSettings()) {
    const groupId = s.group_id ?? env("WHATSAPP_GROUP_ID");
    if (!groupId) continue;
    const clock = localClock(now, s.time_zone);
    const h = `household_id=eq.${s.household_id}`;
    const sent: string[] = [];

    // 1. Daily summary — claim today's slot before sending
    if (s.daily_enabled && isDue(s.daily_time, clock.minutes) && s.last_daily_sent_on !== clock.date) {
      const claimed = await db<unknown[]>(
        `whatsapp_settings?${h}&or=(last_daily_sent_on.is.null,last_daily_sent_on.neq.${clock.date})`,
        { method: "PATCH", body: { last_daily_sent_on: clock.date }, returning: true }
      );
      if (claimed.length) {
        await send(s.household_id, groupId, "daily", await buildSummary("daily", s, now));
        sent.push("daily");
      }
    }

    // 2. Weekly summary — on its weekday, once
    if (s.weekly_enabled && clock.weekday === s.weekly_day && isDue(s.weekly_time, clock.minutes) && s.last_weekly_sent_on !== clock.date) {
      const claimed = await db<unknown[]>(
        `whatsapp_settings?${h}&or=(last_weekly_sent_on.is.null,last_weekly_sent_on.neq.${clock.date})`,
        { method: "PATCH", body: { last_weekly_sent_on: clock.date }, returning: true }
      );
      if (claimed.length) {
        await send(s.household_id, groupId, "weekly", await buildSummary("weekly", s, now));
        sent.push("weekly");
      }
    }

    // 3. Recurring custom messages
    const customs = await db<CustomMessage[]>(`whatsapp_messages?${h}&enabled=eq.true&select=id,text,weekdays,send_time,last_sent_on`);
    for (const m of customs) {
      if (!m.weekdays.includes(clock.weekday) || !isDue(m.send_time, clock.minutes) || m.last_sent_on === clock.date) continue;
      const claimed = await db<unknown[]>(
        `whatsapp_messages?id=eq.${m.id}&or=(last_sent_on.is.null,last_sent_on.neq.${clock.date})`,
        { method: "PATCH", body: { last_sent_on: clock.date }, returning: true }
      );
      if (claimed.length) {
        await send(s.household_id, groupId, "custom", m.text);
        sent.push(`custom:${m.id}`);
      }
    }

    // 4. Per-item reminders that are due (and not too stale)
    const nowIso = now.toISOString();
    const oldest = new Date(now.getTime() - WINDOW_MIN * 60_000).toISOString();
    const due = `${h}&whatsapp_reminded_at=is.null&whatsapp_remind_at=lte.${nowIso}&whatsapp_remind_at=gte.${oldest}`;
    const [users, tasks, events] = await Promise.all([
      db<{ id: string; display_name: string }[]>(`users?${h}&select=id,display_name`),
      db<{ id: string; title: string; due_at: string | null; scheduled_start_at: string | null; assigned_to: string | null }[]>(
        `tasks?${due}&status=in.(todo,in_progress)&select=id,title,due_at,scheduled_start_at,assigned_to`),
      db<{ id: string; title: string; starts_at: string; location: string | null }[]>(
        `appointments?${due}&status=neq.cancelled&select=id,title,starts_at,location`),
    ]);
    const names = Object.fromEntries(users.map((u) => [u.id, u.display_name]));
    for (const t of tasks) {
      const claimed = await db<unknown[]>(`tasks?id=eq.${t.id}&whatsapp_reminded_at=is.null`, { method: "PATCH", body: { whatsapp_reminded_at: nowIso }, returning: true });
      if (!claimed.length) continue;
      await send(s.household_id, groupId, "reminder", buildReminder({
        kind: "task", title: t.title, at: t.scheduled_start_at ?? t.due_at, who: t.assigned_to ? names[t.assigned_to] : null,
        link: siteUrl() ? links.task(siteUrl()!, t.id) : null,
      }, s.time_zone));
      sent.push(`task:${t.id}`);
    }
    for (const e of events) {
      const claimed = await db<unknown[]>(`appointments?id=eq.${e.id}&whatsapp_reminded_at=is.null`, { method: "PATCH", body: { whatsapp_reminded_at: nowIso }, returning: true });
      if (!claimed.length) continue;
      await send(s.household_id, groupId, "reminder", buildReminder({ kind: "event", title: e.title, at: e.starts_at, location: e.location }, s.time_zone));
      sent.push(`event:${e.id}`);
    }

    report.push({ household: s.household_id, local: `${clock.date} ${Math.floor(clock.minutes / 60)}:${String(clock.minutes % 60).padStart(2, "0")}`, sent });
  }
  return report;
}

/** Resolves the signed-in app user (from their Supabase access token) to a household */
async function householdFromUserToken(token: string): Promise<string | null> {
  const res = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: { apikey: env("VITE_SUPABASE_ANON_KEY") ?? env("SUPABASE_ANON_KEY") ?? "", Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  if (!user.id) return null;
  const rows = await db<{ household_id: string }[]>(`users?id=eq.${user.id}&select=household_id`);
  return rows[0]?.household_id ?? null;
}

async function settingsFor(householdId: string): Promise<Settings> {
  const rows = await db<Settings[]>(`whatsapp_settings?household_id=eq.${householdId}&select=*`);
  return rows[0] ?? {
    household_id: householdId, enabled: true, group_id: null, group_name: null, daily_enabled: true,
    daily_time: "07:30:00", time_zone: "Asia/Jerusalem", sections: {}, greeting: null, last_daily_sent_on: null,
    weekly_enabled: false, weekly_day: 6, weekly_time: "20:00:00", weekly_sections: {}, weekly_greeting: null, last_weekly_sent_on: null,
    assistant_enabled: true, assistant_trigger: "פאמי", purchase_detection: true,
    shopping_filter: "low", shopping_show_missing: false,
    tasks_filter: "all", tasks_show_assignee: true, events_show_details: true, activity_detection: true,
  };
}

type GreenWebhook = {
  typeWebhook?: string;
  idMessage?: string;
  senderData?: { chatId?: string; senderName?: string; senderContactName?: string };
  messageData?: {
    typeMessage?: string;
    textMessageData?: { textMessage?: string };
    extendedTextMessageData?: { text?: string };
  };
};

/** Levenshtein distance ≤ 1 (one letter added, missing or wrong) */
function nearlyEqual(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Text after the trigger word ("פאמי, תוסיף חלב" → "תוסיף חלב"), or null if not addressed to us */
export function commandText(text: string, trigger: string): string | null {
  const t = text.trim();
  // Tolerate a one-letter typo in a 4+ letter trigger ("פאני" → "פאמי")
  const firstWord = t.split(/[\s,:.\-!?]/)[0].replace(/^@/, "").toLowerCase();
  const tr = trigger.trim().toLowerCase();
  if (tr.length >= 4 && firstWord !== tr && nearlyEqual(firstWord, tr)) {
    return t.slice(t.indexOf(firstWord) + firstWord.length).replace(/^[\s,:.\-!?]+/, "").trim();
  }
  for (const word of [trigger, "fami"].map((w) => w.trim().toLowerCase()).filter(Boolean)) {
    for (const prefix of [word, `@${word}`]) {
      if (!t.toLowerCase().startsWith(prefix)) continue;
      const rest = t.slice(prefix.length);
      // Must be a whole word: "פאמי," / "פאמי " / just "פאמי", not "פאמיליה"
      if (rest && !/^[\s,:.\-!?]/.test(rest)) continue;
      return rest.replace(/^[\s,:.\-!?]+/, "").trim();
    }
  }
  return null;
}

// "קניתי", "וקנינו", "הבאתי"… — a past-tense report of buying (not "צריך לקנות")
const PURCHASE_WORDS = new Set(["קניתי", "קנינו", "קנתה", "קנית", "הבאתי", "הבאנו", "לקחתי", "bought"]);

// "סיימתי", "שילמנו", "ביטלנו", "דחינו"… — reports of progress on a task or event
const ACTIVITY_WORDS = new Set([
  "סיימתי", "סיימנו", "עשיתי", "עשינו", "שילמתי", "שילמנו", "ביצעתי", "ביצענו", "טיפלתי", "טיפלנו",
  "הזמנתי", "הזמנו", "קבעתי", "קבענו", "הגשתי", "הגשנו", "ביטלתי", "ביטלנו", "בוטל", "בוטלה",
  "דחיתי", "דחינו", "נדחה", "נדחתה", "הזזתי", "הזזנו", "העברתי", "העברנו", "התקשרתי", "סגרתי", "סגרנו",
]);

/** True when a casual group message reports progress on a task/event (done, paid, cancelled, postponed…) */
export function mentionsActivity(text: string): boolean {
  return text
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .some((word) => ACTIVITY_WORDS.has(word) || ACTIVITY_WORDS.has(word.replace(/^(ו|ש|כש)/, "")));
}

/** True when a casual group message reports a purchase, so it can update stock without the trigger word */
export function mentionsPurchase(text: string): boolean {
  return text
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .some((word) => PURCHASE_WORDS.has(word) || PURCHASE_WORDS.has(word.replace(/^(ו|ש|כש)/, "")));
}

async function handleWebhook(event: GreenWebhook) {
  // Messages typed in WhatsApp by anyone (incl. the linked phone itself); never our own API sends
  if (event.typeWebhook !== "incomingMessageReceived" && event.typeWebhook !== "outgoingMessageReceived") return "ignored: type";
  const chatId = event.senderData?.chatId;
  const text = event.messageData?.textMessageData?.textMessage ?? event.messageData?.extendedTextMessageData?.text ?? "";
  if (!chatId?.endsWith("@g.us") || !text || !event.idMessage) return "ignored: not a group text";

  let [s] = await db<Settings[]>(`whatsapp_settings?group_id=eq.${encodeURIComponent(chatId)}&select=*`);
  // Same fallback as the scheduler: a household with no group chosen yet uses WHATSAPP_GROUP_ID
  if (!s && chatId === env("WHATSAPP_GROUP_ID")) [s] = await db<Settings[]>("whatsapp_settings?group_id=is.null&select=*");
  if (!s) return "ignored: not the family group";
  if (!s.enabled) return "ignored: messages switched off";
  if (!s.assistant_enabled) return "ignored: group commands switched off";
  const command = commandText(text, s.assistant_trigger || "פאמי");
  // Without the trigger word, only purchase / progress reports are handled (and only if they change something)
  const purchase = command === null && s.purchase_detection !== false && mentionsPurchase(text);
  const activity = command === null && !purchase && s.activity_detection !== false && mentionsActivity(text);
  const casual = purchase || activity;
  if (command === null && !casual) return "ignored: no trigger";

  // Process each WhatsApp message once (Green API retries webhooks it thinks failed)
  const claimed = await fetch(`${supabaseUrl()}/rest/v1/whatsapp_inbox`, {
    method: "POST",
    headers: {
      apikey: env("SUPABASE_SERVICE_ROLE_KEY")!, Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`,
      "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation",
    },
    body: JSON.stringify({ id_message: event.idMessage, household_id: s.household_id }),
  }).then((r) => r.json() as Promise<unknown[]>).catch(() => []);
  if (!Array.isArray(claimed) || !claimed.length) return "ignored: duplicate";

  const senderName = event.senderData?.senderName || event.senderData?.senderContactName || null;
  if (command === "") {
    await send(s.household_id, chatId, "assistant", "כן? 🙂 לדוגמה: *פאמי תוסיף חלב*, *פאמי סמני את הארנונה כבוצע*", event.idMessage);
    return "greeted";
  }
  const apiKey = env("GOOGLE_AI_API_KEY") ?? env("GEMINI_API_KEY");
  if (!apiKey) return "ignored: no GOOGLE_AI_API_KEY";

  const serviceDb = makeDb(supabaseUrl()!, env("SUPABASE_SERVICE_ROLE_KEY")!, env("SUPABASE_SERVICE_ROLE_KEY")!);
  const [context, [familySettings]] = await Promise.all([
    loadContext(serviceDb, s.household_id),
    // The family's chosen model (Settings / WhatsApp screen); falls back automatically if it doesn't answer
    serviceDb<{ assistant_model: string | null }[]>(`household_settings?household_id=eq.${s.household_id}&select=assistant_model`).catch(() => []),
  ]);
  // Changes need an author; attribute them to the sender if the name matches a member, else the owner
  const actor = context.members.find((m) => senderName && String(m.display_name).trim() === senderName.trim())
    ?? context.members.find((m) => m.role === "owner") ?? context.members[0];
  if (!actor) return "ignored: no members";

  let reply: string;
  try {
    const answer = await askAssistant({
      apiKey, message: command ?? text, context, timeZone: s.time_zone, sender: senderName, channel: "whatsapp",
      model: familySettings?.assistant_model || null,
      mode: purchase ? "purchase" : activity ? "activity" : "command",
    });
    // Casual messages may only update existing rows, never create or delete anything
    const allowed = purchase ? ["update_inventory_item"]
      : activity ? ["update_task", "update_event", "shift_task_schedule", "shift_event_schedule"] : null;
    const actions = allowed ? answer.actions.filter((a) => allowed.includes(String(a.type))) : answer.actions;
    const { lines, inventoryChanged, changed } = await executeActions(
      { db: serviceDb, householdId: s.household_id, actorId: actor.id, timeZone: s.time_zone, context, site: siteUrl() }, actions);
    // Stay silent when a casual message ("קניתי…", "סיימתי…") wasn't about anything we track
    if (casual && !changed) return purchase ? "ignored: purchase not in stock" : "ignored: no matching task or event";
    reply = [
      answer.reply,
      ...(casual ? lines.filter((l) => !l.startsWith("⚠️")) : lines),
      // The full list only on request ("מה צריך לקנות?"); after an update just celebrate an empty list
      inventoryChanged ? await shoppingCompleteLine(serviceDb, s.household_id) : "",
    ].filter(Boolean).join("\n");
  } catch (e) {
    if (casual) return "ignored: casual message error";
    reply = `לא הצלחתי כרגע 😕 ${e instanceof Error ? e.message.slice(0, 120) : ""}`;
  }
  await send(s.household_id, chatId, "assistant", reply, event.idMessage);
  return purchase ? "purchase recorded" : activity ? "activity recorded" : "answered";
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const greenReady = !!(env("GREEN_API_INSTANCE_ID") && env("GREEN_API_TOKEN"));
  if (!env("SUPABASE_SERVICE_ROLE_KEY")) return json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, 500);

  try {
    // ── WhatsApp → app (Green API webhook) ──
    if (url.searchParams.has("hook")) {
      const secret = env("CRON_SECRET");
      const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("secret");
      if (!secret || given !== secret) return new Response("Unauthorized", { status: 401 });
      const event = (await req.json().catch(() => ({}))) as GreenWebhook;
      const outcome = await handleWebhook(event).catch((e) => `error: ${e instanceof Error ? e.message : e}`);
      // Always 200 so Green API doesn't keep retrying; the outcome is for debugging
      return json({ ok: true, outcome });
    }

    // ── Scheduler ──
    if (url.searchParams.has("tick")) {
      const secret = env("CRON_SECRET");
      const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("secret");
      if (!secret || given !== secret) return new Response("Unauthorized", { status: 401 });
      if (!greenReady) {
        await db("households?select=id&limit=1"); // still keeps Supabase active
        return json({ ok: true, whatsapp: "not configured" });
      }
      return json({ ok: true, report: await tick(new Date()) });
    }

    // ── App actions (signed-in user) ──
    if (req.method !== "POST") return json({ ok: false, error: "Use POST" }, 405);
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const householdId = token ? await householdFromUserToken(token) : null;
    if (!householdId) return json({ ok: false, error: "Not signed in" }, 401);

    const body = (await req.json().catch(() => ({}))) as {
      action?: string; text?: string; kind?: "daily" | "weekly"; sections?: Record<string, boolean>; greeting?: string | null;
    };
    const summaryKind = body.kind === "weekly" ? "weekly" : "daily";
    const s = await settingsFor(householdId);
    const groupId = s.group_id ?? env("WHATSAPP_GROUP_ID") ?? null;

    switch (body.action) {
      case "status": {
        let state = "not_configured";
        if (greenReady) {
          const res = await greenApi("getStateInstance");
          state = res.ok ? ((await res.json()) as { stateInstance?: string }).stateInstance ?? "unknown" : `error ${res.status}`;
        }
        let listening = false;
        if (greenReady) {
          const res = await greenApi("getSettings");
          const cfg = res.ok ? ((await res.json()) as { webhookUrl?: string; incomingWebhook?: string }) : {};
          listening = !!cfg.webhookUrl?.includes("/api/whatsapp") && cfg.incomingWebhook === "yes";
        }
        return json({ ok: true, state, groupId, groupName: s.group_name, listening });
      }
      case "groups": {
        if (!greenReady) return json({ ok: false, error: "Green API is not configured" }, 400);
        const res = await greenApi("getContacts");
        const contacts = (await res.json()) as { id: string; name?: string; type?: string }[];
        const groups = contacts
          .filter((c) => c.type === "group" || c.id.endsWith("@g.us"))
          .map((c) => ({ id: c.id, name: c.name || c.id }))
          .sort((a, b) => a.name.localeCompare(b.name, "he"));
        return json({ ok: true, groups });
      }
      case "preview":
        return json({ ok: true, message: await buildSummary(summaryKind, s, new Date(), { sections: body.sections, greeting: body.greeting }) });
      case "send_summary":
      case "send_text": {
        if (!greenReady || !groupId) return json({ ok: false, error: "Choose a WhatsApp group first" }, 400);
        const message = body.action === "send_text"
          ? String(body.text ?? "").trim()
          : await buildSummary(summaryKind, s, new Date(), { sections: body.sections, greeting: body.greeting });
        if (!message) return json({ ok: false, error: "Empty message" }, 400);
        const result = await send(householdId, groupId, "manual", message);
        return json({ ok: result.ok, error: result.error }, result.ok ? 200 : 502);
      }
      case "setup_webhook": {
        if (!greenReady || !env("CRON_SECRET")) return json({ ok: false, error: "Green API / CRON_SECRET are not configured" }, 400);
        const origin = url.origin;
        if (/localhost|127\.0\.0\.1/.test(origin)) return json({ ok: false, error: "Run this from the deployed app, not localhost" }, 400);
        const res = await greenApi("setSettings", {
          // Token in both the header (webhookUrlToken) and the URL, whichever Green API sends
          webhookUrl: `${origin}/api/whatsapp?hook=1&secret=${encodeURIComponent(env("CRON_SECRET")!)}`,
          webhookUrlToken: env("CRON_SECRET"),
          incomingWebhook: "yes",          // messages from others in the group
          outgoingMessageWebhook: "yes",   // messages typed on the linked phone
          outgoingAPIMessageWebhook: "no", // our own sends — never echo them back
          outgoingWebhook: "no", stateWebhook: "no", deviceWebhook: "no", incomingCallWebhook: "no", pollMessageWebhook: "no",
        });
        const result = await res.json().catch(() => ({}));
        return json({ ok: res.ok, result }, res.ok ? 200 : 502);
      }
      default:
        return json({ ok: false, error: "Unknown action" }, 400);
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("whatsapp", error);
    return json({ ok: false, error }, 502);
  }
}
