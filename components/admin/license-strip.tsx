"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useOperations } from "./operations-provider";
import { licenseRemaining, kstTime } from "@/lib/operations";
export function LicenseStrip({ detail = false }: { detail?: boolean }) {
  const { license, configured, loading, refresh } = useOperations();
  const available = license?.state === "available";
  const remaining = available ? licenseRemaining(license) : null;
  const count = (n: number | null | undefined) =>
    n == null ? "—" : n.toLocaleString("ko-KR");
  const state = loading
    ? "조회 중"
    : available
      ? "실제 데이터"
      : !configured || license?.state === "unconfigured"
        ? "미연동"
        : license?.state === "forbidden"
          ? "권한 확인 필요"
          : "조회 불가";
  return (
    <section
      className="ops-panel license-panel"
      aria-label="현재 라이선스 현황"
    >
      <div className="ops-panel-heading">
        <div className="ops-inline">
          <h2>GitLab 라이선스</h2>
          <span className={available ? "ops-tag live" : "ops-tag"}>
            {state}
          </span>
          {available && license.plan && (
            <span className="ops-muted">{license.plan}</span>
          )}
        </div>
        {detail ? (
          <button
            className="ops-button subtle"
            onClick={() => void refresh()}
            disabled={!configured || loading}
          >
            새로고침
          </button>
        ) : (
          <Link href="/admin/license" className="ops-text-link">
            상세 보기 <ArrowUpRight size={16} />
          </Link>
        )}
      </div>
      <dl className="license-metrics">
        <div>
          <dt>보유 라이선스</dt>
          <dd>
            {count(available ? license.userLimit : null)}
            <span>석</span>
          </dd>
        </div>
        <div>
          <dt>사용 중</dt>
          <dd>
            {count(available ? license.activeUsers : null)}
            <span>명</span>
          </dd>
        </div>
        <div>
          <dt>남은 좌석</dt>
          <dd className={remaining === 0 ? "ops-warning" : ""}>
            {count(remaining)}
            <span>석</span>
          </dd>
        </div>
        <div>
          <dt>만료일</dt>
          <dd className="license-date">
            {available && license.expiresAt
              ? license.expiresAt.replaceAll("-", ".")
              : "—"}
            {available && license.expired && (
              <span className="ops-warning">만료됨</span>
            )}
          </dd>
        </div>
      </dl>
      <p className="ops-footnote">
        {available
          ? `최근 조회 ${kstTime(license.collectedAt)} · 현재 활성 사용자 기준${license.activeUsers !== null && license.userLimit !== null && license.activeUsers > license.userLimit ? ` · ${license.activeUsers - license.userLimit}석 초과` : ""}`
          : "라이선스 API 연결 후 실제 보유 수량과 사용량을 표시합니다."}
      </p>
    </section>
  );
}
