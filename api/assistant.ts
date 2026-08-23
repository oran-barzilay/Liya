export const config = { runtime: "edge" };

type AssistantRequest = {
  message?: string;
  context?: {
    inventory?: Array<Record<string, unknown>>;
    tasks?: Array<Record<string, unknown>>;
  };
};

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

export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

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

    const body = (await req.json().catch(() => ({}))) as AssistantRequest;
    const message = String(body.message ?? "").trim();
    if (!message) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const inventory = Array.isArray(body.context?.inventory) ? body.context?.inventory : [];
    const tasks = Array.isArray(body.context?.tasks) ? body.context?.tasks : [];

    const systemInstruction = [
    "You are a Hebrew assistant for a family household app.",
    "You help with shopping list questions and task creation suggestions.",
    "Return ONLY valid JSON, no markdown.",
    "Schema:",
    "{",
    '  "reply": "string in Hebrew",',
    '  "actions": [',
    "    {",
    '      "type": "add_inventory_item" | "add_task",',
    '      "payload": { ... }',
    "    }",
    "  ]",
    "}",
    "For add_inventory_item payload keys: name (required), unit (optional), quantity (optional number), critical_threshold (optional number), notes (optional).",
    "For add_task payload keys: title (required), description (optional), task_type (optional: priority|time_sensitive), priority_level (optional 1-5), due_date (optional YYYY-MM-DD), is_recurring (optional boolean), recurrence_days (optional array of 0-6), recurrence_time (optional HH:mm).",
    "Only emit actions when user clearly asks to add/create.",
    "If user asks informational question, actions should be empty and reply should answer based on context.",
    "Do not invent inventory items or tasks that are not in context when answering questions.",
  ].join("\n");

    const userPrompt = [
    `User message: ${message}`,
    `Inventory context (first 200): ${JSON.stringify(inventory.slice(0, 200))}`,
    `Tasks context (first 200): ${JSON.stringify(tasks.slice(0, 200))}`,
  ].join("\n\n");

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }] }],
          generationConfig: { temperature: 0.2 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const detail = await geminiRes.text();
      return new Response(JSON.stringify({ error: "Gemini request failed", detail }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

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
    return new Response(JSON.stringify({ error: "Assistant server failure", detail }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

