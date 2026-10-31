import {
  logEntrySchema,
  logsSchema,
  type LogEntry,
} from "../../lib/operations";
import { UpstreamError } from "./gitlab";
import type { OperationsConfig } from "./config";
export function redactLog(text: string) {
  return text
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]")
    .replace(
      /((?:private[-_]?token|access[-_]?token|password|client[-_]?secret|authorization)\s*[=:]\s*["']?)[^\s,"';}]+/gi,
      "$1[REDACTED]",
    );
}
export function validateLogQuery(params: URLSearchParams, now = Date.now()) {
  const query = params.get("query") ?? "";
  const start = Number(params.get("start")),
    end = Number(params.get("end"));
  const limit = Number(params.get("limit") ?? 200);
  if (
    query.length > 2000 ||
    !/^\s*\{[^}]+\}/.test(query) ||
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end <= start ||
    end - start > 6 * 60 * 60 * 1000 ||
    end > now + 30_000 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 500
  )
    throw new UpstreamError("invalid_log_query", 400);
  return { query, start, end, limit };
}
export async function queryLogs(
  config: OperationsConfig,
  params: URLSearchParams,
  fetcher: typeof fetch = fetch,
) {
  const { query, start, end, limit } = validateLogQuery(params);
  if (!config.lokiUrl) throw new UpstreamError("loki_not_configured", 503);
  const url = new URL(`${config.lokiUrl}/loki/api/v1/query_range`);
  url.search = new URLSearchParams({
    query,
    start: String(BigInt(start) * BigInt(1_000_000)),
    end: String(BigInt(end) * BigInt(1_000_000)),
    limit: String(limit),
    direction: "backward",
  }).toString();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (config.lokiBearerToken)
    headers.Authorization = `Bearer ${config.lokiBearerToken}`;
  if (config.lokiUsername && config.lokiPassword)
    headers.Authorization = `Basic ${Buffer.from(`${config.lokiUsername}:${config.lokiPassword}`).toString("base64")}`;
  if (config.lokiTenantId) headers["X-Scope-OrgID"] = config.lokiTenantId;
  const response = await fetcher(url, {
    headers,
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (!response.ok)
    throw new UpstreamError(
      response.status === 401 || response.status === 403
        ? "loki_permission"
        : "loki_failed",
      response.status === 401 || response.status === 403 ? 403 : 502,
    );
  const raw = await response.json();
  if (
    raw.status !== "success" ||
    raw.data?.resultType !== "streams" ||
    !Array.isArray(raw.data.result)
  )
    throw new UpstreamError("log_streams_required", 400);
  const entries: LogEntry[] = [];
  let index = 0;
  for (const stream of raw.data.result) {
    if (!stream || !stream.stream || !Array.isArray(stream.values))
      throw new UpstreamError("invalid_loki_response");
    const labels = Object.fromEntries(
      Object.entries(stream.stream)
        .filter(
          ([key, v]) =>
            [
              "app",
              "service_name",
              "namespace",
              "pod",
              "container",
              "job",
              "level",
              "severity",
              "trace_id",
            ].includes(key) && typeof v === "string",
        )
        .map(([k, v]) => [k, redactLog(String(v)).slice(0, 500)]),
    );
    for (const value of stream.values) {
      if (entries.length >= limit) break;
      if (
        !Array.isArray(value) ||
        typeof value[0] !== "string" ||
        !/^\d{16,20}$/.test(value[0]) ||
        typeof value[1] !== "string"
      )
        throw new UpstreamError("invalid_loki_response");
      let fields: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(value[1]);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
          fields = parsed;
      } catch {}
      const rawLevel = String(
        labels.level ??
          labels.severity ??
          fields.level ??
          fields.severity ??
          "",
      ).toLowerCase();
      const level: LogEntry["level"] =
        rawLevel === "warning"
          ? "warn"
          : ["error", "warn", "info", "debug"].includes(rawLevel)
            ? (rawLevel as LogEntry["level"])
            : "unknown";
      const trace = String(
        fields.trace_id ?? fields.traceID ?? labels.trace_id ?? "",
      );
      const timestamp = new Date(
        Number(BigInt(value[0]) / BigInt(1_000_000)),
      ).toISOString();
      entries.push(
        logEntrySchema.parse({
          id: `${value[0]}-${index++}`,
          timestamp,
          level,
          service: labels.service_name ?? labels.app ?? labels.job ?? "unknown",
          message: redactLog(value[1]).slice(0, 8192),
          labels,
          traceId: /^[a-f\d]{16,32}$/i.test(trace) ? trace : null,
        }),
      );
    }
  }
  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return logsSchema.parse({
    source: "live",
    queriedAt: new Date().toISOString(),
    entries,
    limited: entries.length >= limit,
  });
}
