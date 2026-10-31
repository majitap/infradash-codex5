import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DescribeClusterCommand, EKSClient } from "@aws-sdk/client-eks";
import {
  infraSnapshotSchema,
  type InfraCheck,
  type InfraSnapshot,
} from "../../lib/infra-status";
import type { CollectorConfig } from "./config";

const run = promisify(execFile);
type ClusterInfo = { status?: string; endpoint?: string };
type Dependencies = {
  fetch: typeof fetch;
  describeCluster: (config: CollectorConfig) => Promise<ClusterInfo>;
  kubectl: (args: string[], timeoutMs: number) => Promise<string>;
};
const defaults: Dependencies = {
  fetch: globalThis.fetch,
  describeCluster: async (config) => {
    const client = new EKSClient({ region: config.awsRegion, maxAttempts: 1 });
    try {
      const response = await client.send(
        new DescribeClusterCommand({ name: config.eksClusterName }),
        { abortSignal: AbortSignal.timeout(config.timeoutMs) },
      );
      return {
        status: response.cluster?.status,
        endpoint: response.cluster?.endpoint,
      };
    } finally {
      client.destroy();
    }
  },
  kubectl: async (args, timeoutMs) =>
    (
      await run("kubectl", args, {
        timeout: timeoutMs + 1000,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
      })
    ).stdout,
};

function permissionError(error: unknown) {
  return (
    /AccessDenied|Forbidden|Unauthorized/i.test(
      String((error as { name?: string })?.name),
    ) ||
    /forbidden|unauthorized/i.test(
      String((error as { stderr?: string })?.stderr ?? ""),
    )
  );
}
function readinessState(body: unknown): "healthy" | "down" | "unknown" {
  if (!body || typeof body !== "object" || Array.isArray(body))
    return "unknown";
  const obj = body as Record<string, unknown>;
  if (!Object.keys(obj).some((key) => /db|database|redis|gitaly/i.test(key)))
    return "unknown";
  const statuses: string[] = [];
  function visit(value: unknown) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object")
      for (const [key, item] of Object.entries(value)) {
        if (key === "status" && typeof item === "string") statuses.push(item);
        else visit(item);
      }
  }
  visit(body);
  if (statuses.some((status) => status === "failed" || status === "error"))
    return "down";
  return statuses.length &&
    statuses.every((status) => status === "ok" || status === "passed")
    ? "healthy"
    : "unknown";
}
export async function gitlabCheck(
  config: CollectorConfig,
  id: "gitlab-web" | "gitlab-api" | "gitlab-readiness",
  fetcher: typeof fetch,
): Promise<InfraCheck> {
  const checkedAt = new Date().toISOString();
  const result = (
    state: InfraCheck["state"],
    message: string,
    latencyMs: number | null = null,
  ): InfraCheck => ({ id, state, message, checkedAt, latencyMs });
  if (!config.gitlabBaseUrl)
    return result("unknown", "GitLab 주소가 설정되지 않았습니다.");
  if (id === "gitlab-api" && !config.gitlabReadToken)
    return result("unknown", "서버에 읽기 전용 토큰을 설정해 주세요.");
  const paths = {
    "gitlab-web": "/users/sign_in",
    "gitlab-api": "/api/v4/version",
    "gitlab-readiness": "/-/readiness?all=1",
  };
  const started = performance.now();
  try {
    const headers: Record<string, string> = {
      Accept: id === "gitlab-web" ? "text/html" : "application/json",
    };
    if (id === "gitlab-api") headers["PRIVATE-TOKEN"] = config.gitlabReadToken!;
    const response = await fetcher(config.gitlabBaseUrl + paths[id], {
      method: "GET",
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    const elapsed = Math.round(performance.now() - started);
    if ([401, 403].includes(response.status))
      return result(
        "forbidden",
        "토큰 권한 또는 점검 IP 허용 목록을 확인해 주세요.",
        elapsed,
      );
    if (response.status >= 300 && response.status < 400)
      return result(
        "unknown",
        "리다이렉트 응답입니다. SSO·프록시 경로를 확인해 주세요.",
        elapsed,
      );
    if (response.status === 404)
      return result(
        "unknown",
        "점검 경로를 찾지 못했습니다. 프록시 설정을 확인해 주세요.",
        elapsed,
      );
    if (response.status >= 500)
      return result(
        "down",
        `서비스 점검에서 HTTP ${response.status} 응답을 받았습니다.`,
        elapsed,
      );
    if (!response.ok)
      return result("unknown", "예상하지 못한 HTTP 응답입니다.", elapsed);
    if (id === "gitlab-web")
      return result(
        "healthy",
        "로그인 페이지가 HTTP 200으로 응답합니다. 인증 성공과는 별도입니다.",
        elapsed,
      );
    const body: unknown = await response.json();
    if (id === "gitlab-api") {
      const version = (body as { version?: unknown })?.version;
      return typeof version === "string" && /^\d+\.\d+\.\d+/.test(version)
        ? result(
            "healthy",
            "읽기 전용 API 인증과 버전 조회에 성공했습니다.",
            elapsed,
          )
        : result(
            "unknown",
            "GitLab API 응답 형식을 확인하지 못했습니다.",
            elapsed,
          );
    }
    const state = readinessState(body);
    return result(
      state,
      state === "healthy"
        ? "응답에 포함된 DB·Redis·Gitaly 종속 서비스 점검이 정상입니다."
        : state === "down"
          ? "내부 종속 서비스 점검에서 실패가 감지됐습니다."
          : "종속 서비스가 포함된 readiness 응답을 확인하지 못했습니다.",
      elapsed,
    );
  } catch {
    return result(
      "unknown",
      "연결·TLS·시간 초과 또는 응답 형식을 확인해 주세요. 장애로 단정하지 않습니다.",
    );
  }
}

type KubeObject = {
  kind?: string;
  metadata?: {
    name?: string;
    generation?: number;
    labels?: Record<string, string>;
  };
  spec?: { replicas?: number };
  status?: {
    readyReplicas?: number;
    availableReplicas?: number;
    observedGeneration?: number;
    updatedReplicas?: number;
    currentRevision?: string;
    updateRevision?: string;
  };
};
export function summarizeWorkloads(
  objects: KubeObject[],
  components: string[],
): InfraSnapshot["workloads"] {
  return components.flatMap((component) => {
    const matching = objects.filter(
      (item) =>
        ["Deployment", "StatefulSet"].includes(item.kind ?? "") &&
        (item.metadata?.labels?.app === component ||
          item.metadata?.labels?.["app.kubernetes.io/name"] === component ||
          new RegExp(`(^|-)${component}(-|$)`).test(item.metadata?.name ?? "")),
    );
    if (!matching.length) return [];
    return [
      {
        component,
        desired: matching.reduce(
          (sum, item) => sum + (item.spec?.replicas ?? 1),
          0,
        ),
        ready: matching.reduce(
          (sum, item) =>
            sum +
            Math.min(
              item.status?.readyReplicas ?? 0,
              item.kind === "Deployment"
                ? (item.status?.availableReplicas ?? 0)
                : (item.status?.readyReplicas ?? 0),
            ),
          0,
        ),
        current: matching.every(
          (item) =>
            (item.status?.observedGeneration ?? 0) >=
              (item.metadata?.generation ?? 1) &&
            (item.kind !== "Deployment" ||
              (item.status?.updatedReplicas ?? 0) >=
                (item.spec?.replicas ?? 1)) &&
            (!item.status?.updateRevision ||
              item.status.currentRevision === item.status.updateRevision),
        ),
      },
    ];
  });
}
export async function collectStatus(
  config: CollectorConfig,
  injected: Partial<Dependencies> = {},
): Promise<InfraSnapshot> {
  const deps = { ...defaults, ...injected };
  let workloads: InfraSnapshot["workloads"] = [];
  const eksAndWorkloads = async (): Promise<InfraCheck[]> => {
    const checkedAt = new Date().toISOString();
    const check = (
      id: "eks" | "workloads",
      state: InfraCheck["state"],
      message: string,
    ): InfraCheck => ({ id, state, message, checkedAt, latencyMs: null });
    if (!config.awsRegion || !config.eksClusterName)
      return [
        check(
          "eks",
          "unknown",
          "AWS 리전과 EKS 클러스터 이름을 설정해 주세요.",
        ),
        check(
          "workloads",
          "unknown",
          "동일한 EKS 클러스터인지 확인 후 수집합니다.",
        ),
      ];
    let cluster: ClusterInfo;
    try {
      cluster = await deps.describeCluster(config);
    } catch (error) {
      const state = permissionError(error) ? "forbidden" : "unknown";
      return [
        check("eks", state, "AWS 조회 역할·인증·네트워크를 확인해 주세요."),
        check(
          "workloads",
          "unknown",
          "클러스터 확인에 실패해 워크로드 조회를 생략했습니다.",
        ),
      ];
    }
    const eks = check(
      "eks",
      cluster.status === "ACTIVE"
        ? "healthy"
        : cluster.status === "FAILED"
          ? "down"
          : cluster.status
            ? "degraded"
            : "unknown",
      cluster.status === "ACTIVE"
        ? "EKS 제어 영역이 ACTIVE입니다. 노드·ALB·스토리지는 별도 점검 대상입니다."
        : "EKS 클러스터가 ACTIVE 상태인지 확인해 주세요.",
    );
    if (!config.kubeContext || !config.namespaces.length || !cluster.endpoint)
      return [
        eks,
        check(
          "workloads",
          "unknown",
          "조회 전용 kube context와 네임스페이스가 필요합니다.",
        ),
      ];
    try {
      const server = (
        await deps.kubectl(
          [
            "config",
            "view",
            "--context",
            config.kubeContext,
            "--minify",
            "-o",
            "jsonpath={.clusters[0].cluster.server}",
          ],
          config.timeoutMs,
        )
      ).trim();
      if (server.replace(/\/$/, "") !== cluster.endpoint.replace(/\/$/, ""))
        return [
          eks,
          check(
            "workloads",
            "unknown",
            "kube context가 지정한 EKS 클러스터와 다릅니다. 조회를 중단했습니다.",
          ),
        ];
      const lists = await Promise.all(
        config.namespaces.map(async (namespace) => {
          const json = await deps.kubectl(
            [
              "get",
              "deployments,statefulsets",
              "--context",
              config.kubeContext!,
              "--namespace",
              namespace,
              "--output=json",
              "--request-timeout=5s",
              "--chunk-size=0",
            ],
            config.timeoutMs,
          );
          const body: unknown = JSON.parse(json);
          if (!body || !Array.isArray((body as { items?: unknown }).items))
            throw new Error("invalid list");
          return (body as { items: KubeObject[] }).items;
        }),
      );
      workloads = summarizeWorkloads(lists.flat(), config.components);
      if (workloads.length !== config.components.length)
        return [
          eks,
          check(
            "workloads",
            "unknown",
            "필수 구성 요소 일부를 찾지 못했습니다. 이름·라벨·네임스페이스를 확인해 주세요.",
          ),
        ];
      const allReady = workloads.every(
        (item) =>
          item.desired > 0 && item.ready >= item.desired && item.current,
      );
      return [
        eks,
        check(
          "workloads",
          allReady ? "healthy" : "degraded",
          allReady
            ? "조회한 모든 구성 요소가 목표 복제본 수만큼 준비됐습니다."
            : "목표보다 준비된 복제본이 적거나 변경이 적용 중입니다.",
        ),
      ];
    } catch (error) {
      return [
        eks,
        check(
          "workloads",
          permissionError(error) ? "forbidden" : "unknown",
          "kubectl·EKS 접근 권한·네임스페이스·수집 서버 네트워크를 확인해 주세요.",
        ),
      ];
    }
  };
  const [web, api, readiness, aws] = await Promise.all([
    gitlabCheck(config, "gitlab-web", deps.fetch),
    gitlabCheck(config, "gitlab-api", deps.fetch),
    gitlabCheck(config, "gitlab-readiness", deps.fetch),
    eksAndWorkloads(),
  ]);
  return infraSnapshotSchema.parse({
    schemaVersion: 1,
    source: "live",
    collectedAt: new Date().toISOString(),
    checks: [web, api, readiness, ...aws],
    workloads,
  });
}
