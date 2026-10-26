export const config = { runtime: "edge" };

/**
 * Keep-alive ping, called daily by the Vercel cron in vercel.json.
 * Free Supabase projects pause after a week without activity; this runs one
 * tiny real database query so the project always counts as active.
 * Users never see it.
 */
export default async function handler(req: Request): Promise<Response> {
  // Vercel sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return Response.json({ ok: false, error: "Missing Supabase env vars" }, { status: 500 });
  }

  const started = Date.now();
  try {
    // A real PostgREST query (RLS may return no rows, but the database still runs it)
    const res = await fetch(`${url}/rest/v1/household_settings?select=household_id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const body = { ok: res.ok, status: res.status, ms: Date.now() - started, at: new Date().toISOString() };
    console.log("keepalive", body);
    return Response.json(body, { status: res.ok ? 200 : 502 });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("keepalive failed", error);
    return Response.json({ ok: false, error }, { status: 502 });
  }
}
