import {
  MODEL_CANDIDATES, askAssistant, executeActions, fetchAvailableGeminiModels, getRecommendedModel, loadContext, makeDb,
} from "./_assistant";

export const config = { runtime: "edge" };

/**
 * In-app chat.
 *   GET  → available Gemini models.
 *   POST {message, model?} with the user's Supabase access token → the assistant reads the
 *        household data and performs the requested changes *as that user* (RLS applies),
 *        returning {reply, actions, results}.
 */

const json = (body: unknown, status = 200) => Response.json(body, { status });
const env = (name: string) => process.env[name]?.trim() || undefined;

export default async function handler(req: Request): Promise<Response> {
  try {
    const apiKey = env("GOOGLE_AI_API_KEY") ?? env("GEMINI_API_KEY");
    if (!apiKey) {
      return json({ error: "Missing server key", detail: "Set GOOGLE_AI_API_KEY (or GEMINI_API_KEY) in Vercel project environment variables." }, 500);
    }

    if (req.method === "GET") {
      const models = await fetchAvailableGeminiModels(apiKey).catch(() => MODEL_CANDIDATES);
      const defaultModel = getRecommendedModel(models);
      return json({ models, defaultModel, recommendedModel: defaultModel });
    }
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const supabaseUrl = env("SUPABASE_URL") ?? env("VITE_SUPABASE_URL");
    const anonKey = env("SUPABASE_ANON_KEY") ?? env("VITE_SUPABASE_ANON_KEY");
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!supabaseUrl || !anonKey || !token) return json({ error: "Not signed in" }, 401);

    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } });
    const user = userRes.ok ? ((await userRes.json()) as { id?: string }) : null;
    if (!user?.id) return json({ error: "Not signed in" }, 401);

    // Acts with the user's own token: row-level security limits it to their household
    const db = makeDb(supabaseUrl, anonKey, token);
    const [me] = await db<{ household_id: string; display_name: string }[]>(`users?id=eq.${user.id}&select=household_id,display_name`);
    if (!me) return json({ error: "No household" }, 403);

    const body = (await req.json().catch(() => ({}))) as { message?: string; model?: string; timeZone?: string };
    const message = String(body.message ?? "").trim();
    if (!message) return json({ error: "message is required" }, 400);
    const timeZone = body.timeZone || "Asia/Jerusalem";

    const context = await loadContext(db, me.household_id);
    const { reply, actions } = await askAssistant({
      apiKey, message, context, timeZone, model: body.model || null, sender: me.display_name, channel: "app",
    });
    const results = await executeActions({ db, householdId: me.household_id, actorId: user.id, timeZone, context }, actions);
    return json({ reply, actions, results });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown server error";
    const status = detail.includes("UNAVAILABLE") || detail.includes("high demand") ? 503 : 500;
    return json({ error: "Assistant server failure", detail }, status);
  }
}
