"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  GitBranch,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatedNumber } from "@/components/overview/animated-number";
import { FlowChart } from "@/components/overview/flow-chart";
import { InfrastructureCard } from "@/components/overview/infrastructure-card";
import { PipelineDetail } from "@/components/overview/pipeline-detail";
import { pipelineStatus } from "@/components/overview/pipeline-status";
import {
  avgQueueSeconds,
  recentPipelines,
  runnerCounts,
  runnerCapacity,
  finOpsData,
  incidents,
  type RecentPipeline,
} from "@/lib/mock-data";
import {
  getOverview,
  number,
  pipelineCsv,
  smoothPath,
  type OverviewRange,
} from "@/lib/overview-data";

function MetricWave({
  data,
  featured = false,
}: {
  data: number[];
  featured?: boolean;
}) {
  const id = useId().replaceAll(":", "");
  const min = Math.min(...data) - 2,
    max = Math.max(...data) + 2;
  const points = data.map(
    (n, i) =>
      [
        (i / (data.length - 1)) * 240,
        64 - ((n - min) / (max - min)) * 48,
      ] as const,
  );
  const line = smoothPath(points);
  return (
    <svg
      className={featured ? "metric-wave featured-wave" : "metric-wave"}
      viewBox="0 0 240 80"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`wave-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop
            stopColor="currentColor"
            stopOpacity={featured ? ".24" : ".12"}
          />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L240 80 L0 80Z`} fill={`url(#wave-${id})`} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={featured ? "2" : "2.5"}
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={240} cy={points.at(-1)![1]} r="3" fill="currentColor" />
    </svg>
  );
}

type Filter = "all" | "running" | "failed";
export function OverviewView() {
  const [range, setRange] = useState<OverviewRange>(7);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [pipeline, setPipeline] = useState<RecentPipeline | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const summary = getOverview(range);
  const { days, previous, rate, delta, total } = summary;
  const list = recentPipelines
    .filter((p) => filter === "all" || p.status === filter)
    .slice(0, 5);
  const openIncidents = incidents.filter((i) => i.status !== "resolved").length;
  const goalGap = Math.max(0, 95 - rate);
  function downloadReport() {
    const url = URL.createObjectURL(
      new Blob([pipelineCsv(days)], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `infradash-${range}days-2026-10-31.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`최근 ${range}일 실행 리포트를 저장했습니다`);
  }
  function refresh() {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      setRefreshed(true);
      toast.success("2026.10.31 스냅샷을 다시 확인했습니다");
    }, 560);
  }
  return (
    <div className="overview v5-overview">
      <div className="v5-page-intro">
        <div>
          <div className="workspace-eyebrow">
            <span />
            Majitap 워크스페이스
          </div>
          <h1>
            인프라, 더 선명하게<span>.</span>
          </h1>
          <p>지금의 상태와 다음에 할 일을 한 화면에서.</p>
        </div>
        <div className="v5-intro-actions">
          <div className="v5-snapshot">
            <span>2026년 10월 31일</span>
            <span>토요일 · 10:12 스냅샷</span>
          </div>
          <button className="v5-export" onClick={downloadReport}>
            <ArrowDownToLine size={18} />
            <span>리포트 내보내기</span>
          </button>
        </div>
      </div>
      <div className="v5-overview-toolbar">
        <div className="v5-period-control" role="group" aria-label="조회 기간">
          {([7, 30] as const).map((n) => (
            <button
              key={n}
              aria-pressed={range === n}
              onClick={() => {
                setRange(n);
                setSelectedDate(null);
              }}
            >
              최근 {n}일
            </button>
          ))}
        </div>
        <div className="overview-status-tools">
          <Link href="/incidents" className="quiet-alert">
            <span />
            {openIncidents}건 확인 필요
            <ChevronRight size={14} />
          </Link>
          <button
            className="v5-refresh"
            aria-label="스냅샷 다시 확인"
            aria-busy={refreshing}
            disabled={refreshing}
            onClick={refresh}
          >
            <RefreshCw
              size={15}
              className={refreshing ? "is-refreshing" : ""}
            />
            <span>
              {refreshing ? "확인 중" : refreshed ? "방금 확인" : "최근 스냅샷"}
            </span>
          </button>
        </div>
      </div>

      <div className="v5-metric-grid">
        <Link href="/pipelines" className="v5-metric v5-featured-metric">
          <div className="v5-metric-label">
            <span>파이프라인 성공률</span>
            <ArrowUpRight size={18} />
          </div>
          <div className="v5-metric-value">
            <AnimatedNumber value={rate} digits={1} />
            <span>%</span>
          </div>
          <div className="v5-metric-bottom">
            <span className="v5-change">
              <TrendingUp size={14} />
              {delta >= 0 ? "+" : ""}
              {delta.toFixed(1)}%p
            </span>
            <span>이전 {range}일 대비</span>
          </div>
          <div className="metric-goal">
            <span>
              {goalGap > 0
                ? `목표 95%까지 ${goalGap.toFixed(1)}%p`
                : `목표 95% 달성`}
            </span>
            <span className="goal-track">
              <i style={{ width: `${Math.min((rate / 95) * 100, 100)}%` }} />
            </span>
          </div>
          <MetricWave
            featured
            data={days.map((d) => (d.success / (d.success + d.failed)) * 100)}
          />
        </Link>
        <Link href="/pipelines" className="v5-metric">
          <div className="v5-metric-label">
            <span>전체 파이프라인</span>
            <ArrowUpRight size={18} />
          </div>
          <div className="v5-metric-value">
            <AnimatedNumber value={total} />
            <span>회</span>
          </div>
          <div className="v5-metric-bottom">
            <span className="metric-dot purple" />
            최근 {range}일 실행
          </div>
          <div className="metric-mini-summary">
            <span>
              성공 <strong>{number.format(summary.success)}</strong>
            </span>
            <span>
              실패 <strong>{number.format(summary.failed)}</strong>
            </span>
          </div>
        </Link>
        <Link href="/runners" className="v5-metric">
          <div className="v5-metric-label">
            <span>온라인 러너</span>
            <ArrowUpRight size={18} />
          </div>
          <div className="v5-metric-value">
            <AnimatedNumber value={runnerCounts.online} />
            <span>/ {runnerCounts.all}대</span>
          </div>
          <div className="v5-metric-bottom">
            <span className="metric-dot green" />
            동시 작업 {runnerCapacity}개 수용
          </div>
          <div
            className="runner-availability"
            role="img"
            aria-label={`온라인 ${runnerCounts.online}, 오프라인 ${runnerCounts.offline}, 일시정지 ${runnerCounts.paused}`}
          >
            {Array.from({ length: runnerCounts.all }, (_, i) => (
              <i
                key={i}
                className={
                  i < runnerCounts.online
                    ? "available"
                    : i < runnerCounts.online + runnerCounts.offline
                      ? "offline"
                      : "paused"
                }
              />
            ))}
          </div>
        </Link>
        <Link href="/pipelines" className="v5-metric">
          <div className="v5-metric-label">
            <span>평균 대기 시간</span>
            <ArrowUpRight size={18} />
          </div>
          <div className="v5-metric-value">
            <AnimatedNumber value={avgQueueSeconds} />
            <span>초</span>
          </div>
          <div className="v5-metric-bottom">
            <span className="metric-dot green" />
            러너 할당까지 걸린 시간
          </div>
          <div className="queue-context">
            <Clock3 size={16} />
            <span>작업 생성 → 러너 할당</span>
          </div>
        </Link>
      </div>

      <div className="v5-analysis-grid">
        <FlowChart
          days={days}
          previous={previous}
          total={total}
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
        />
        <InfrastructureCard />
      </div>

      <div className="v5-analysis-grid v5-lower-grid">
        <section
          className="v5-panel v5-recent-panel"
          aria-labelledby="recent-pipelines-title"
        >
          <div className="v5-panel-head">
            <div>
              <span className="section-kicker">최근 실행</span>
              <h2 id="recent-pipelines-title">최근 파이프라인</h2>
            </div>
            <Link
              href="/pipelines"
              className="v5-icon-link"
              aria-label="전체 파이프라인 보기"
            >
              <ArrowUpRight size={20} />
            </Link>
          </div>
          <div
            className="v5-pipeline-tabs"
            role="group"
            aria-label="파이프라인 상태 필터"
          >
            {(
              [
                { key: "all", label: "전체" },
                { key: "running", label: "실행 중" },
                { key: "failed", label: "실패" },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
              >
                {f.label}
                <span>
                  {f.key === "all"
                    ? recentPipelines.length
                    : recentPipelines.filter((p) => p.status === f.key).length}
                </span>
              </button>
            ))}
          </div>
          <div className="v5-pipeline-list" key={filter}>
            {list.map((p) => {
              const meta = pipelineStatus[p.status],
                Icon = meta.icon;
              return (
                <button
                  key={p.id}
                  className="v5-pipeline-row"
                  onClick={() => setPipeline(p)}
                  aria-label={`${p.project} #${p.id} ${meta.label} 상세 보기`}
                >
                  <span className={`v5-pipeline-icon ${p.status}`}>
                    <Icon size={20} />
                  </span>
                  <span className="v5-pipeline-project">
                    <strong>{p.project}</strong>
                    <span>
                      <GitBranch size={13} />
                      {p.ref}
                      <i />#{p.id}
                    </span>
                  </span>
                  <span className="v5-stage-preview" aria-hidden="true">
                    {Array.from({ length: 5 }, (_, i) => (
                      <i
                        key={i}
                        className={
                          p.status === "success"
                            ? "complete"
                            : p.status === "failed"
                              ? i === 1
                                ? "broken"
                                : i < 1
                                  ? "complete"
                                  : ""
                              : i < 1
                                ? "complete"
                                : i === 1
                                  ? "active"
                                  : ""
                        }
                      >
                        {p.status === "success" || i === 0 ? (
                          <Check size={8} />
                        ) : null}
                      </i>
                    ))}
                  </span>
                  <span className={`pipeline-status ${p.status}`}>
                    {meta.label}
                  </span>
                  <span className="v5-pipeline-time">
                    {Math.floor(p.durationSeconds / 60)}분{" "}
                    {p.durationSeconds % 60}초
                  </span>
                  <ChevronRight className="pipeline-row-chevron" size={16} />
                </button>
              );
            })}
          </div>
          <Link href="/projects" className="recent-panel-footer">
            <span>모든 프로젝트 둘러보기</span>
            <ArrowRight size={16} />
          </Link>
        </section>

        <section
          className="v5-panel v5-attention-panel"
          aria-labelledby="attention-title"
        >
          <div className="v5-panel-head">
            <div>
              <span className="section-kicker">다음 한 걸음</span>
              <h2 id="attention-title">확인이 필요한 3가지</h2>
            </div>
            <span className="v5-attention-count">3</span>
          </div>
          <div className="v5-attention-list">
            <Link href="/incidents" className="v5-attention-item">
              <span className="attention-number">01</span>
              <div>
                <span className="v5-attention-tag red-tag">
                  인시던트 · 대응 중
                </span>
                <h3>결제 API 응답 오류</h3>
                <p>복구 진행 상황을 확인해 주세요.</p>
              </div>
              <ArrowUpRight size={17} />
            </Link>
            <Link href="/storage" className="v5-attention-item">
              <span className="attention-number">02</span>
              <div>
                <span className="v5-attention-tag amber-tag">
                  스토리지 · 주의
                </span>
                <h3>Gitaly 볼륨 사용률 91%</h3>
                <p>여유 공간이 부족해지기 전에 점검하세요.</p>
              </div>
              <ArrowUpRight size={17} />
            </Link>
            <Link href="/finops" className="v5-attention-item">
              <span className="attention-number">03</span>
              <div>
                <span className="v5-attention-tag purple-tag">
                  비용 · 개선 제안
                </span>
                <h3>월 ${number.format(finOpsData.idleWaste)}의 기회</h3>
                <p>사용하지 않는 리소스를 정리할 수 있어요.</p>
              </div>
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <Link href="/ai-ops" className="v5-insight-cta">
            <span className="insight-orbit" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>
              <small>조금 더 깊이 살펴볼까요?</small>
              <strong>AI 운영 센터에서 이어보기</strong>
            </span>
            <ArrowRight size={18} />
          </Link>
        </section>
      </div>
      <PipelineDetail pipeline={pipeline} onClose={() => setPipeline(null)} />
    </div>
  );
}
