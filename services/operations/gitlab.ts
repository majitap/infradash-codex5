import { createHash } from "node:crypto";
import {
  licenseSchema,
  maintenanceSchema,
  type LicenseSnapshot,
} from "../../lib/operations";
import type { OperationsConfig } from "./config";
export class UpstreamError extends Error {
  constructor(
    public code: string,
    public status = 502,
  ) {
    super(code);
  }
}
export async function gitlabRequest(
  config: OperationsConfig,
  path: string,
  token: string | undefined,
  fetcher: typeof fetch,
  body?: { maintenance_mode: boolean; maintenance_mode_message: string },
) {
  if (!config.gitlabBaseUrl || !token)
    throw new UpstreamError("not_configured", 503);
  const response = await fetcher(`${config.gitlabBaseUrl}/api/v4/${path}`, {
    method: body ? "PUT" : "GET",
    headers: {
      Accept: "application/json",
      "PRIVATE-TOKEN": token,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (!response.ok)
    throw new UpstreamError(
      response.status === 401 || response.status === 403
        ? "upstream_permission"
        : "upstream_failed",
      response.status === 401 || response.status === 403 ? 403 : 502,
    );
  return response.json() as Promise<Record<string, unknown>>;
}
const count = (v: unknown) =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null;
export async function collectLicense(
  config: OperationsConfig,
  fetcher: typeof fetch = fetch,
): Promise<LicenseSnapshot> {
  const base = {
    source: "live" as const,
    collectedAt: new Date().toISOString(),
    plan: null,
    userLimit: null,
    activeUsers: null,
    expiresAt: null,
    expired: null,
  };
  if (!config.gitlabBaseUrl || !config.licenseToken)
    return { ...base, state: "unconfigured" };
  try {
    const data = await gitlabRequest(
      config,
      "license",
      config.licenseToken,
      fetcher,
    );
    return licenseSchema.parse({
      ...base,
      state: "available",
      plan: typeof data.plan === "string" ? data.plan : null,
      userLimit: count(data.user_limit),
      activeUsers: count(data.active_users),
      expiresAt:
        typeof data.expires_at === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(data.expires_at)
          ? data.expires_at
          : null,
      expired: typeof data.expired === "boolean" ? data.expired : null,
    });
  } catch (error) {
    return {
      ...base,
      state:
        error instanceof UpstreamError && error.status === 403
          ? "forbidden"
          : "error",
    };
  }
}
export async function collectMaintenance(
  config: OperationsConfig,
  canWrite: boolean,
  fetcher: typeof fetch = fetch,
) {
  const data = await gitlabRequest(
    config,
    "application/settings",
    config.maintenanceReadToken,
    fetcher,
  );
  if (typeof data.maintenance_mode !== "boolean")
    throw new UpstreamError("maintenance_unavailable", 503);
  if (
    typeof data.maintenance_mode_message === "string" &&
    data.maintenance_mode_message.length > 500
  )
    throw new UpstreamError("maintenance_message_too_long", 503);
  const message =
    typeof data.maintenance_mode_message === "string"
      ? data.maintenance_mode_message
      : "";
  const revision = createHash("sha256")
    .update(JSON.stringify([data.maintenance_mode, message]))
    .digest("hex");
  return maintenanceSchema.parse({
    source: "live",
    enabled: data.maintenance_mode,
    message,
    revision,
    checkedAt: new Date().toISOString(),
    canWrite: canWrite && !!config.maintenanceWriteToken,
  });
}
