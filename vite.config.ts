import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

function devAssistantPlugin(): Plugin {
  return {
    name: "dev-assistant-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(
        "/api/assistant",
        async (req: IncomingMessage, res: ServerResponse) => {
          // Only handle POST
          if (req.method !== "POST") {
            res.writeHead(405, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Method not allowed" }));
            return;
          }

          try {
            // Read body
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(chunk as Buffer);
            const bodyText = Buffer.concat(chunks).toString("utf8");
            const body = JSON.parse(bodyText || "{}") as {
              message?: string;
              context?: {
                inventory?: unknown[];
                tasks?: unknown[];
              };
            };

            const apiKey =
              process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
            if (!apiKey) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  error: "Missing GOOGLE_AI_API_KEY in .env",
                })
              );
              return;
            }

            const message = String(body.message ?? "").trim();
            if (!message) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "message is required" }));
              return;
            }

            const inventory = Array.isArray(body.context?.inventory)
              ? body.context!.inventory
              : [];
            const tasks = Array.isArray(body.context?.tasks)
              ? body.context!.tasks
              : [];

            const systemInstruction = [
              "You are a Hebrew assistant for a family household app.",
              "You help with shopping list questions and task creation.",
              "Return ONLY valid JSON, no markdown, no extra text.",
              "Schema: { \"reply\": \"string in Hebrew\", \"actions\": [ { \"type\": \"add_inventory_item\" | \"add_task\", \"payload\": { ... } } ] }",
              "For add_inventory_item: name (required), unit, quantity, critical_threshold, notes.",
              "For add_task: title (required), description, task_type (priority|time_sensitive), priority_level (1-5), due_date (YYYY-MM-DD), is_recurring, recurrence_days (0-6 array), recurrence_time (HH:mm).",
              "Only emit actions when user clearly asks to add/create. Otherwise actions = [].",
            ].join("\n");

            const userPrompt = [
              `User message: ${message}`,
              `Inventory (first 50): ${JSON.stringify(inventory.slice(0, 50))}`,
              `Tasks (first 50): ${JSON.stringify(tasks.slice(0, 50))}`,
            ].join("\n\n");

            const geminiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${encodeURIComponent(apiKey)}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [
                    {
                      role: "user",
                      parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }],
                    },
                  ],
                  generationConfig: { temperature: 0.2 },
                }),
              }
            );

            if (!geminiRes.ok) {
              const detail = await geminiRes.text();
              res.writeHead(502, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({ error: "Gemini request failed", detail })
              );
              return;
            }

            const geminiJson = (await geminiRes.json()) as {
              candidates?: Array<{
                content?: { parts?: Array<{ text?: string }> };
              }>;
            };
            const rawText =
              geminiJson.candidates?.[0]?.content?.parts
                ?.map((p) => p.text ?? "")
                .join("\n") ?? "";

            // Strip markdown fences if any
            const jsonStr = (() => {
              const fenced = rawText.match(/```json\s*([\s\S]*?)```/i);
              if (fenced?.[1]) return fenced[1].trim();
              const first = rawText.indexOf("{");
              const last = rawText.lastIndexOf("}");
              if (first >= 0 && last > first) return rawText.slice(first, last + 1);
              return rawText.trim();
            })();

            let parsed: { reply?: string; actions?: unknown[] } | null = null;
            try {
              parsed = JSON.parse(jsonStr);
            } catch {
              /* ignore */
            }

            const reply = (parsed?.reply ?? rawText) || "בוצע.";
            const actions = Array.isArray(parsed?.actions) ? parsed!.actions : [];

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ reply, actions }));
          } catch (err) {
            const detail =
              err instanceof Error ? err.message : "Unknown error";
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Dev handler error", detail }));
          }
        }
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), devAssistantPlugin()],
});
