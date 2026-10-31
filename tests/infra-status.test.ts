import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkIds,
  infraSnapshotSchema,
  isStale,
  overallState,
  unconfiguredChecks,
} from "../lib/infra-status";
import {
  collectStatus,
  gitlabCheck,
  summarizeWorkloads,
} from "../services/collector/collect";
import { readConfig, type CollectorConfig } from "../services/collector/config";
import { isLocalRequest } from "../services/collector/server";

const config: CollectorConfig = {
  gitlabBaseUrl: "https://gitlab.example.test",
  gitlabReadToken: "unit-test-not-a-real-token",
  awsRegion: "ap-northeast-2",
  eksClusterName: "test",
  kubeContext: "test-context",
  namespaces: ["gitlab"],
  components: ["webservice", "gitaly"],
  timeoutMs: 5000,
};
const workload = (
  component: string,
  kind: string,
  desired: number,
  ready: number,
) => ({
  kind,
  metadata: {
    name: `gitlab-${component}`,
    generation: 2,
    labels: { app: component },
  },
  spec: { replicas: desired },
  status: {
    readyReplicas: ready,
    availableReplicas: ready,
    observedGeneration: 2,
    updatedReplicas: desired,
  },
});

test("unconfigured collection makes no external requests and never assumes health", async () => {
  let calls = 0;
  const forbidden = async () => {
    calls++;
    throw new Error("external request must not occur");
  };
  const snapshot = await collectStatus(readConfig({}), {
    fetch: forbidden,
    describeCluster: forbidden,
    kubectl: forbidden,
  });
  assert.equal(overallState(snapshot.checks), "unknown");
  assert.ok(snapshot.checks.every((check) => check.state === "unknown"));
  assert.equal(snapshot.workloads.length, 0);
  assert.equal(calls, 0);
  assert.equal(overallState(unconfiguredChecks()), "unknown");
});

test("GitLab token is sent only to the version API and redirects are never followed", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(
      String(url).includes("/version")
        ? JSON.stringify({ version: "17.11.2" })
        : JSON.stringify({
            db_check: [{ status: "ok" }],
            redis_check: [{ status: "ok" }],
            gitaly_check: [{ status: "ok" }],
          }),
      { status: 200 },
    );
  };
  for (const id of ["gitlab-web", "gitlab-api", "gitlab-readiness"] as const)
    assert.equal((await gitlabCheck(config, id, fetcher)).state, "healthy");
  assert.equal(
    calls.filter(
      (c) => (c.init?.headers as Record<string, string>)["PRIVATE-TOKEN"],
    ).length,
    1,
  );
  assert.ok(
    calls.every(
      (c) => c.init?.method === "GET" && c.init?.redirect === "manual",
    ),
  );
  assert.ok(
    !JSON.stringify(calls.map((c) => c.url)).includes(config.gitlabReadToken!),
  );
});

test("readiness failure, denied monitoring, invalid payloads and TLS failures are distinct from health", async () => {
  for (const [status, body, expected] of [
    [503, "failed", "down"],
    [403, "denied", "forbidden"],
    [302, "login", "unknown"],
    [200, "<html>SSO</html>", "unknown"],
    [200, JSON.stringify({ master_check: [{ status: "ok" }] }), "unknown"],
    [200, JSON.stringify({ db_check: [{ status: "failed" }] }), "down"],
  ] as const) {
    const result = await gitlabCheck(
      config,
      "gitlab-readiness",
      async () => new Response(body, { status }),
    );
    assert.equal(result.state, expected);
  }
  const result = await gitlabCheck(config, "gitlab-api", async () => {
    throw new Error("secret value must not be echoed");
  });
  assert.equal(result.state, "unknown");
  assert.ok(!JSON.stringify(result).includes("secret value"));
});

test("HA counts come from actual desired and ready replicas, including active rollout detection", () => {
  const result = summarizeWorkloads(
    [
      workload("webservice", "Deployment", 5, 5),
      workload("gitaly", "StatefulSet", 3, 2),
    ],
    config.components,
  );
  assert.deepEqual(
    result.map((item) => [item.desired, item.ready]),
    [
      [5, 5],
      [3, 2],
    ],
  );
  const rolling = workload("webservice", "Deployment", 7, 7);
  rolling.status.observedGeneration = 1;
  assert.equal(summarizeWorkloads([rolling], ["webservice"])[0].current, false);
});

test("collector verifies the kube context matches the EKS endpoint before reading workloads", async () => {
  let queried = false;
  const snapshot = await collectStatus(
    { ...config, gitlabBaseUrl: undefined },
    {
      describeCluster: async () => ({
        status: "ACTIVE",
        endpoint: "https://correct.example.test",
      }),
      kubectl: async (args) => {
        if (args[0] === "get") queried = true;
        return "https://wrong.example.test";
      },
    },
  );
  assert.equal(queried, false);
  assert.equal(
    snapshot.checks.find((check) => check.id === "workloads")?.state,
    "unknown",
  );
});

test("partial HA, missing component, and AWS permission failure are not healthy", async () => {
  const collect = async (items: ReturnType<typeof workload>[]) =>
    collectStatus(
      { ...config, gitlabBaseUrl: undefined },
      {
        describeCluster: async () => ({
          status: "ACTIVE",
          endpoint: "https://correct.example.test",
        }),
        kubectl: async (args) =>
          args[0] === "config"
            ? "https://correct.example.test"
            : JSON.stringify({ items }),
      },
    );
  const partial = await collect([
    workload("webservice", "Deployment", 5, 4),
    workload("gitaly", "StatefulSet", 3, 3),
  ]);
  assert.equal(
    partial.checks.find((check) => check.id === "workloads")?.state,
    "degraded",
  );
  const missing = await collect([workload("webservice", "Deployment", 5, 5)]);
  assert.equal(
    missing.checks.find((check) => check.id === "workloads")?.state,
    "unknown",
  );
  const denied = await collectStatus(
    { ...config, gitlabBaseUrl: undefined },
    {
      describeCluster: async () => {
        throw Object.assign(new Error("do not echo"), {
          name: "AccessDeniedException",
        });
      },
    },
  );
  assert.equal(
    denied.checks.find((check) => check.id === "eks")?.state,
    "forbidden",
  );
});

test("snapshot schema, unknown checks and stale/future timestamps cannot produce an all-clear", async () => {
  const snapshot = await collectStatus(readConfig({}));
  const now = Date.now();
  assert.equal(isStale(snapshot, now), false);
  assert.equal(isStale(snapshot, now + 130_000), true);
  assert.equal(isStale(snapshot, now - 60_000), true);
  assert.equal(
    infraSnapshotSchema.safeParse({
      ...snapshot,
      checks: snapshot.checks.map(() => snapshot.checks[0]),
    }).success,
    false,
  );
  const healthy = checkIds.map((id) => ({
    id,
    state: "healthy" as const,
    message: "ok",
    checkedAt: snapshot.collectedAt,
    latencyMs: 1,
  }));
  assert.equal(overallState(healthy), "healthy");
  assert.equal(
    overallState([...healthy.slice(0, 4), { ...healthy[4], state: "unknown" }]),
    "unknown",
  );
});

test("collector config rejects credential-bearing URLs and local API excludes public Origins", () => {
  assert.throws(() =>
    readConfig({ GITLAB_BASE_URL: "https://user:secret@gitlab.example.test" }),
  );
  assert.throws(() =>
    readConfig({ GITLAB_BASE_URL: "http://gitlab.example.test" }),
  );
  assert.throws(() => readConfig({ KUBE_NAMESPACES: "gitlab;echo" }));
  assert.equal(
    isLocalRequest({
      headers: { host: "127.0.0.1:4318", origin: "http://localhost:3000" },
    }),
    true,
  );
  assert.equal(
    isLocalRequest({
      headers: { host: "127.0.0.1:4318", origin: "https://majitap.github.io" },
    }),
    false,
  );
  assert.equal(
    isLocalRequest({ headers: { host: "evil.example:4318" } }),
    false,
  );
});
