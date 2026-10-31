import { createServer, type IncomingMessage } from "node:http";
import { collectStatus } from "./collect";
import { readConfig } from "./config";
import type { InfraSnapshot } from "../../lib/infra-status";

// Local development only. Production needs an authenticated gateway; never bind this server to 0.0.0.0.
export function isLocalRequest(req: Pick<IncomingMessage, "headers">) {
  return (
    ["localhost:4318", "127.0.0.1:4318"].includes(req.headers.host ?? "") &&
    (!req.headers.origin ||
      ["http://localhost:3000", "http://127.0.0.1:3000"].includes(
        req.headers.origin,
      ))
  );
}
export function startServer(config = readConfig()) {
  let cache: InfraSnapshot | null = null;
  let inFlight: Promise<InfraSnapshot> | null = null;
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Vary", "Origin");
    if (!isLocalRequest(req)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (req.headers.origin) {
      res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET, OPTIONS");
      res.writeHead(405);
      res.end();
      return;
    }
    if (req.url !== "/api/infra/status") {
      res.writeHead(404);
      res.end();
      return;
    }
    try {
      if (!cache || Date.now() - Date.parse(cache.collectedAt) > 15_000) {
        inFlight ??= collectStatus(config)
          .then((data) => (cache = data))
          .finally(() => {
            inFlight = null;
          });
        await inFlight;
      }
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(cache));
    } catch {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "collection_failed" }));
    }
  });
  server.listen(4318, "127.0.0.1", () =>
    console.log(
      "Local read-only collector: http://127.0.0.1:4318/api/infra/status",
    ),
  );
  return server;
}
