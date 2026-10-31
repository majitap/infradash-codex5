"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  demoMaintenance,
  emptyIntegrations,
  integrationsSchema,
  licenseSchema,
  maintenanceSchema,
  safeApiBase,
  sessionSchema,
  type IntegrationSnapshot,
  type LicenseSnapshot,
  type MaintenanceSnapshot,
  type OperationsSession,
} from "@/lib/operations";

type LocalAudit = {
  id: string;
  at: string;
  action: string;
  reason: string;
  source: "demo" | "live";
};
type Context = {
  configured: boolean;
  session: OperationsSession | null;
  license: LicenseSnapshot | null;
  maintenance: MaintenanceSnapshot | null;
  integrations: IntegrationSnapshot;
  loading: boolean;
  error: string | null;
  adminMode: boolean;
  saving: boolean;
  audit: LocalAudit[];
  refresh: () => Promise<void>;
  enterAdmin: () => void;
  exitAdmin: () => void;
  applyMaintenance: (
    enabled: boolean,
    message: string,
    reason: string,
  ) => Promise<void>;
  api: (path: string, init?: RequestInit) => Promise<unknown>;
};
const OperationsContext = createContext<Context | null>(null);
export function useOperations() {
  const ctx = useContext(OperationsContext);
  if (!ctx) throw new Error("OperationsProvider missing");
  return ctx;
}
export function OperationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const endpoint = process.env.NEXT_PUBLIC_OPERATIONS_API_URL ?? "";
  const configured = !!endpoint;
  const [session, setSession] = useState<OperationsSession | null>(null),
    [license, setLicense] = useState<LicenseSnapshot | null>(null),
    [liveMaintenance, setMaintenance] = useState<MaintenanceSnapshot | null>(
      null,
    ),
    [demo, setDemo] = useState(demoMaintenance),
    [integrations, setIntegrations] = useState(emptyIntegrations),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<string | null>(null),
    [adminMode, setAdminMode] = useState(false),
    [adminDeadline, setAdminDeadline] = useState(0),
    [saving, setSaving] = useState(false),
    [audit, setAudit] = useState<LocalAudit[]>([]);
  const active = useRef(false),
    writing = useRef(false);
  const api = useCallback(
    async (path: string, init: RequestInit = {}) => {
      if (!endpoint) throw new Error("운영 API가 연결되지 않았습니다.");
      const base = safeApiBase(endpoint, window.location.origin);
      const response = await fetch(`${base}${path}`, {
        ...init,
        headers: { Accept: "application/json", ...init.headers },
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(init.method === "PUT" ? 35_000 : 12_000),
      });
      if (!response.ok) {
        let code = "";
        try {
          code = (await response.json()).code;
        } catch {}
        throw new Error(
          response.status === 401 || response.status === 403
            ? "접근 권한 또는 SSO 세션을 확인해 주세요."
            : response.status === 409
              ? "다른 관리자가 상태를 변경했어요. 새로고침 후 다시 확인해 주세요."
              : code === "loki_not_configured"
                ? "Loki가 아직 설정되지 않았어요."
                : "API 응답을 확인하지 못했습니다. 작업 결과는 새로고침으로 확인해 주세요.",
        );
      }
      return response.json();
    },
    [endpoint],
  );
  const refresh = useCallback(async () => {
    if (!configured || active.current || writing.current) return;
    active.current = true;
    setLoading(true);
    try {
      const auth = sessionSchema.parse(await api("/session"));
      if (Date.parse(auth.expiresAt) <= Date.now())
        throw new Error("세션이 만료되었어요.");
      setSession(auth);
      const [l, m, i] = await Promise.allSettled([
        auth.permissions.includes("license:read")
          ? api("/license").then((v) => licenseSchema.parse(v))
          : Promise.resolve(null),
        auth.permissions.includes("maintenance:read")
          ? api("/maintenance").then((v) => maintenanceSchema.parse(v))
          : Promise.resolve(null),
        api("/integrations").then((v) => integrationsSchema.parse(v)),
      ]);
      setLicense(l.status === "fulfilled" ? l.value : null);
      setMaintenance(m.status === "fulfilled" ? m.value : null);
      setIntegrations(i.status === "fulfilled" ? i.value : emptyIntegrations);
      setError(
        [l, m, i].some((v) => v.status === "rejected")
          ? "일부 운영 정보를 불러오지 못했어요. 연결과 권한을 확인해 주세요."
          : null,
      );
    } catch {
      setSession(null);
      setLicense(null);
      setMaintenance(null);
      setIntegrations(emptyIntegrations);
      setAdminMode(false);
      setError(
        "운영 API에 연결할 수 없거나 권한이 없습니다. 실제 상태를 확인할 수 없어요.",
      );
    } finally {
      active.current = false;
      setLoading(false);
    }
  }, [configured, api]);
  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    const poll = setInterval(() => void refresh(), 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
    };
  }, [refresh]);
  useEffect(() => {
    if (!adminMode) return;
    const timer = setTimeout(
      () => {
        setAdminMode(false);
        toast.info("관리자 모드가 만료되었습니다");
      },
      Math.max(
        0,
        Math.min(
          adminDeadline,
          configured
            ? session?.actor.role === "admin"
              ? Date.parse(session.expiresAt)
              : 0
            : adminDeadline,
        ) - Date.now(),
      ),
    );
    return () => clearTimeout(timer);
  }, [adminMode, configured, session, adminDeadline]);
  function enterAdmin() {
    if (
      configured &&
      (!session ||
        session.actor.role !== "admin" ||
        Date.parse(session.expiresAt) <= Date.now())
    ) {
      toast.error("인증된 관리자 세션이 필요합니다");
      return;
    }
    setAdminDeadline(Date.now() + 15 * 60 * 1000);
    setAdminMode(true);
    toast.success(
      configured
        ? "관리자 모드를 시작했습니다"
        : "데모 관리자 모드를 시작했습니다",
    );
  }
  function exitAdmin() {
    setAdminMode(false);
  }
  async function applyMaintenance(
    enabled: boolean,
    message: string,
    reason: string,
  ) {
    if (!adminMode || Date.now() >= adminDeadline || writing.current)
      throw new Error("관리자 모드를 먼저 시작해 주세요.");
    if (active.current)
      throw new Error("상태 조회가 끝난 뒤 다시 적용해 주세요.");
    writing.current = true;
    setSaving(true);
    try {
      let result: MaintenanceSnapshot;
      if (configured) {
        if (
          !session ||
          session.actor.role !== "admin" ||
          !liveMaintenance?.canWrite ||
          Date.parse(session.expiresAt) <= Date.now()
        )
          throw new Error("변경 권한이 없거나 세션이 만료되었습니다.");
        result = maintenanceSchema.parse(
          await api("/maintenance", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": session.csrfToken,
            },
            body: JSON.stringify({
              enabled,
              message,
              reason,
              expectedRevision: liveMaintenance.revision,
            }),
          }),
        );
        setMaintenance(result);
      } else {
        result = {
          ...demo,
          enabled,
          message,
          revision: `demo-${Date.now()}`,
          checkedAt: new Date().toISOString(),
        };
        setDemo(result);
      }
      setAudit((items) =>
        [
          {
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
            action: enabled ? "메인터넌스 켜기" : "메인터넌스 끄기",
            reason,
            source: result.source,
          },
          ...items,
        ].slice(0, 20),
      );
      toast.success(
        result.source === "demo"
          ? "데모 설정을 변경했습니다. 실제 GitLab에는 적용되지 않습니다."
          : "GitLab 변경 결과를 다시 조회해 확인했습니다.",
      );
    } catch (error) {
      if (configured) {
        setMaintenance(null);
        setError(
          "변경 결과를 확인하지 못했습니다. 실제 적용 여부는 상태 재조회로 확인해 주세요.",
        );
      }
      throw error;
    } finally {
      writing.current = false;
      setSaving(false);
    }
  }
  return (
    <OperationsContext.Provider
      value={{
        configured,
        session,
        license,
        maintenance: configured ? liveMaintenance : demo,
        integrations,
        loading,
        error,
        adminMode,
        saving,
        audit,
        refresh,
        enterAdmin,
        exitAdmin,
        applyMaintenance,
        api,
      }}
    >
      {children}
    </OperationsContext.Provider>
  );
}
