// Shared household assistant: Gemini call + server-side action execution.
// Used by the in-app chat (/api/assistant, with the user's own token so RLS applies)
// and by WhatsApp group commands (/api/whatsapp, with the service role scoped to one household).

export const MODEL_CANDIDATES = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.5-pro"];

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

export function getRecommendedModel(models: string[]): string {
  return [...models].sort((a, b) => rankModel(b) - rankModel(a))[0] ?? MODEL_CANDIDATES[0];
}

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

async function requestGemini(apiKey: string, body: string, preferredModel: string | null, available: string[]): Promise<Response> {
  const order = Array.from(new Set(
    [preferredModel, getRecommendedModel(available.length ? available : MODEL_CANDIDATES), ...available, ...MODEL_CANDIDATES]
      .filter(Boolean).map((m) => normalizeModelName(m as string))
  ));
  let lastDetail = "No Gemini response";
  for (const model of order) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body }
    );
    if (res.ok) return res;
    const detail = await res.text();
    lastDetail = `${model}: ${detail}`;
    if (!(res.status === 404 || isTransient(res.status, detail) || /no longer available|is not found|not supported/.test(detail))) break;
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

/** "YYYY-MM-DD" + optional "HH:mm" in a time zone → UTC ISO */
export function zonedToUtc(date: string, time: string | null | undefined, timeZone: string): string | null {
  const dm = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dm) return null;
  const tm = (time ?? "").match(/^(\d{1,2}):(\d{2})$/);
  const [y, mo, d, h, mi] = [+dm[1], +dm[2], +dm[3], tm ? +tm[1] : 0, tm ? +tm[2] : 0];
  const desired = Date.UTC(y, mo - 1, d, h, mi);
  let guess = desired;
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(new Date(guess), timeZone);
    const delta = desired - Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
    if (!delta) break;
    guess += delta;
  }
  return new Date(guess).toISOString();
}

function nextOccurrence(days: number[], time: string, timeZone: string, now: Date): string | null {
  if (!days.length) return null;
  for (let i = 0; i <= 7; i++) {
    const day = new Date(now.getTime() + i * 86_400_000);
    const p = zonedParts(day, timeZone);
    const iso = `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
    const at = zonedToUtc(iso, time, timeZone);
    if (days.includes(weekday) && at && Date.parse(at) > now.getTime()) return at;
  }
  return null;
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
    db(`tasks?${h}&status=in.(todo,in_progress)&select=id,title,status,module,task_type,due_at,scheduled_start_at,assigned_to,priority_level&order=created_at.desc&limit=200`),
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
  "- add_task: title (required), description, task_type (priority|time_sensitive), priority_level (1-5), due_date (YYYY-MM-DD), due_time (HH:mm), assignee (member display_name), is_recurring, recurrence_days (0-6 array), recurrence_time (HH:mm).",
  "- update_task: id or title, then any of: status (todo|in_progress|done), new_title, due_date, due_time, priority_level, assignee (member display_name, or empty string to unassign).",
  "- delete_task: id or title.",
  "- add_event: title (required), date (YYYY-MM-DD, required), time (HH:mm), provider_name, location, notes.",
  "- update_event: id or title, then any of: new_title, date, time, location, provider_name, notes, status (scheduled|completed|cancelled).",
  "- delete_event: id or title.",
  "- shift_task_schedule / shift_event_schedule: id or title, hours_delta, months_delta.",
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
  /** "purchase": a casual group message that mentions buying — only stock updates, silence otherwise */
  mode?: "command" | "purchase";
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

  const available = await fetchAvailableGeminiModels(opts.apiKey).catch(() => MODEL_CANDIDATES);
  const res = await requestGemini(opts.apiKey, JSON.stringify({
    contents: [{ role: "user", parts: [{ text: `${system}\n\n${prompt}` }] }],
    generationConfig: { temperature: 0.2 },
  }), opts.model ?? null, available);
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
}

/** One line with what is still on the shopping list after a change */
export async function shoppingListLine(db: Db, householdId: string): Promise<string> {
  const items = await db<Row[]>(`inventory?household_id=eq.${householdId}&select=name,quantity,critical_threshold&order=name`);
  const missing = items.filter((i) => Number(i.quantity) < Number(i.critical_threshold)).map((i) => i.name);
  return missing.length ? `🛒 נשאר לקנות: ${missing.join(", ")}` : "🎉 רשימת הקניות הושלמה!";
}

/** Runs the assistant's actions; returns one Hebrew line per action and whether stock changed */
export async function executeActions(ctx: ExecContext, actions: AssistantAction[]): Promise<{ lines: string[]; inventoryChanged: boolean }> {
  const { db, householdId, actorId, timeZone, context } = ctx;
  const now = ctx.now ?? new Date();
  const lines: string[] = [];
  let inventoryChanged = false;
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
            ? `✅ ${patch.name ?? item.name}: ${patch.quantity} ${item.unit}`
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
          const recurring = Boolean(p.is_recurring);
          const days = Array.isArray(p.recurrence_days) ? p.recurrence_days.map(Number).filter((d: number) => d >= 0 && d <= 6) : [];
          const at = recurring
            ? nextOccurrence(days, String(p.recurrence_time ?? "09:00"), timeZone, now)
            : p.due_date ? zonedToUtc(String(p.due_date), p.due_time ? String(p.due_time) : null, timeZone) : null;
          await db("tasks", { method: "POST", body: {
            household_id: householdId, title, description: p.description ? String(p.description) : null,
            task_type: timeSensitive ? "time_sensitive" : "priority", status: "todo", module: "general", source_type: "manual",
            priority_level: timeSensitive ? null : Number(p.priority_level ?? 3),
            due_at: timeSensitive ? null : at, scheduled_start_at: timeSensitive ? at : null,
            is_recurring: recurring, recurrence_rule: recurring ? JSON.stringify({ days, time: p.recurrence_time ?? "09:00" }) : null,
            assigned_to: memberId(p.assignee), created_by: actorId,
          } });
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
          lines.push(patch.status ? `✅ ${task.title} → ${STATUS_HE[patch.status]}` : `✅ עודכנה משימה: ${patch.title ?? task.title}`);
          break;
        }
        case "delete_task": {
          const task = findRow(context.tasks, p, "title");
          if (!task) { lines.push(`⚠️ לא מצאתי משימה: ${p.title ?? p.id}`); break; }
          await db(`tasks?id=eq.${task.id}`, { method: "DELETE" });
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
          lines.push(`✅ עודכן אירוע: ${patch.title ?? ev.title}`);
          break;
        }
        case "delete_event": {
          const ev = findRow(context.appointments, p, "title");
          if (!ev) { lines.push(`⚠️ לא מצאתי אירוע: ${p.title ?? p.id}`); break; }
          await db(`appointments?id=eq.${ev.id}`, { method: "DELETE" });
          lines.push(`🗑️ נמחק אירוע: ${ev.title}`);
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
          lines.push(`🕒 הוזז: ${row.title}`);
          break;
        }
      }
    } catch (e) {
      lines.push(`❌ ${action.type}: ${e instanceof Error ? e.message.slice(0, 120) : "שגיאה"}`);
    }
  }
  return { lines, inventoryChanged };
}
