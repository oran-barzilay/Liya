export const config = { runtime: "edge" };

type AssistantRequest = {
  message?: string;
  model?: string;
  context?: {
    inventory?: Array<Record<string, unknown>>;
    tasks?: Array<Record<string, unknown>>;
    appointments?: Array<Record<string, unknown>>;
  };
};

const MODEL_CANDIDATES = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.5-pro"];

type GoogleModel = {
  name?: string;
  supportedGenerationMethods?: string[];
};

function parseGeminiVersion(model: string): { major: number; minor: number } {
  const match = model.match(/gemini-(\d+)(?:\.(\d+))?/i);
  return {
    major: match?.[1] ? Number(match[1]) : 0,
    minor: match?.[2] ? Number(match[2]) : 0,
  };
}

function rankModelForSpeedAndFreshness(model: string): number {
  const normalized = model.toLowerCase();
  const { major, minor } = parseGeminiVersion(normalized);
  const versionScore = major * 100 + minor;
  const isFlash = normalized.includes("-flash");
  const isPro = normalized.includes("-pro");
  const isPreview = normalized.includes("preview") || normalized.includes("exp");

  let score = versionScore;
  if (isFlash) score += 10_000;
  if (isPro) score -= 500;
  if (isPreview) score -= 5;
  return score;
}

function getRecommendedModel(models: string[]): string {
  const sorted = [...models].sort((a, b) => rankModelForSpeedAndFreshness(b) - rankModelForSpeedAndFreshness(a));
  return sorted[0] ?? MODEL_CANDIDATES[0];
}

function normalizeModelName(name: string): string {
  return name.startsWith("models/") ? name.slice("models/".length) : name;
}

function buildModelOrder(preferredModel: string | null, availableModels: string[]): string[] {
  const unique = new Set<string>();
  const recommendedModel = getRecommendedModel(availableModels.length ? availableModels : MODEL_CANDIDATES);
  const ordered = [preferredModel, recommendedModel, ...availableModels, ...MODEL_CANDIDATES].filter(Boolean) as string[];
  for (const model of ordered) {
    unique.add(normalizeModelName(model));
  }
  return Array.from(unique);
}

async function fetchAvailableGeminiModels(apiKey: string): Promise<string[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    { method: "GET" }
  );
  if (!res.ok) return MODEL_CANDIDATES;
  const data = (await res.json()) as { models?: GoogleModel[] };
  const list = (data.models ?? [])
    .filter((m) => m.name && (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m) => normalizeModelName(String(m.name)))
    .filter((name) => name.startsWith("gemini-"));
  return list.length ? list : MODEL_CANDIDATES;
}

function isTransientModelError(status: number, detail: string): boolean {
  return (
    status === 429 ||
    status === 503 ||
    detail.includes("high demand") ||
    detail.includes("UNAVAILABLE") ||
    detail.includes("temporarily")
  );
}

function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function extractJson(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text.trim();
}

async function requestGeminiWithFallback(
  apiKey: string,
  body: string,
  preferredModel: string | null,
  availableModels: string[]
): Promise<Response> {
  let lastDetail = "No Gemini response";
  const modelOrder = buildModelOrder(preferredModel, availableModels);

  for (const model of modelOrder) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }
    );

    if (res.ok) return res;

    const detail = await res.text();
    lastDetail = `${model}: ${detail}`;
    const shouldTryNext =
      res.status === 404 ||
      isTransientModelError(res.status, detail) ||
      detail.includes("no longer available") ||
      detail.includes("is not found") ||
      detail.includes("not supported");

    if (!shouldTryNext) {
      throw new Error(lastDetail);
    }
  }

  throw new Error(lastDetail);
}

export default async function handler(req: Request): Promise<Response> {
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "Missing server key",
          detail: "Set GOOGLE_AI_API_KEY (or GEMINI_API_KEY) in Vercel project environment variables.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (req.method === "GET") {
      const models = await fetchAvailableGeminiModels(apiKey).catch(() => MODEL_CANDIDATES);
      const defaultModel = getRecommendedModel(models);
      return new Response(JSON.stringify({ models, defaultModel, recommendedModel: defaultModel }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as AssistantRequest;
    const message = String(body.message ?? "").trim();
    const preferredModel = String(body.model ?? "").trim() || null;
    if (!message) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const inventory = Array.isArray(body.context?.inventory) ? body.context?.inventory : [];
    const tasks = Array.isArray(body.context?.tasks) ? body.context?.tasks : [];
    const appointments = Array.isArray(body.context?.appointments) ? body.context?.appointments : [];
    const availableModels = await fetchAvailableGeminiModels(apiKey).catch(() => MODEL_CANDIDATES);

    const systemInstruction = [
    "You are a Hebrew assistant for a family household app.",
    "You help with shopping list questions, task management, and calendar events.",
    "Return ONLY valid JSON, no markdown.",
    "Schema:",
    "{",
    '  "reply": "string in Hebrew",',
    '  "actions": [',
    "    {",
    '      "type": "add_inventory_item" | "add_task" | "add_event" | "shift_task_schedule" | "shift_event_schedule",',
    '      "payload": { ... }',
    "    }",
    "  ]",
    "}",
    "For add_inventory_item payload keys: name (required), unit (optional), quantity (optional number), critical_threshold (optional number), notes (optional).",
    "For add_task payload keys: title (required), description (optional), task_type (optional: priority|time_sensitive), priority_level (optional 1-5), due_date (optional YYYY-MM-DD), due_time (optional HH:mm), is_recurring (optional boolean), recurrence_days (optional array of 0-6), recurrence_time (optional HH:mm).",
    "For add_event payload keys: title (required), date (required YYYY-MM-DD), time (optional HH:mm), provider_name (optional), location (optional), notes (optional), status (optional scheduled|completed|cancelled).",
    "For shift_task_schedule payload keys: title (required), hours_delta (optional number), months_delta (optional number). Match by title from task context (prefer closest upcoming unfinished task).",
    "For shift_event_schedule payload keys: title (required), hours_delta (optional number), months_delta (optional number). Match by title from appointments context (prefer closest upcoming event).",
    "Only emit actions when user clearly asks to add/create/update/shift.",
    "If user asks informational question, actions should be empty and reply should answer based on context.",
    "Do not invent inventory items, tasks, or events that are not in context when answering questions.",
  ].join("\n");

    const userPrompt = [
    `User message: ${message}`,
    `Inventory context (first 200): ${JSON.stringify(inventory.slice(0, 200))}`,
    `Tasks context (first 200): ${JSON.stringify(tasks.slice(0, 200))}`,
    `Appointments context (first 200): ${JSON.stringify(appointments.slice(0, 200))}`,
  ].join("\n\n");

    const geminiRes = await requestGeminiWithFallback(
      apiKey,
      JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }] }],
        generationConfig: { temperature: 0.2 },
      }),
      preferredModel,
      availableModels
    );

    const geminiJson = (await geminiRes.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text = geminiJson.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n") ?? "";
    const parsed = safeJsonParse<{ reply?: string; actions?: Array<{ type?: string; payload?: Record<string, unknown> }> }>(extractJson(text));

    if (!parsed) {
      return new Response(JSON.stringify({ reply: text || "לא הצלחתי להבין, נסה לנסח אחרת.", actions: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
    return new Response(JSON.stringify({ reply: parsed.reply ?? "בוצע.", actions }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown server error";
    const status = detail.includes("UNAVAILABLE") || detail.includes("high demand") ? 503 : 500;
    return new Response(JSON.stringify({ error: "Assistant server failure", detail }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
