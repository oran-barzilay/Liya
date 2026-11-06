import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Dev-only: serve the Vercel edge functions in api/*.ts on localhost, so local
 * development runs exactly the same server code as production.
 */
function devEdgeFunctions(names: string[]): Plugin {
  return {
    name: "dev-edge-functions",
    apply: "serve",
    config(_, { mode }) {
      const env = loadEnv(mode, process.cwd(), "");
      for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;
    },
    configureServer(server) {
      for (const name of names) {
        server.middlewares.use(`/api/${name}`, async (req: IncomingMessage, res: ServerResponse) => {
          try {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(chunk as Buffer);
            const request = new Request(`http://localhost/api/${name}${req.url === "/" ? "" : req.url ?? ""}`, {
              method: req.method,
              headers: Object.entries(req.headers).flatMap(([k, v]) => (typeof v === "string" ? [[k, v] as [string, string]] : [])),
              body: req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(chunks),
            });
            const mod = await server.ssrLoadModule(`/api/${name}.ts`);
            const response: Response = await mod.default(request);
            res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
            res.end(Buffer.from(await response.arrayBuffer()));
          } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
          }
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), devEdgeFunctions(["assistant", "whatsapp"])],
});
