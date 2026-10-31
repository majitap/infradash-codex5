import { z } from "zod";

export const permissions = [
  "license:read",
  "maintenance:read",
  "maintenance:write",
  "logs:read",
] as const;
export type Permission = (typeof permissions)[number];
export const sessionSchema = z.object({
  source: z.literal("live"),
  actor: z.object({
    name: z.string().max(100),
    role: z.enum(["viewer", "admin"]),
  }),
  permissions: z.array(z.enum(permissions)),
  csrfToken: z.string().min(24).max(256),
  expiresAt: z.string().datetime(),
});
export type OperationsSession = z.infer<typeof sessionSchema>;
export const licenseSchema = z.object({
  source: z.literal("live"),
  state: z.enum(["available", "unconfigured", "forbidden", "error"]),
  collectedAt: z.string().datetime(),
  plan: z.string().max(80).nullable(),
  userLimit: z.number().int().nonnegative().nullable(),
  activeUsers: z.number().int().nonnegative().nullable(),
  expiresAt: z.string().nullable(),
  expired: z.boolean().nullable(),
});
export type LicenseSnapshot = z.infer<typeof licenseSchema>;
export const maintenanceSchema = z.object({
  source: z.enum(["live", "demo"]),
  enabled: z.boolean(),
  message: z.string().max(500),
  revision: z.string().min(1).max(128),
  checkedAt: z.string().datetime(),
  canWrite: z.boolean(),
});
export type MaintenanceSnapshot = z.infer<typeof maintenanceSchema>;
export const maintenanceChangeSchema = z
  .object({
    enabled: z.boolean(),
    message: z.string().trim().max(500),
    expectedRevision: z.string().min(1).max(128),
    reason: z.string().trim().min(3).max(240),
  })
  .strict();
export const integrationsSchema = z.object({
  gitlabLicense: z.boolean(),
  gitlabMaintenance: z.boolean(),
  loki: z.boolean(),
  grafana: z.boolean(),
  tempo: z.boolean(),
  mimir: z.boolean(),
  grafanaUrl: z.string().url().nullable(),
});
export type IntegrationSnapshot = z.infer<typeof integrationsSchema>;
export const logEntrySchema = z.object({
  id: z.string().max(120),
  timestamp: z.string().datetime(),
  level: z.enum(["error", "warn", "info", "debug", "unknown"]),
  service: z.string().max(160),
  message: z.string().max(8192),
  labels: z.record(z.string(), z.string().max(500)),
  traceId: z.string().max(64).nullable(),
});
export type LogEntry = z.infer<typeof logEntrySchema>;
export const logsSchema = z.object({
  source: z.literal("live"),
  queriedAt: z.string().datetime(),
  entries: z.array(logEntrySchema).max(500),
  limited: z.boolean(),
});
export const emptyIntegrations: IntegrationSnapshot = {
  gitlabLicense: false,
  gitlabMaintenance: false,
  loki: false,
  grafana: false,
  tempo: false,
  mimir: false,
  grafanaUrl: null,
};
export const demoMaintenance: MaintenanceSnapshot = {
  source: "demo",
  enabled: false,
  message: "GitLab 정기 점검 중입니다. 잠시 후 다시 이용해 주세요.",
  revision: "demo-0",
  checkedAt: "2026-10-31T01:12:00.000Z",
  canWrite: true,
};
export function licenseRemaining(license: LicenseSnapshot | null) {
  return license?.userLimit !== null &&
    license?.userLimit !== undefined &&
    license.activeUsers !== null
    ? Math.max(0, license.userLimit - license.activeUsers)
    : null;
}
export function safeApiBase(value: string, origin: string) {
  const url = new URL(value, origin);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname))
    )
  )
    throw new Error("invalid_api_url");
  return url.href.replace(/\/+$/, "");
}
export function kstTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}
