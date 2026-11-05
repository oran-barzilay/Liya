import { buildDigest, localDate, localHour, type DigestEvent, type DigestStockItem, type DigestTask } from "./_digest";

export const config = { runtime: "edge" };

/**
 * Daily job (two Vercel crons, 04:00 and 05:00 UTC — see vercel.json):
 *  1. Always runs a real Supabase query, so the free project never pauses.
 *  2. Sends the family summary to the WhatsApp group via Green API, but only
 *     during SEND_HOUR in Israel. Two crons cover summer/winter time; the
 *     hour check makes exactly one of them send.
 *
 * Manual use (needs CRON_SECRET, as "Authorization: Bearer …" or ?secret=…):
 *   /api/daily?groups=1   → list WhatsApp groups and their ids (to find WHATSAPP_GROUP_ID)
 *   /api/daily?preview=1  → show today's message without sending
 *   /api/daily?force=1    → send now, regardless of the hour
 *
 * Env: SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL (or SUPABASE_URL), CRON_SECRET,
 *      GREEN_API_INSTANCE_ID, GREEN_API_TOKEN, GREEN_API_URL (optional), WHATSAPP_GROUP_ID,
 *      FAMI_HOUSEHOLD_ID (optional if there is a single household), FAMI_TIME_ZONE (optional)
 */

const SEND_HOUR = 7;
const env = (name: string) => process.env[name]?.trim() || undefined;

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

async function supabaseGet<T>(path: string, key: string): Promise<T> {
  const url = env("SUPABASE_URL") ?? env("VITE_SUPABASE_URL");
  const res = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`Supabase ${path.split("?")[0]}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

function greenApi(method: string, body?: unknown) {
  const base = (env("GREEN_API_URL") ?? "https://api.green-api.com").replace(/\/$/, "");
  return fetch(`${base}/waInstance${env("GREEN_API_INSTANCE_ID")}/${method}/${env("GREEN_API_TOKEN")}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const secret = env("CRON_SECRET");
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("secret");
  if (secret && given !== secret) return new Response("Unauthorized", { status: 401 });
  // Manual modes expose household data or send messages: never allow them without a secret
  const manual = ["groups", "preview", "force"].some((p) => url.searchParams.has(p));
  if (manual && !secret) return json({ ok: false, error: "Set CRON_SECRET in Vercel first" }, 401);

  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = env("SUPABASE_ANON_KEY") ?? env("VITE_SUPABASE_ANON_KEY");
  const timeZone = env("FAMI_TIME_ZONE") ?? "Asia/Jerusalem";
  const now = new Date();

  // WhatsApp sending is opt-in and requires a secret, so nobody else can trigger messages
  const whatsappReady = !!(serviceKey && secret && env("GREEN_API_INSTANCE_ID") && env("GREEN_API_TOKEN"));

  try {
    if (url.searchParams.has("groups")) {
      if (!whatsappReady) return json({ ok: false, error: "Set CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY and GREEN_API_* first" }, 400);
      const res = await greenApi("getContacts");
      const contacts = (await res.json()) as { id: string; name?: string; type?: string }[];
      const groups = contacts.filter((c) => c.type === "group" || c.id.endsWith("@g.us")).map((c) => ({ name: c.name, id: c.id }));
      return json({ ok: res.ok, groups });
    }

    // Without the service key we can still keep Supabase awake with an anonymous query
    if (!serviceKey) {
      if (!anonKey) return json({ ok: false, error: "Missing Supabase keys" }, 500);
      await supabaseGet("household_settings?select=household_id&limit=1", anonKey);
      return json({ ok: true, keepalive: true, whatsapp: "disabled (no SUPABASE_SERVICE_ROLE_KEY)" });
    }

    const households = await supabaseGet<{ id: string }[]>("households?select=id", serviceKey);
    const householdId = env("FAMI_HOUSEHOLD_ID") ?? (households.length === 1 ? households[0].id : undefined);
    if (!householdId) return json({ ok: false, error: "Several households — set FAMI_HOUSEHOLD_ID" }, 500);

    const preview = url.searchParams.has("preview");
    const force = url.searchParams.has("force");
    const hour = localHour(now, timeZone);
    if (!preview && !force && hour !== SEND_HOUR) {
      return json({ ok: true, keepalive: true, skipped: `local hour ${hour}, sends at ${SEND_HOUR}` });
    }
    if (!preview && !whatsappReady) return json({ ok: true, keepalive: true, whatsapp: "not configured" });
    if (!preview && !env("WHATSAPP_GROUP_ID")) return json({ ok: false, error: "Set WHATSAPP_GROUP_ID (see ?groups=1)" }, 400);

    const h = `household_id=eq.${householdId}`;
    const from = new Date(now.getTime() - 86_400_000).toISOString();
    const to = new Date(now.getTime() + 3 * 86_400_000).toISOString();
    const [tasks, events, inventory, users] = await Promise.all([
      supabaseGet<DigestTask[]>(`tasks?${h}&status=in.(todo,in_progress)&select=title,status,module,due_at,scheduled_start_at,assigned_to`, serviceKey),
      supabaseGet<DigestEvent[]>(`appointments?${h}&starts_at=gte.${from}&starts_at=lt.${to}&select=title,starts_at,location,provider_name,status`, serviceKey),
      supabaseGet<DigestStockItem[]>(`inventory?${h}&select=name,quantity,critical_threshold,unit`, serviceKey),
      supabaseGet<{ id: string; display_name: string }[]>(`users?${h}&select=id,display_name`, serviceKey),
    ]);

    const message = buildDigest({
      now, timeZone, tasks, events, inventory,
      members: Object.fromEntries(users.map((u) => [u.id, u.display_name])),
    });
    if (preview) return json({ ok: true, date: localDate(now, timeZone), message });

    const res = await greenApi("sendMessage", { chatId: env("WHATSAPP_GROUP_ID"), message });
    const result = await res.json().catch(() => ({}));
    console.log("daily digest", res.status, result);
    return json({ ok: res.ok, sent: res.ok, result }, res.ok ? 200 : 502);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("daily job failed", error);
    return json({ ok: false, error }, 502);
  }
}
