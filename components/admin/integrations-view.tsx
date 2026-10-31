"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useOperations } from "./operations-provider";
export function IntegrationsView() {
  const { integrations: i, configured, session, error } = useOperations();
  const entries = [
    {
      name: "GitLab 라이선스",
      role: "보유 좌석 · 활성 사용자 · 만료일",
      ready: i.gitlabLicense,
      variable: "GITLAB_LICENSE_READ_TOKEN",
    },
    {
      name: "GitLab 메인터넌스",
      role: "상태 조회 · 관리자 승인 후 변경",
      ready: i.gitlabMaintenance,
      variable: "GITLAB_MAINTENANCE_READ_TOKEN / WRITE_TOKEN",
    },
    {
      name: "Loki",
      role: "LogQL 기반 로그 조회와 필터",
      ready: i.loki,
      variable: "LOKI_URL",
    },
    {
      name: "Grafana",
      role: "관측 대시보드로 이동",
      ready: i.grafana,
      variable: "GRAFANA_URL",
    },
    {
      name: "Tempo",
      role: "분산 트레이스 · 연결 주소 준비",
      ready: i.tempo,
      variable: "TEMPO_URL",
    },
    {
      name: "Mimir",
      role: "장기 보관 메트릭 · 연결 주소 준비",
      ready: i.mimir,
      variable: "MIMIR_URL",
    },
  ];
  return (
    <div className="ops-stack">
      <section className="ops-panel integration-intro">
        <div>
          <p className="ops-eyebrow">CONNECTED OPERATIONS</p>
          <h2>운영 데이터가 모이는 곳</h2>
          <p>
            GitLab과 LGTM을 연결해 상태 확인부터 로그 분석까지 한 흐름으로
            이어갑니다.
          </p>
        </div>
        <span className={configured && session ? "ops-tag live" : "ops-tag"}>
          {configured && session
            ? "운영 API 인증됨"
            : configured
              ? "운영 API 확인 필요"
              : "운영 API 미연동"}
        </span>
      </section>
      {error && (
        <p className="ops-notice error" role="alert">
          {error}
        </p>
      )}
      <section className="ops-panel">
        <div className="ops-panel-heading">
          <h2>연동 구성</h2>
          <span className="ops-muted">서버 설정 기준</span>
        </div>
        <div className="integration-list">
          {entries.map((entry) => (
            <div key={entry.name}>
              <div>
                <strong>{entry.name}</strong>
                <p>{entry.role}</p>
                <code>{entry.variable}</code>
              </div>
              <span className={entry.ready ? "ops-tag live" : "ops-tag"}>
                {entry.ready ? "설정됨" : "미설정"}
              </span>
            </div>
          ))}
        </div>
        <p className="ops-footnote">
          ‘설정됨’은 연결 정보의 등록 여부입니다. 실제 조회 성공 여부는 각
          화면에서 확인합니다. Tempo·Mimir의 데이터 조회 화면은 후속 연동
          대상입니다.
        </p>
      </section>
      <section className="ops-panel">
        <h2>연동 순서</h2>
        <ol className="ops-steps">
          <li>
            <span>01</span>
            <div>
              <strong>인증된 운영 API 준비</strong>
              <p>SSO 세션을 검증하는 서버에 운영 어댑터를 연결합니다.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>서버에 연결 정보 등록</strong>
              <p>
                GitLab·Loki 토큰은 서버 환경 변수로만 보관합니다. 웹 화면에는
                입력하지 않습니다.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>조회 확인 후 변경 권한 부여</strong>
              <p>
                라이선스와 로그 조회를 먼저 확인하고, 메인터넌스 변경 권한과
                감사 기록을 설정합니다.
              </p>
            </div>
          </li>
        </ol>
        <div className="ops-inline">
          <a
            className="ops-button"
            href="https://github.com/majitap/infradash-codex5/blob/main/docs/OPERATIONS-SETUP.md"
            target="_blank"
            rel="noreferrer"
          >
            서버 연동 가이드 <ArrowUpRight size={16} />
          </a>
          <Link className="ops-text-link" href="/logs">
            로그 분석 열기 <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
