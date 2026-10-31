import assert from "node:assert/strict";
import { test } from "node:test";
import {
  navGroups,
  navItems,
  topLevelMenuCount,
  findNavItem,
} from "../lib/nav";
import {
  licenseRemaining,
  maintenanceChangeSchema,
  safeApiBase,
} from "../lib/operations";
import { filterLogs, logBuckets, makeDemoLogs } from "../lib/logs";
import {
  readOperationsConfig,
  type OperationsConfig,
} from "../services/operations/config";
import {
  collectLicense,
  collectMaintenance,
} from "../services/operations/gitlab";
import {
  createOperationsHandler,
  type OperationsIdentity,
  type AuditEvent,
} from "../services/operations/handler";
import {
  queryLogs,
  validateLogQuery,
  redactLog,
} from "../services/operations/loki";

const origin = "https://majitap.github.io";
const config: OperationsConfig = {
  gitlabBaseUrl: "https://gitlab.example.test",
  licenseToken: "test-license",
  maintenanceReadToken: "test-read",
  maintenanceWriteToken: "test-write",
  lokiUrl: "https://loki.example.test",
  allowedOrigins: [origin],
  timeoutMs: 1000,
};
const identity: OperationsIdentity = {
  id: "test-admin",
  name: "관리자",
  role: "admin",
  permissions: [
    "license:read",
    "maintenance:read",
    "maintenance:write",
    "logs:read",
  ],
  csrfToken: "unit-test-csrf-token-123456789",
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const request = (
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) =>
  new Request(`https://operations.example.test/api/operations/${path}`, {
    method: body ? "PUT" : "GET",
    headers: {
      Origin: origin,
      ...(body
        ? {
            "Content-Type": "application/json",
            "X-CSRF-Token": identity.csrfToken,
          }
        : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
const change = {
  enabled: true,
  message: "정기 점검 중입니다.",
  reason: "정기 업데이트",
  expectedRevision: "placeholder",
};

test("navigation has exactly ten roots; old routes remain searchable as children", () => {
  assert.equal(topLevelMenuCount, 10);
  assert.equal(navGroups.flatMap((g) => g.items).length, 10);
  assert.equal(new Set(navItems.map((i) => i.url)).size, navItems.length);
  for (const route of [
    "/commits",
    "/merge-requests",
    "/runners",
    "/dora",
    "/storage",
    "/users",
    "/access",
    "/audit",
    "/upgrade",
    "/logs",
    "/admin",
    "/admin/license",
    "/admin/integrations",
  ])
    assert.ok(findNavItem(route), route);
});
test("license unknown values stay unknown, current active_users is used and PII is excluded", async () => {
  const absent = await collectLicense(
    { ...config, licenseToken: undefined },
    async () => {
      throw Error("should not fetch");
    },
  );
  assert.equal(absent.state, "unconfigured");
  assert.equal(licenseRemaining(absent), null);
  const data = await collectLicense(config, async () =>
    json({
      user_limit: 100,
      active_users: 85,
      historical_max: 99,
      plan: "premium",
      expires_at: "2027-01-01",
      expired: false,
      licensee: { email: "private@example.test" },
    }),
  );
  assert.equal(licenseRemaining(data), 15);
  assert.equal(data.activeUsers, 85);
  assert.ok(!JSON.stringify(data).includes("private@"));
  assert.equal(
    (await collectLicense(config, async () => json({}, 403))).state,
    "forbidden",
  );
  assert.equal(
    (
      await collectLicense(config, async () =>
        json({ user_limit: -1, active_users: "85" }),
      )
    ).userLimit,
    null,
  );
});
test("operations API defaults to deny and rejects expired identity", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    return json({});
  };
  assert.equal(
    (
      await createOperationsHandler(config, { fetch: fetcher })(
        request("license"),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await createOperationsHandler(config, {
        fetch: fetcher,
        authorize: async () => ({
          ...identity,
          expiresAt: "2000-01-01T00:00:00.000Z",
        }),
      })(request("license"))
    ).status,
    401,
  );
  assert.equal(calls, 0);
});
test("writes require admin, exact origin, CSRF, read/write credentials and durable audit", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    return json({});
  };
  const handler = createOperationsHandler(config, {
    authorize: async () => identity,
    fetch: fetcher,
    audit: async () => {},
  });
  assert.equal(
    (
      await handler(
        request("maintenance", change, { Origin: "https://evil.example.test" }),
      )
    ).status,
    403,
  );
  assert.equal(
    (await handler(request("maintenance", change, { "X-CSRF-Token": "wrong" })))
      .status,
    403,
  );
  assert.equal(
    (await handler(request("maintenance", change, { Origin: "" }))).status,
    403,
  );
  assert.equal(
    (
      await createOperationsHandler(config, {
        authorize: async () => ({ ...identity, role: "viewer" }),
        fetch: fetcher,
        audit: async () => {},
      })(request("maintenance", change))
    ).status,
    403,
  );
  assert.equal(
    (
      await createOperationsHandler(config, {
        authorize: async () => identity,
        fetch: fetcher,
      })(request("maintenance", change))
    ).status,
    503,
  );
  assert.equal(calls, 0);
  assert.equal(
    maintenanceChangeSchema.safeParse({ ...change, unrelatedSetting: true })
      .success,
    false,
  );
});
test("maintenance uses revision checks, isolated write token, constrained payload and readback", async () => {
  let enabled = false,
    message = "",
    writes = 0;
  const events: AuditEvent[] = [];
  const fetcher: typeof fetch = async (_input, init) => {
    const token = (init?.headers as Record<string, string>)["PRIVATE-TOKEN"];
    if (init?.method === "PUT") {
      writes++;
      assert.equal(token, "test-write");
      const body = JSON.parse(String(init.body));
      assert.deepEqual(Object.keys(body).sort(), [
        "maintenance_mode",
        "maintenance_mode_message",
      ]);
      enabled = body.maintenance_mode;
      message = body.maintenance_mode_message;
    } else assert.equal(token, "test-read");
    return json({
      maintenance_mode: enabled,
      maintenance_mode_message: message,
    });
  };
  const snapshot = await collectMaintenance(config, true, fetcher);
  const handler = createOperationsHandler(config, {
    authorize: async () => identity,
    fetch: fetcher,
    audit: async (event) => {
      events.push(event);
    },
  });
  assert.equal((await handler(request("maintenance", change))).status, 409);
  assert.equal(writes, 0);
  const response = await handler(
    request("maintenance", { ...change, expectedRevision: snapshot.revision }),
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).enabled, true);
  assert.equal(writes, 1);
  assert.deepEqual(
    events.map((e) => e.outcome),
    ["requested", "verified"],
  );
  // A stale browser must not undo another administrator's update.
  assert.equal(
    (
      await handler(
        request("maintenance", {
          ...change,
          enabled: false,
          expectedRevision: snapshot.revision,
        }),
      )
    ).status,
    409,
  );
  assert.equal(writes, 1);
});
test("failed pre-write audit prevents mutation; failed readback never claims success", async () => {
  let writes = 0;
  const fetcher: typeof fetch = async (_i, init) => {
    if (init?.method === "PUT") writes++;
    return json({ maintenance_mode: false, maintenance_mode_message: "" });
  };
  const snapshot = await collectMaintenance(config, true, fetcher);
  const payload = { ...change, expectedRevision: snapshot.revision };
  const denied = createOperationsHandler(config, {
    authorize: async () => identity,
    fetch: fetcher,
    audit: async () => {
      throw Error("audit unavailable");
    },
  });
  assert.equal((await denied(request("maintenance", payload))).status, 503);
  assert.equal(writes, 0);
  const unverified = createOperationsHandler(config, {
    authorize: async () => identity,
    fetch: fetcher,
    audit: async () => {},
  });
  assert.equal((await unverified(request("maintenance", payload))).status, 503);
  assert.equal(writes, 1);
});
test("log queries are bounded; credentials and tenant header stay on server", async () => {
  const now = Date.now(),
    params = new URLSearchParams({
      query: '{namespace="gitlab"}',
      start: String(now - 900000),
      end: String(now),
      limit: "100",
    });
  assert.equal(validateLogQuery(params, now).limit, 100);
  for (const patch of [
    { limit: "501" },
    { start: String(now - 7 * 3600000) },
    { query: "sum(rate(foo))" },
    { end: String(now + 60000) },
  ] as Record<string, string>[])
    assert.throws(() =>
      validateLogQuery(
        new URLSearchParams({ ...Object.fromEntries(params), ...patch }),
        now,
      ),
    );
  const result = await queryLogs(
    { ...config, lokiBearerToken: "server-secret", lokiTenantId: "tenant-1" },
    params,
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/loki/api/v1/query_range");
      assert.equal(
        url.searchParams.get("start"),
        String(BigInt(now - 900000) * BigInt(1000000)),
      );
      assert.equal(
        (init?.headers as Record<string, string>).Authorization,
        "Bearer server-secret",
      );
      assert.equal(
        (init?.headers as Record<string, string>)["X-Scope-OrgID"],
        "tenant-1",
      );
      return json({
        status: "success",
        data: {
          resultType: "streams",
          result: [
            {
              stream: {
                app: "webservice",
                level: "error",
                secret: "private-label",
              },
              values: [
                [
                  String(BigInt(now) * BigInt(1000000)),
                  "request failed password=abc123 Bearer token123",
                ],
              ],
            },
          ],
        },
      });
    },
  );
  assert.equal(result.entries[0].level, "error");
  assert.ok(!JSON.stringify(result).includes("abc123"));
  assert.ok(!JSON.stringify(result).includes("private-label"));
  assert.ok(!JSON.stringify(result).includes("server-secret"));
  assert.match(redactLog("access_token=abc"), /REDACTED/);
});
test("demo filtering and time buckets preserve counts and support empty results", () => {
  const end = Date.now(),
    entries = makeDemoLogs(end);
  assert.equal(entries.length, 96);
  const filtered = filterLogs(entries, "runner", "error", "");
  assert.ok(filtered.length > 0);
  assert.ok(
    filtered.every((e) => e.service === "runner" && e.level === "error"),
  );
  assert.equal(filterLogs(entries, "all", "all", "no-such-message").length, 0);
  assert.equal(
    logBuckets(entries, end - 900000, end).reduce((n, b) => n + b.total, 0),
    96,
  );
});
test("configuration rejects credential URLs, wildcard origins and ambiguous Loki auth", () => {
  assert.throws(() =>
    readOperationsConfig({
      GITLAB_BASE_URL: "https://user:secret@gitlab.example.test",
    }),
  );
  assert.throws(() =>
    readOperationsConfig({ OPERATIONS_ALLOWED_ORIGINS: "*" }),
  );
  assert.throws(() =>
    readOperationsConfig({
      LOKI_USERNAME: "id",
      LOKI_PASSWORD: "pass",
      LOKI_BEARER_TOKEN: "token",
    }),
  );
  assert.throws(() => readOperationsConfig({ LOKI_TENANT_ID: "one|two" }));
  assert.throws(() => safeApiBase("javascript:alert(1)", origin));
});
