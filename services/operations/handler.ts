import { timingSafeEqual } from "node:crypto";
import { maintenanceChangeSchema, type Permission } from "../../lib/operations";
import type { OperationsConfig } from "./config";
import {
  collectLicense,
  collectMaintenance,
  gitlabRequest,
  UpstreamError,
} from "./gitlab";
import { queryLogs } from "./loki";

export type OperationsIdentity = {
  id: string;
  name: string;
  role: "admin" | "viewer";
  permissions: Permission[];
  csrfToken: string;
  expiresAt: string;
};
export type AuditEvent = {
  actorId: string;
  action: "maintenance.enable" | "maintenance.disable";
  outcome: "requested" | "verified" | "failed";
  reason: string;
  at: string;
};
type Dependencies = {
  authorize?: (request: Request) => Promise<OperationsIdentity | null>;
  audit?: (event: AuditEvent) => Promise<void>;
  fetch?: typeof fetch;
};
const matches = (a: string, b: string) =>
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
async function smallJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new UpstreamError("invalid_body", 400);
  const parts: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > 4096) {
      await reader.cancel();
      throw new UpstreamError("body_too_large", 413);
    }
    parts.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch {
    throw new UpstreamError("invalid_body", 400);
  }
}

/** Mount behind a real SSO gateway. No identity is inferred from browser-controlled headers. */
export function createOperationsHandler(
  config: OperationsConfig,
  deps: Dependencies = {},
) {
  const fetcher = deps.fetch ?? fetch;
  let writing = false;
  return async function handle(request: Request): Promise<Response> {
    const origin = request.headers.get("origin");
    const headers: Record<string, string> = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      Vary: "Origin",
    };
    const reply = (status: number, data: unknown) =>
      new Response(JSON.stringify(data), { status, headers });
    if (origin && !config.allowedOrigins.includes(origin))
      return reply(403, { code: "origin_denied" });
    if (origin) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Credentials"] = "true";
    }
    if (request.method === "OPTIONS") {
      headers["Access-Control-Allow-Methods"] = "GET, PUT, OPTIONS";
      headers["Access-Control-Allow-Headers"] = "Content-Type, X-CSRF-Token";
      return new Response(null, { status: 204, headers });
    }
    try {
      const identity = await deps.authorize?.(request);
      if (
        !identity ||
        Date.parse(identity.expiresAt) <= Date.now() ||
        !Number.isFinite(Date.parse(identity.expiresAt))
      )
        return reply(401, { code: "authentication_required" });
      const url = new URL(request.url),
        mount = "/api/operations";
      if (!url.pathname.startsWith(mount + "/"))
        return reply(404, { code: "not_found" });
      const route = url.pathname.slice(mount.length);
      const has = (permission: Permission) =>
        identity.permissions.includes(permission);
      if (request.method === "GET" && route === "/session")
        return reply(200, {
          source: "live",
          actor: { name: identity.name, role: identity.role },
          permissions: identity.permissions,
          csrfToken: identity.csrfToken,
          expiresAt: identity.expiresAt,
        });
      if (request.method === "GET" && route === "/integrations")
        return reply(200, {
          gitlabLicense: !!config.gitlabBaseUrl && !!config.licenseToken,
          gitlabMaintenance:
            !!config.gitlabBaseUrl && !!config.maintenanceReadToken,
          loki: !!config.lokiUrl,
          grafana: !!config.grafanaUrl,
          tempo: !!config.tempoUrl,
          mimir: !!config.mimirUrl,
          grafanaUrl: config.grafanaUrl ?? null,
        });
      if (request.method === "GET" && route === "/license") {
        if (!has("license:read"))
          return reply(403, { code: "permission_denied" });
        return reply(200, await collectLicense(config, fetcher));
      }
      if (request.method === "GET" && route === "/maintenance") {
        if (!has("maintenance:read"))
          return reply(403, { code: "permission_denied" });
        return reply(
          200,
          await collectMaintenance(
            config,
            identity.role === "admin" &&
              has("maintenance:write") &&
              !!deps.audit,
            fetcher,
          ),
        );
      }
      if (request.method === "GET" && route === "/logs") {
        if (!has("logs:read")) return reply(403, { code: "permission_denied" });
        return reply(200, await queryLogs(config, url.searchParams, fetcher));
      }
      if (request.method === "PUT" && route === "/maintenance") {
        if (
          identity.role !== "admin" ||
          !has("maintenance:write") ||
          !has("maintenance:read")
        )
          return reply(403, { code: "permission_denied" });
        if (
          !origin ||
          !matches(
            request.headers.get("X-CSRF-Token") ?? "",
            identity.csrfToken,
          ) ||
          !request.headers.get("Content-Type")?.startsWith("application/json")
        )
          return reply(403, { code: "csrf_required" });
        if (
          !deps.audit ||
          !config.maintenanceWriteToken ||
          !config.maintenanceReadToken
        )
          return reply(503, { code: "maintenance_write_not_configured" });
        const parsed = maintenanceChangeSchema.safeParse(
          await smallJson(request),
        );
        if (!parsed.success) return reply(400, { code: "invalid_change" });
        if (writing) return reply(409, { code: "change_in_progress" });
        writing = true;
        const change = parsed.data;
        const action = change.enabled
          ? "maintenance.enable"
          : "maintenance.disable";
        const audit = (outcome: AuditEvent["outcome"]) =>
          deps.audit!({
            actorId: identity.id,
            action,
            outcome,
            reason: change.reason,
            at: new Date().toISOString(),
          });
        try {
          const current = await collectMaintenance(config, true, fetcher);
          if (current.revision !== change.expectedRevision)
            return reply(409, { code: "state_changed" });
          await audit("requested");
          await gitlabRequest(
            config,
            "application/settings",
            config.maintenanceWriteToken,
            fetcher,
            {
              maintenance_mode: change.enabled,
              maintenance_mode_message: change.message,
            },
          );
          const verified = await collectMaintenance(config, true, fetcher);
          if (
            verified.enabled !== change.enabled ||
            verified.message !== change.message
          )
            throw new UpstreamError("verification_failed", 503);
          await audit("verified");
          return reply(200, verified);
        } catch (error) {
          try {
            await audit("failed");
          } catch {}
          throw error;
        } finally {
          writing = false;
        }
      }
      return reply(["GET", "PUT"].includes(request.method) ? 404 : 405, {
        code: "not_found",
      });
    } catch (error) {
      return reply(error instanceof UpstreamError ? error.status : 503, {
        code:
          error instanceof UpstreamError ? error.code : "operation_unavailable",
      });
    }
  };
}
