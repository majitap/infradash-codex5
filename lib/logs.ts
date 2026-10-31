import type { LogEntry } from "./operations";
export const levelNames = {
  error: "오류",
  warn: "경고",
  info: "정보",
  debug: "디버그",
  unknown: "미분류",
};
export function filterLogs(
  entries: LogEntry[],
  service: string,
  level: string,
  text: string,
) {
  const q = text.toLowerCase().trim();
  return entries.filter(
    (e) =>
      (service === "all" || e.service === service) &&
      (level === "all" || e.level === level) &&
      (!q ||
        `${e.message} ${e.service} ${e.traceId ?? ""}`
          .toLowerCase()
          .includes(q)),
  );
}
export function logBuckets(
  entries: LogEntry[],
  start: number,
  end: number,
  count = 24,
) {
  const buckets = Array.from({ length: count }, () => ({
    total: 0,
    errors: 0,
  }));
  for (const entry of entries) {
    const t = Date.parse(entry.timestamp);
    if (t < start || t > end) continue;
    const bucket = Math.min(
      count - 1,
      Math.floor(((t - start) / (end - start)) * count),
    );
    buckets[bucket].total++;
    if (entry.level === "error") buckets[bucket].errors++;
  }
  return buckets;
}
export function makeDemoLogs(
  end = Date.now(),
  duration = 15 * 60 * 1000,
): LogEntry[] {
  const samples: [string, LogEntry["level"], string][] = [
    ["webservice", "info", "GET /api/v4/projects · 200 OK · 42ms"],
    [
      "sidekiq",
      "info",
      "PipelineProcessWorker completed · queue=default · 86ms",
    ],
    ["gitaly", "warn", "Repository RPC duration above threshold · 1240ms"],
    ["webservice", "info", "GET /users/sign_in · 200 OK · 18ms"],
    ["runner", "error", "Job #1842 failed · executor timeout after 180s"],
    ["gitaly", "info", "Repository storage health check passed"],
    ["sidekiq", "debug", "Queue latency sample · queue=default · 0.12s"],
    [
      "webservice",
      "error",
      "POST /api/v4/jobs/request · 503 Service Unavailable",
    ],
    ["runner", "info", "Job #1843 completed · duration=64s"],
    ["sidekiq", "warn", "Retry scheduled · attempt=2 · backoff=30s"],
    ["webservice", "info", "GET /-/readiness · 200 OK · 8ms"],
    ["runner", "info", "Runner heartbeat accepted · active_jobs=4"],
  ];
  return Array.from({ length: 96 }, (_, i) => {
    const [service, level, message] = samples[i % samples.length];
    return {
      id: `demo-${i}`,
      timestamp: new Date(end - (i * duration) / 96).toISOString(),
      service,
      level,
      message,
      labels: {
        namespace: "gitlab-demo",
        app: service,
        pod: `${service}-demo-01`,
      },
      traceId:
        i % 3 === 0
          ? `0af7651916cd43dd8448eb211c80${String(i).padStart(6, "0")}`
          : null,
    };
  });
}
