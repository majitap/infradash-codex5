"use client";

import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useInfraStatus } from "@/hooks/use-infra-status";
import {
  checkLabels,
  overallState,
  stateLabels,
  unconfiguredChecks,
} from "@/lib/infra-status";

export function LiveInfrastructureStatus() {
  const { configured, snapshot, loading, stale, error, refresh } =
    useInfraStatus();
  const checks = snapshot?.checks ?? unconfiguredChecks();
  const state = overallState(checks);
  const unavailable = !!error || stale;
  const title = !configured
    ? "아직 실제 인프라에 연결되지 않았어요"
    : error
      ? "현재 상태를 확인할 수 없어요"
      : stale
        ? "최신 상태를 다시 확인해야 해요"
        : !snapshot
          ? "인프라 상태를 확인하고 있어요"
          : state === "healthy"
            ? "확인한 항목이 모두 정상이에요"
            : state === "down"
              ? "확인이 필요한 이상이 감지됐어요"
              : state === "degraded"
                ? "일부 구성 요소를 점검해 주세요"
                : "일부 항목의 상태를 확인할 수 없어요";
  const SummaryIcon =
    !configured || !snapshot || unavailable
      ? CircleHelp
      : state === "healthy"
        ? CheckCircle2
        : TriangleAlert;
  return (
    <section
      className="v5-panel infra-health"
      aria-labelledby="infra-health-title"
    >
      <div className="infra-health-heading">
        <div>
          <span className="section-kicker">
            <Activity size={14} /> 현재 인프라 상태
          </span>
          <h2 id="infra-health-title">GitLab이 잘 연결되어 있나요?</h2>
        </div>
        <span className="infra-source">
          <ShieldCheck size={14} />
          {configured ? "실측 · 읽기 전용" : "실제 연동 미설정"}
        </span>
      </div>
      <div
        className={`infra-health-summary ${!configured || unavailable ? "unknown" : state}`}
        role="status"
        aria-live="polite"
      >
        <SummaryIcon size={20} />
        <div>
          <strong>{title}</strong>
          <p>
            {error ??
              (!configured
                ? "실제 데이터를 아직 수집하지 않았습니다. 연결 후 접속·내부 서비스·HA 구성을 확인할 수 있어요."
                : stale
                  ? "2분 이상 지났거나 수집 시간이 올바르지 않은 응답입니다. 이전 결과는 참고용입니다."
                  : "접속 가능 여부와 EKS 워크로드의 실제 준비 상태를 구분해 확인합니다.")}
          </p>
        </div>
        <button
          className="infra-refresh"
          onClick={() => void refresh()}
          disabled={!configured || loading}
          aria-label="실제 인프라 상태 새로고침"
          aria-busy={loading}
        >
          <RefreshCw size={15} className={loading ? "is-refreshing" : ""} />
          <span>{loading ? "확인 중" : "상태 확인"}</span>
        </button>
      </div>
      <div className="infra-checks">
        {checks.map((check) => (
          <article key={check.id} className="infra-check">
            <span>{checkLabels[check.id]}</span>
            <strong
              className={`infra-state ${unavailable ? "unknown" : check.state}`}
            >
              <i />
              {!configured
                ? "미연동"
                : unavailable
                  ? "확인 불가"
                  : stateLabels[check.state]}
            </strong>
            {configured && (
              <p>
                {unavailable
                  ? "최근 응답을 확인하지 못했습니다."
                  : check.message}
              </p>
            )}
            {check.latencyMs !== null && !unavailable && (
              <small>{check.latencyMs} ms</small>
            )}
          </article>
        ))}
      </div>
      {!!snapshot?.workloads.length && (
        <div className="infra-ha-details" aria-label="HA 복제본 현황">
          {unavailable && <span>이전 수집 기준 · 최신 상태가 아닙니다</span>}
          {snapshot.workloads.map((item) => (
            <span key={item.component}>
              <strong>{item.component}</strong>
              <span>
                준비 {item.ready} / 목표 {item.desired}
              </span>
              {!item.current && <span>변경 적용 중</span>}
            </span>
          ))}
        </div>
      )}
      <div className="infra-health-bottom">
        <span>
          <Clock3 size={14} />
          {snapshot
            ? `마지막 수집 ${new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Seoul" }).format(new Date(snapshot.collectedAt))} KST`
            : "아직 수집한 실제 데이터가 없습니다"}
        </span>
        <details>
          <summary>
            실제 연동 준비 <ChevronDown size={14} />
          </summary>
          <div>
            <p>① GitLab 주소·점검 IP 허용 목록</p>
            <p>② 읽기 전용 토큰과 EKS 조회 역할</p>
            <p>③ 네임스페이스·Webservice/Gitaly 워크로드 확인</p>
            <p>④ SSO 또는 VPN 뒤에 수집 API 배치</p>
            <a
              href="https://github.com/majitap/infradash-codex5/blob/main/docs/LIVE-DATA-SETUP.md"
              target="_blank"
              rel="noreferrer"
            >
              설정 가이드 보기 <ArrowUpRight size={14} />
            </a>
          </div>
        </details>
      </div>
      <p className="infra-scope-note">
        현재 상태 패널만 실제 수집 연동 대상입니다. 아래 파이프라인·서비스
        맵·비용 등은 모의 데이터예요.
      </p>
    </section>
  );
}
