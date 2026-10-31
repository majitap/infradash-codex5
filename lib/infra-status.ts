import { z } from "zod";

export const checkIds = [
  "gitlab-web",
  "gitlab-api",
  "gitlab-readiness",
  "eks",
  "workloads",
] as const;
export const checkLabels: Record<(typeof checkIds)[number], string> = {
  "gitlab-web": "GitLab 웹 접속",
  "gitlab-api": "API 인증·응답",
  "gitlab-readiness": "GitLab 내부 서비스",
  eks: "EKS 제어 영역",
  workloads: "GitLab HA 구성",
};
export const healthStates = [
  "healthy",
  "degraded",
  "down",
  "unknown",
  "forbidden",
] as const;
export type HealthState = (typeof healthStates)[number];
export const stateLabels: Record<HealthState, string> = {
  healthy: "정상",
  degraded: "주의",
  down: "이상",
  unknown: "확인 불가",
  forbidden: "권한 확인",
};
export const checkSchema = z.object({
  id: z.enum(checkIds),
  state: z.enum(healthStates),
  message: z.string().max(240),
  checkedAt: z.string().datetime().nullable(),
  latencyMs: z.number().nonnegative().max(300_000).nullable(),
});
export const infraSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.literal("live"),
  collectedAt: z.string().datetime(),
  checks: z
    .array(checkSchema)
    .length(checkIds.length)
    .refine(
      (checks) => new Set(checks.map((c) => c.id)).size === checkIds.length,
      "Every check must appear exactly once",
    ),
  workloads: z
    .array(
      z.object({
        component: z.string().min(1).max(80),
        desired: z.number().int().nonnegative(),
        ready: z.number().int().nonnegative(),
        current: z.boolean(),
      }),
    )
    .max(100),
});
export type InfraCheck = z.infer<typeof checkSchema>;
export type InfraSnapshot = z.infer<typeof infraSnapshotSchema>;
export const staleAfterMs = 120_000;
export function isStale(snapshot: InfraSnapshot, now = Date.now()) {
  const collected = Date.parse(snapshot.collectedAt);
  return (
    collected > now + 30_000 ||
    now - collected > staleAfterMs ||
    snapshot.checks.some(
      (check) =>
        !check.checkedAt ||
        Math.abs(collected - Date.parse(check.checkedAt)) > staleAfterMs,
    )
  );
}
export function overallState(checks: InfraCheck[]): HealthState {
  if (checks.some((c) => c.state === "down")) return "down";
  if (checks.some((c) => c.state === "degraded")) return "degraded";
  if (checks.some((c) => c.state === "forbidden")) return "forbidden";
  if (
    checks.length !== checkIds.length ||
    new Set(checks.map((c) => c.id)).size !== checkIds.length ||
    checks.some((c) => c.state === "unknown")
  )
    return "unknown";
  return "healthy";
}
export function unconfiguredChecks(): InfraCheck[] {
  return checkIds.map((id) => ({
    id,
    state: "unknown",
    message: "수집기 연동 후 확인할 수 있어요.",
    checkedAt: null,
    latencyMs: null,
  }));
}
