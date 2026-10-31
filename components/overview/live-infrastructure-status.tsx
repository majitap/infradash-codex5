"use client";
import Link from "next/link";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { useInfraStatus } from "@/hooks/use-infra-status";
import {
  overallState,
  stateLabels,
  unconfiguredChecks,
} from "@/lib/infra-status";

export function LiveInfrastructureStatus() {
  const { configured, snapshot, loading, stale, error, refresh } =
    useInfraStatus();
  const state = overallState(snapshot?.checks ?? unconfiguredChecks());
  const unavailable = !!error || stale;
  const label = !configured
    ? "미연동"
    : unavailable
      ? "확인 필요"
      : !snapshot
        ? loading
          ? "확인 중"
          : "확인 필요"
        : state === "healthy"
          ? "전체 정상"
          : state === "degraded"
            ? "일부 주의"
            : state === "down"
              ? "이상 감지"
              : stateLabels[state];
  const tone = !configured || unavailable || !snapshot ? "unknown" : state;
  const hint = !configured
    ? "인프라 수집 API 연결 후 전체 상태를 표시합니다."
    : (error ??
      (stale
        ? "수집 결과가 오래되어 최신 상태를 확인해야 합니다."
        : snapshot
          ? "웹·API·내부 서비스·EKS·HA 전체 점검 기준"
          : "인프라 상태를 조회하고 있습니다."));
  return (
    <div className="infra-compact" aria-label="GitLab 전체 상태" title={hint}>
      <span>GitLab</span>
      <span
        className={"infra-compact-state " + tone}
        role="status"
        aria-live="polite"
      >
        <i aria-hidden="true" />
        {label}
      </span>
      {configured ? (
        <button
          className="infra-compact-action"
          onClick={() => void refresh()}
          disabled={loading}
          aria-label="실제 인프라 상태 새로고침"
          aria-busy={loading}
        >
          <RefreshCw size={14} className={loading ? "is-refreshing" : ""} />
        </button>
      ) : (
        <Link
          className="infra-compact-action"
          href="/admin/integrations"
          aria-label="인프라 연동 설정"
        >
          <ArrowUpRight size={14} />
        </Link>
      )}
    </div>
  );
}
