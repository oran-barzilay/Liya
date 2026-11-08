import { renderEventList, renderShoppingList, renderTaskList, localDate } from "./_digest";
import { FREQUENCIES, firstOccurrence, nextOccurrence, parseRule, zonedToUtc, type Frequency, type RecurrenceRule } from "../src/lib/recurrence";

// Shared household assistant: Gemini call + server-side action execution.
// Used by the in-app chat (/api/assistant, with the user's own token so RLS applies)
// and by WhatsApp group commands (/api/whatsapp, with the service role scoped to one household).

// Tested, fast models in order of preference (gemini-3.6-flash answers in ~2s)
export const MODEL_CANDIDATES = ["gemini-3.6-flash", "gemini-flash-latest", "gemini-3-flash-preview"];
// Per-model time limit: the whole request must finish well inside the 25s function limit
const MODEL_TIMEOUT_MS = 8_000;

type Row = Record<string, any>;
export type AssistantAction = { type?: string; payload?: Row };

/* ─────────────── Gemini ─────────────── */

function parseGeminiVersion(model: string) {
  const match = model.match(/gemini-(\d+)(?:\.(\d+))?/i);
  return { major: match?.[1] ? Number(match[1]) : 0, minor: match?.[2] ? Number(match[2]) : 0 };
}

function rankModel(model: string): number {
  const m = model.toLowerCase();
  const { major, minor } = parseGeminiVersion(m);
  let score = major * 100 + minor;
  if (m.includes("-flash")) score += 10_000;
  if (m.includes("-pro")) score -= 500;
  if (m.includes("preview") || m.includes("exp")) score -= 5;
  return score;
}

/**
 * Default model: the first known-good candidate that is available. Picking "newest by name"
 * from Google's list is unsafe — listed preview/variant models can hang for over a minute.
 */
export function getRecommendedModel(models: string[]): string {
  return MODEL_CANDIDATES.find((m) => models.includes(m))
    ?? [...models].filter(isChatModel).sort((a, b) => rankModel(b) - rankModel(a))[0]
    ?? MODEL_CANDIDATES[0];
}

/** Text chat models only — not image / speech / embedding / live variants */
export const isChatModel = (m: string) => !/image|tts|audio|live|embed|vision|native/.test(m);

const normalizeModelName = (name: string) => (name.startsWith("models/") ? name.slice("models/".length) : name);

export async function fetchAvailableGeminiModels(apiKey: string): Promise<string[]> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
  if (!res.ok) return MODEL_CANDIDATES;
  const data = (await res.json()) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
  const list = (data.models ?? [])
    .filter((m) => m.name && (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m) => normalizeModelName(String(m.name)))
    .filter((name) => name.startsWith("gemini-"));
  return list.length ? list : MODEL_CANDIDATES;
}

const isTransient = (status: number, detail: string) =>
  status === 429 || status === 503 || /high demand|UNAVAILABLE|temporarily/.test(detail);

async function requestGemini(apiKey: string, body: string, preferredModel: string | null): Promise<Response> {
  // The user's chosen model, then the tested defaults; at most two attempts fit in the time limit
  const order = Array.from(new Set([preferredModel, ...MODEL_CANDIDATES].filter(Boolean).map((m) => normalizeModelName(m as string)))).slice(0, 2);
  let lastDetail = "No Gemini response";
  for (const model of order) {
    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(MODEL_TIMEOUT_MS) }
      );
    } catch {
      lastDetail = `${model}: no answer within ${MODEL_TIMEOUT_MS / 1000}s`;
      continue; // hanging model → try the next one
    }
    if (res.ok) return res;
    const detail = await res.text();
    lastDetail = `${model}: ${detail.slice(0, 200)}`;
    if (!(res.status === 404 || res.status === 400 || isTransient(res.status, detail) || /no longer available|is not found|not supported/.test(detail))) break;
  }
  throw new Error(lastDetail);
}

function extractJson(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  return first >= 0 && last > first ? text.slice(first, last + 1) : text.trim();
}

/* ─────────────── Time ─────────────── */

function zonedParts(date: Date, timeZone: string) {
  const map = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  }).formatToParts(date).map((p) => [p.type, p.value]));
  return { y: +map.year, m: +map.month, d: +map.day, h: +map.hour % 24, min: +map.minute, weekday: map.weekday as string };
}

/* ─────────────── Data access ─────────────── */

/** A PostgREST client bound to either the service role or a user's own token */
export type Db = <T = any>(path: string, init?: { method?: string; body?: unknown }) => Promise<T>;

export function makeDb(supabaseUrl: string, apiKey: string, bearer: string): Db {
  return async (path, init = {}) => {
    const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      method: init.method ?? "GET",
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${bearer}`,
        ...(init.body !== undefined ? { "Content-Type": "application/json", Prefer: "return=representation" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    if (!res.ok) throw new Error(`${path.split("?")[0]}: ${res.status} ${(await res.text()).slice(0, 200)}`);
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as any;
  };
}

export interface HouseholdContext {
  inventory: Row[];
  tasks: Row[];
  appointments: Row[];
  members: Row[];
}

export async function loadContext(db: Db, householdId: string, now = new Date()): Promise<HouseholdContext> {
  const h = `household_id=eq.${householdId}`;
  const from = new Date(now.getTime() - 2 * 86_400_000).toISOString();
  const [inventory, openTasks, doneTasks, appointments, members] = await Promise.all([
    db(`inventory?${h}&select=id,name,quantity,unit,critical_threshold&order=name`),
    db(`tasks?${h}&status=in.(todo,in_progress)&select=id,title,status,module,task_type,due_at,scheduled_start_at,assigned_to,priority_level,description,is_recurring,recurrence_rule&order=created_at.desc&limit=200`),
    db(`tasks?${h}&status=eq.done&select=id,title,status,module,due_at,scheduled_start_at&order=updated_at.desc&limit=20`),
    db(`appointments?${h}&starts_at=gte.${from}&select=id,title,starts_at,location,provider_name,status&order=starts_at&limit=100`),
    db(`users?${h}&select=id,display_name,role`),
  ]);
  return { inventory, tasks: [...openTasks, ...doneTasks], appointments, members };
}

/* ─────────────── Prompt ─────────────── */

const ACTION_DOCS = [
  "Action types and payloads (use the `id` from context whenever you act on an existing row):",
  "- add_inventory_item: name (required), unit, quantity (number), critical_threshold (number), notes.",
  "- update_inventory_item: id or name (to find it), quantity (set exact number) OR quantity_delta (+/- number, e.g. bought 2 → +2, used one → -1), critical_threshold, new_name, unit.",
  "- delete_inventory_item: id or name.",
  "- add_task: title (required), description, task_type (priority|time_sensitive), priority_level (1-5), due_date (YYYY-MM-DD), due_time (HH:mm), assignee (member display_name). Recurring: recurrence (weekly|biweekly|monthly|bimonthly|quarterly|semiannual|yearly), recurrence_time (HH:mm); for weekly/biweekly also recurrence_days (0-6 array, 0=Sunday); for biweekly and up due_date = the start date (\"החל מ...\"; for monthly-based its day of month, and month for yearly, repeats).",
  "- update_task: id or title, then any of: status (todo|in_progress|done), new_title, due_date, due_time, priority_level, assignee (member display_name, or empty string to unassign).",
  "- delete_task: id or title.",
  "- add_event: title (required), date (YYYY-MM-DD, required), time (HH:mm), provider_name, location, notes.",
  "- update_event: id or title, then any of: new_title, date, time, location, provider_name, notes, status (scheduled|completed|cancelled).",
  "- delete_event: id or title.",
  "- shift_task_schedule / shift_event_schedule: id or title, hours_delta, months_delta.",
  "- show_shopping_list: no payload. Use when the user asks what to buy / to see the shopping list.",
  "- show_tasks: filter (open|today|overdue|tomorrow), assignee (optional member display_name). Use when the user asks to see tasks.",
  "- show_events: range (today|tomorrow|week). Use when the user asks about upcoming events / the calendar.",
  "With show_* actions keep the reply to a few words — the list itself is added automatically (with links); never write the list yourself.",
  "Match items by meaning, not exact spelling (\"פפסי\" → \"שישית פפסי\", \"חלב\" → \"חלב 3%\"), using the id from Inventory. Use the number the user wrote as-is, in the item's own unit (\"קניתי 6 פפסי\" → quantity_delta 6).",
  "Shopping list = inventory items whose quantity is below critical_threshold. \"Bought X\" means update_inventory_item with a positive quantity_delta; if no amount is given, use quantity_delta = max(1, critical_threshold - quantity).",
  "Shopping tasks (module=inventory) close automatically when stock is back above the minimum — prefer updating the inventory item.",
  "Only emit actions when the user clearly asks to change something. For questions, answer from context with no actions.",
  "Never invent rows. If something to edit/delete is not in context, say so in the reply and emit no action for it.",
].join("\n");

export async function askAssistant(opts: {
  apiKey: string;
  message: string;
  context: HouseholdContext;
  timeZone: string;
  model?: string | null;
  sender?: string | null;
  channel: "app" | "whatsapp";
  /** "purchase" / "activity": a casual group message (no trigger word) — only matching updates, silence otherwise */
  mode?: "command" | "purchase" | "activity";
  now?: Date;
}): Promise<{ reply: string; actions: AssistantAction[] }> {
  const now = opts.now ?? new Date();
  const p = zonedParts(now, opts.timeZone);
  const today = `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
  const system = [
    "You are a Hebrew assistant for a family household app (tasks, shopping list / inventory, calendar events).",
    `Now: ${today} (${p.weekday}) ${String(p.h).padStart(2, "0")}:${String(p.min).padStart(2, "0")} in ${opts.timeZone}. Resolve relative dates (מחר, יום שלישי, בעוד שבוע) from this.`,
    opts.channel === "whatsapp"
      ? "You are answering inside the family WhatsApp group: keep the reply short (1-3 lines), friendly, in Hebrew, WhatsApp formatting (*bold*) allowed."
      : "Reply in Hebrew.",
    opts.sender ? `The message was written by: ${opts.sender}.` : "",
    opts.mode === "purchase"
      ? "PURCHASE MODE: this is an ordinary family chat message (not addressed to you) that mentions buying something. "
        + "Only if it reports items that were bought and that exist in Inventory, emit update_inventory_item with a positive quantity_delta for each, "
        + "and a very short thanks as the reply. Emit no other action types. If it is a question, a request (\"צריך לקנות\"), or about things not in Inventory, "
        + "return {\"reply\": \"\", \"actions\": []}."
      : opts.mode === "activity"
      ? "ACTIVITY MODE: this is an ordinary family chat message (not addressed to you) that may report progress on a task or event "
        + "(done / paid / cancelled / postponed / moved / who will do it). Only if it clearly refers to a task or event that exists in context, "
        + "emit update_task (status, due_date/due_time, assignee), update_event (date, time, status, location) or shift_* for it, and a very short reply. "
        + "Never create or delete anything. If it doesn't clearly match an existing task or event, return {\"reply\": \"\", \"actions\": []}."
      : "",
    "Return ONLY valid JSON, no markdown: {\"reply\": string, \"actions\": [{\"type\": string, \"payload\": object}]}",
    ACTION_DOCS,
  ].filter(Boolean).join("\n");

  const c = opts.context;
  const prompt = [
    `User message: ${opts.message}`,
    `Members: ${JSON.stringify(c.members.map((m) => ({ id: m.id, display_name: m.display_name })))}`,
    `Inventory: ${JSON.stringify(c.inventory.slice(0, 200))}`,
    `Tasks: ${JSON.stringify(c.tasks.slice(0, 200))}`,
    `Events: ${JSON.stringify(c.appointments.slice(0, 100))}`,
  ].join("\n\n");

  const res = await requestGemini(opts.apiKey, JSON.stringify({
    contents: [{ role: "user", parts: [{ text: `${system}\n\n${prompt}` }] }],
    // No extended "thinking": household commands are simple, and thinking took ~11s vs ~2s without it
    generationConfig: { temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } },
  }), opts.model ?? null);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((x) => x.text ?? "").join("\n") ?? "";
  try {
    const parsed = JSON.parse(extractJson(text)) as { reply?: string; actions?: AssistantAction[] };
    return { reply: parsed.reply ?? "בוצע.", actions: Array.isArray(parsed.actions) ? parsed.actions : [] };
  } catch {
    return { reply: text || "לא הצלחתי להבין, אפשר לנסח אחרת?", actions: [] };
  }
}

/* ─────────────── Execution ─────────────── */

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** Find a row by id, exact name, then partial name; open tasks win over done ones */
function findRow(rows: Row[], payload: Row, field: "title" | "name"): Row | undefined {
  if (payload.id) {
    const byId = rows.find((r) => r.id === payload.id);
    if (byId) return byId;
  }
  const wanted = norm(payload[field] ?? payload.title ?? payload.name);
  if (!wanted) return undefined;
  const rank = (r: Row) => (r.status === "done" || r.status === "cancelled" ? 1 : 0);
  const exact = rows.filter((r) => norm(r[field]) === wanted).sort((a, b) => rank(a) - rank(b));
  if (exact.length) return exact[0];
  return rows
    .filter((r) => norm(r[field]).includes(wanted) || (wanted.length > 2 && wanted.includes(norm(r[field]))))
    .sort((a, b) => rank(a) - rank(b))[0];
}

function shiftIso(iso: string, hours: number, months: number): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  if (months) d.setUTCMonth(d.getUTCMonth() + months);
  if (hours) d.setUTCHours(d.getUTCHours() + hours);
  return d.toISOString();
}

const STATUS_HE: Record<string, string> = { todo: "לביצוע", in_progress: "בביצוע", done: "בוצע" };

export interface ExecContext {
  db: Db;
  householdId: string;
  /** Who the change is attributed to (required columns created_by/updated_by) */
  actorId: string;
  timeZone: string;
  context: HouseholdContext;
  now?: Date;
  /** App address for tap-to-open links in lists (WhatsApp); omitted in the app itself */
  site?: string | null;
}

/** After a stock change: a celebration if nothing is left to buy, otherwise nothing (the list is shown only on request) */
export async function shoppingCompleteLine(db: Db, householdId: string): Promise<string> {
  const items = await db<Row[]>(`inventory?household_id=eq.${householdId}&select=quantity,critical_threshold`);
  return items.some((i) => Number(i.quantity) < Number(i.critical_threshold)) ? "" : "🎉 רשימת הקניות הושלמה!";
}

/** Runs the assistant's actions; returns one Hebrew line per action and whether stock changed */
export async function executeActions(ctx: ExecContext, actions: AssistantAction[]): Promise<{ lines: string[]; inventoryChanged: boolean; changed: boolean }> {
  const { db, householdId, actorId, timeZone, context } = ctx;
  const now = ctx.now ?? new Date();
  const lines: string[] = [];
  let inventoryChanged = false;
  // Any successful change (used to stay silent on casual messages that changed nothing)
  let changed = false;
  const memberName = (id: unknown) => context.members.find((m) => m.id === id)?.display_name ?? "ללא";
  /** "10.11" for date-only values, "10.11 09:00" otherwise */
  const when = (iso: string | null | undefined) => {
    if (!iso) return "ללא תאריך";
    const z = zonedParts(new Date(iso), timeZone);
    const date = `${String(z.d).padStart(2, "0")}.${String(z.m).padStart(2, "0")}`;
    return z.h || z.min ? `${date} ${String(z.h).padStart(2, "0")}:${String(z.min).padStart(2, "0")}` : date;
  };
  const memberId = (name: unknown) => {
    const n = norm(name);
    return n ? context.members.find((m) => norm(m.display_name) === n || norm(m.display_name).startsWith(n))?.id ?? null : null;
  };

  for (const action of actions) {
    const p = action.payload ?? {};
    try {
      switch (action.type) {
        case "add_inventory_item": {
          const name = String(p.name ?? "").trim();
          if (!name) break;
          const existing = findRow(context.inventory, { name }, "name");
          if (existing && norm(existing.name) === norm(name)) {
            // Already tracked: "add milk" means "put it on the shopping list" (stock below its minimum)
            if (Number(existing.quantity) < Number(existing.critical_threshold)) {
              lines.push(`🛒 ${existing.name} כבר ברשימת הקניות`);
            } else {
              const quantity = Math.max(0, Number(existing.critical_threshold) - 1);
              await db(`inventory?id=eq.${existing.id}`, { method: "PATCH", body: { quantity, updated_by: actorId } });
              inventoryChanged = true;
              lines.push(`🛒 ${existing.name} נוסף לרשימת הקניות`);
            }
            break;
          }
          await db("inventory", { method: "POST", body: {
            household_id: householdId, name, unit: String(p.unit ?? "יחידות"),
            quantity: Number(p.quantity ?? 0), critical_threshold: Number(p.critical_threshold ?? 1),
            notes: p.notes ? String(p.notes) : null, auto_restock_task: true, updated_by: actorId,
          } });
          inventoryChanged = true;
          lines.push(`🛒 נוסף: ${name}`);
          break;
        }
        case "update_inventory_item": {
          const item = findRow(context.inventory, p, "name");
          if (!item) { lines.push(`⚠️ לא מצאתי במלאי: ${p.name ?? p.id}`); break; }
          const patch: Row = { updated_by: actorId };
          if (p.quantity !== undefined) patch.quantity = Math.max(0, Number(p.quantity));
          else if (p.quantity_delta !== undefined) patch.quantity = Math.max(0, Number(item.quantity) + Number(p.quantity_delta));
          if (p.critical_threshold !== undefined) patch.critical_threshold = Number(p.critical_threshold);
          if (p.new_name) patch.name = String(p.new_name);
          if (p.unit) patch.unit = String(p.unit);
          await db(`inventory?id=eq.${item.id}`, { method: "PATCH", body: patch });
          inventoryChanged = true;
          lines.push(patch.quantity !== undefined
            ? `✅ עדכנתי את ${patch.name ?? item.name}: מ-${Number(item.quantity)} ל-${patch.quantity} ${item.unit}`
            : `✅ עודכן: ${patch.name ?? item.name}`);
          break;
        }
        case "delete_inventory_item": {
          const item = findRow(context.inventory, p, "name");
          if (!item) { lines.push(`⚠️ לא מצאתי במלאי: ${p.name ?? p.id}`); break; }
          await db(`inventory?id=eq.${item.id}`, { method: "DELETE" });
          inventoryChanged = true;
          lines.push(`🗑️ הוסר מהמלאי: ${item.name}`);
          break;
        }
        case "add_task": {
          const title = String(p.title ?? "").trim();
          if (!title) break;
          const timeSensitive = p.task_type === "time_sensitive";
          const freq = (FREQUENCIES as string[]).includes(String(p.recurrence)) ? (p.recurrence as Frequency)
            : p.is_recurring ? "weekly" : null;
          const time = String(p.recurrence_time ?? p.due_time ?? "09:00");
          const firstDate = String(p.due_date ?? localDate(now, timeZone));
          const days = Array.isArray(p.recurrence_days) ? p.recurrence_days.map(Number).filter((d: number) => d >= 0 && d <= 6) : [];
          const rule: RecurrenceRule | null = !freq ? null
            : freq === "weekly" ? { freq, days, time }
            : freq === "biweekly" ? { freq, days, time, start: firstDate }
            : { freq, day: Number(firstDate.slice(8, 10)), time, start: firstDate };
          const at = rule
            ? firstOccurrence(rule, timeZone, now)
            : p.due_date ? zonedToUtc(String(p.due_date), p.due_time ? String(p.due_time) : null, timeZone) : null;
          await db("tasks", { method: "POST", body: {
            household_id: householdId, title, description: p.description ? String(p.description) : null,
            task_type: timeSensitive ? "time_sensitive" : "priority", status: "todo", module: "general", source_type: "manual",
            priority_level: timeSensitive ? null : Number(p.priority_level ?? 3),
            due_at: timeSensitive ? null : at, scheduled_start_at: timeSensitive ? at : null,
            is_recurring: !!rule, recurrence_rule: rule ? JSON.stringify(rule) : null,
            assigned_to: memberId(p.assignee), created_by: actorId,
          } });
          changed = true;
          lines.push(`📝 משימה חדשה: ${title}`);
          break;
        }
        case "update_task": {
          const task = findRow(context.tasks, p, "title");
          if (!task) { lines.push(`⚠️ לא מצאתי משימה: ${p.title ?? p.id}`); break; }
          const patch: Row = {};
          if (p.status && STATUS_HE[p.status]) patch.status = p.status;
          if (p.new_title) patch.title = String(p.new_title);
          if (p.priority_level !== undefined) patch.priority_level = Number(p.priority_level);
          if (p.assignee !== undefined) patch.assigned_to = memberId(p.assignee);
          if (p.due_date) {
            const at = zonedToUtc(String(p.due_date), p.due_time ? String(p.due_time) : null, timeZone);
            patch[task.task_type === "time_sensitive" ? "scheduled_start_at" : "due_at"] = at;
          }
          if (!Object.keys(patch).length) break;
          await db(`tasks?id=eq.${task.id}`, { method: "PATCH", body: patch });
          changed = true;
          // Before → after for everything that changed
          const dateField = task.task_type === "time_sensitive" ? "scheduled_start_at" : "due_at";
          const changes = [
            patch.status && `${STATUS_HE[task.status] ?? task.status} → ${STATUS_HE[patch.status]}`,
            patch[dateField] !== undefined && `📅 ${when(task[dateField])} → ${when(patch[dateField])}`,
            patch.assigned_to !== undefined && `👤 ${memberName(task.assigned_to)} → ${memberName(patch.assigned_to)}`,
            patch.priority_level !== undefined && `עדיפות ${task.priority_level ?? "-"} → ${patch.priority_level}`,
            patch.title && `שם חדש: ${patch.title}`,
          ].filter(Boolean);
          lines.push(`✅ עדכנתי את ${task.title}: ${changes.join(" · ")}`);
          // Completed a recurring task → create its next occurrence (same as ticking it off in the app)
          const rule = task.is_recurring && patch.status === "done" && task.status !== "done" ? parseRule(task.recurrence_rule) : null;
          const next = rule ? nextOccurrence(rule, timeZone, now, task.scheduled_start_at ?? task.due_at) : null;
          if (next) {
            await db("tasks", { method: "POST", body: {
              household_id: householdId, title: patch.title ?? task.title, description: task.description ?? null,
              task_type: task.task_type, module: task.module, source_type: "recurring", status: "todo",
              priority_level: task.priority_level, assigned_to: patch.assigned_to !== undefined ? patch.assigned_to : task.assigned_to,
              due_at: task.task_type === "priority" ? next : null, scheduled_start_at: task.task_type === "time_sensitive" ? next : null,
              is_recurring: true, recurrence_rule: task.recurrence_rule, created_by: actorId,
            } });
            lines.push(`🔁 הבאה: ${new Intl.DateTimeFormat("he-IL", { timeZone, day: "numeric", month: "numeric" }).format(new Date(next))}`);
          }
          break;
        }
        case "delete_task": {
          const task = findRow(context.tasks, p, "title");
          if (!task) { lines.push(`⚠️ לא מצאתי משימה: ${p.title ?? p.id}`); break; }
          await db(`tasks?id=eq.${task.id}`, { method: "DELETE" });
          changed = true;
          lines.push(`🗑️ נמחקה משימה: ${task.title}`);
          break;
        }
        case "add_event": {
          const title = String(p.title ?? "").trim();
          const at = p.date ? zonedToUtc(String(p.date), p.time ? String(p.time) : null, timeZone) : null;
          if (!title || !at) break;
          await db("appointments", { method: "POST", body: {
            household_id: householdId, title, starts_at: at,
            provider_name: p.provider_name ? String(p.provider_name) : null, location: p.location ? String(p.location) : null,
            notes: p.notes ? String(p.notes) : null, status: "scheduled", created_by: actorId,
          } });
          changed = true;
          lines.push(`📅 אירוע חדש: ${title}`);
          break;
        }
        case "update_event": {
          const ev = findRow(context.appointments, p, "title");
          if (!ev) { lines.push(`⚠️ לא מצאתי אירוע: ${p.title ?? p.id}`); break; }
          const patch: Row = {};
          if (p.new_title) patch.title = String(p.new_title);
          if (p.date || p.time) {
            const current = zonedParts(new Date(ev.starts_at), timeZone);
            const date = String(p.date ?? `${current.y}-${String(current.m).padStart(2, "0")}-${String(current.d).padStart(2, "0")}`);
            const time = String(p.time ?? `${String(current.h).padStart(2, "0")}:${String(current.min).padStart(2, "0")}`);
            patch.starts_at = zonedToUtc(date, time, timeZone);
          }
          for (const k of ["location", "provider_name", "notes", "status"] as const) if (p[k] !== undefined) patch[k] = p[k] || null;
          if (!Object.keys(patch).length) break;
          await db(`appointments?id=eq.${ev.id}`, { method: "PATCH", body: patch });
          changed = true;
          const EVENT_STATUS: Record<string, string> = { scheduled: "מתוכנן", completed: "התקיים", cancelled: "בוטל" };
          const changes = [
            patch.starts_at && `${when(ev.starts_at)} → ${when(patch.starts_at)}`,
            patch.status !== undefined && `${EVENT_STATUS[ev.status] ?? ev.status} → ${EVENT_STATUS[patch.status] ?? patch.status}`,
            patch.location !== undefined && `📍 ${ev.location || "ללא"} → ${patch.location || "ללא"}`,
            patch.provider_name !== undefined && `${ev.provider_name || "ללא"} → ${patch.provider_name || "ללא"}`,
            patch.title && `שם חדש: ${patch.title}`,
            patch.notes !== undefined && "עודכנו הערות",
          ].filter(Boolean);
          lines.push(`📅 עדכנתי את ${ev.title}: ${changes.join(" · ")}`);
          break;
        }
        case "delete_event": {
          const ev = findRow(context.appointments, p, "title");
          if (!ev) { lines.push(`⚠️ לא מצאתי אירוע: ${p.title ?? p.id}`); break; }
          await db(`appointments?id=eq.${ev.id}`, { method: "DELETE" });
          changed = true;
          lines.push(`🗑️ נמחק אירוע: ${ev.title}`);
          break;
        }
        case "show_events": {
          const range = String(p.range ?? "week");
          const span = range === "today" ? 1 : range === "tomorrow" ? 2 : 7;
          const days = Array.from({ length: span }, (_, i) => localDate(new Date(now.getTime() + i * 86_400_000), timeZone));
          const picked = context.appointments.filter((e) => {
            const d = localDate(e.starts_at, timeZone);
            return range === "tomorrow" ? d === days[1] : days.includes(d);
          });
          const title = { today: "📅 *אירועים היום*", tomorrow: "📅 *אירועים מחר*" }[range] ?? "📅 *אירועים השבוע*";
          lines.push(renderEventList(title, picked as any, timeZone, ctx.site ?? null));
          break;
        }
        case "show_shopping_list": {
          lines.push(renderShoppingList(context.inventory as any, ctx.site ?? null));
          break;
        }
        case "show_tasks": {
          const today = localDate(now, timeZone);
          const tomorrow = localDate(new Date(now.getTime() + 86_400_000), timeZone);
          const day = (t: Row) => {
            const at = t.scheduled_start_at ?? t.due_at;
            return at ? localDate(at, timeZone) : null;
          };
          const who = memberId(p.assignee);
          const filter = String(p.filter ?? "open");
          const open = context.tasks
            .filter((t) => t.status !== "done" && t.status !== "cancelled" && t.module !== "inventory")
            .filter((t) => !who || t.assigned_to === who)
            .filter((t) => filter === "today" ? day(t) === today
              : filter === "tomorrow" ? day(t) === tomorrow
              : filter === "overdue" ? !!day(t) && day(t)! < today
              : true)
            .sort((a, b) => String(a.scheduled_start_at ?? a.due_at ?? "9999").localeCompare(String(b.scheduled_start_at ?? b.due_at ?? "9999")));
          const title = { today: "✅ *משימות להיום*", tomorrow: "🔜 *משימות למחר*", overdue: "⚠️ *משימות באיחור*" }[filter] ?? "📋 *משימות פתוחות*";
          const members = Object.fromEntries(context.members.map((m) => [m.id, m.display_name]));
          lines.push(renderTaskList(title, open as any, members, timeZone, ctx.site ?? null));
          break;
        }
        case "shift_task_schedule":
        case "shift_event_schedule": {
          const isTask = action.type === "shift_task_schedule";
          const row = findRow(isTask ? context.tasks.filter((t) => t.status !== "done") : context.appointments, p, "title");
          const field = isTask ? (row?.task_type === "time_sensitive" ? "scheduled_start_at" : "due_at") : "starts_at";
          const current = row?.[field] ?? row?.scheduled_start_at ?? row?.due_at;
          const shifted = current ? shiftIso(current, Number(p.hours_delta ?? 0) || 0, Number(p.months_delta ?? 0) || 0) : null;
          if (!row || !shifted) { lines.push(`⚠️ לא מצאתי מה להזיז: ${p.title ?? p.id}`); break; }
          await db(`${isTask ? "tasks" : "appointments"}?id=eq.${row.id}`, { method: "PATCH", body: { [field]: shifted } });
          changed = true;
          lines.push(`🕒 ${row.title}: ${when(current)} → ${when(shifted)}`);
          break;
        }
      }
    } catch (e) {
      lines.push(`❌ ${action.type}: ${e instanceof Error ? e.message.slice(0, 120) : "שגיאה"}`);
    }
  }
  return { lines, inventoryChanged, changed: changed || inventoryChanged };
}
