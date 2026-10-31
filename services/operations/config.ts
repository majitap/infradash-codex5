export type OperationsConfig = {
  gitlabBaseUrl?: string;
  licenseToken?: string;
  maintenanceReadToken?: string;
  maintenanceWriteToken?: string;
  lokiUrl?: string;
  lokiBearerToken?: string;
  lokiUsername?: string;
  lokiPassword?: string;
  lokiTenantId?: string;
  grafanaUrl?: string;
  tempoUrl?: string;
  mimirUrl?: string;
  allowedOrigins: string[];
  timeoutMs: number;
};
function serverUrl(value: string | undefined) {
  if (!value?.trim()) return undefined;
  const url = new URL(value.trim());
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Server endpoints must be HTTPS without embedded credentials, query or fragment",
    );
  return url.href.replace(/\/+$/, "");
}
export function readOperationsConfig(
  env: Record<string, string | undefined> = process.env,
): OperationsConfig {
  const allowedOrigins = (env.OPERATIONS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  for (const origin of allowedOrigins) {
    const u = new URL(origin);
    if (
      u.origin !== origin ||
      !(
        u.protocol === "https:" ||
        (u.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(u.hostname))
      )
    )
      throw new Error("Invalid operations origin");
  }
  if (env.LOKI_BEARER_TOKEN && env.LOKI_USERNAME)
    throw new Error("Choose bearer OR basic authentication for Loki");
  if (!!env.LOKI_USERNAME !== !!env.LOKI_PASSWORD)
    throw new Error("Both Loki basic authentication fields are required");
  if (env.LOKI_TENANT_ID && /[\r\n|]/.test(env.LOKI_TENANT_ID))
    throw new Error("Only one Loki tenant is allowed");
  return {
    gitlabBaseUrl: serverUrl(env.GITLAB_BASE_URL),
    licenseToken: env.GITLAB_LICENSE_READ_TOKEN,
    maintenanceReadToken: env.GITLAB_MAINTENANCE_READ_TOKEN,
    maintenanceWriteToken: env.GITLAB_MAINTENANCE_WRITE_TOKEN,
    lokiUrl: serverUrl(env.LOKI_URL),
    lokiBearerToken: env.LOKI_BEARER_TOKEN,
    lokiUsername: env.LOKI_USERNAME,
    lokiPassword: env.LOKI_PASSWORD,
    lokiTenantId: env.LOKI_TENANT_ID,
    grafanaUrl: serverUrl(env.GRAFANA_URL),
    tempoUrl: serverUrl(env.TEMPO_URL),
    mimirUrl: serverUrl(env.MIMIR_URL),
    allowedOrigins,
    timeoutMs: 8000,
  };
}
