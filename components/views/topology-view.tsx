"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Cloud,
  Database,
  GitBranch,
  HardDrive,
  Layers3,
  LayoutGrid,
  List,
  Network,
  Server,
} from "lucide-react";
import { topologyNodes, type TopologyNode } from "@/lib/mock-data";

const coordinates: Record<string, { x: number; y: number; label: string }> = {
  "cf-edge": { x: 480, y: 56, label: "Cloudflare" },
  "haproxy-layer": { x: 480, y: 168, label: "HAProxy" },
  "gitlab-rails": { x: 352, y: 280, label: "GitLab Rails" },
  "gitlab-sidekiq": { x: 608, y: 280, label: "Sidekiq" },
  praefect: { x: 120, y: 392, label: "Praefect" },
  "pg-patroni": { x: 360, y: 392, label: "PostgreSQL" },
  "redis-sentinel": { x: 600, y: 392, label: "Redis Sentinel" },
  "s3-minio": { x: 840, y: 392, label: "S3 / MinIO" },
  "gitaly-shard-01": { x: 96, y: 520, label: "Gitaly 01" },
  "gitaly-shard-02": { x: 288, y: 520, label: "Gitaly 02" },
  "gitaly-shard-03": { x: 480, y: 520, label: "Gitaly 03" },
  "runner-eks-spot": { x: 672, y: 520, label: "EKS 스팟 러너" },
  "runner-gpu-baremetal": { x: 864, y: 520, label: "GPU 러너" },
};
const edges = [
  ["cf-edge", "haproxy-layer"],
  ["haproxy-layer", "gitlab-rails"],
  ["haproxy-layer", "gitlab-sidekiq"],
  ["gitlab-rails", "praefect"],
  ["gitlab-rails", "pg-patroni"],
  ["gitlab-rails", "redis-sentinel"],
  ["gitlab-rails", "s3-minio"],
  ["gitlab-sidekiq", "redis-sentinel"],
  ["gitlab-sidekiq", "runner-eks-spot"],
  ["gitlab-sidekiq", "runner-gpu-baremetal"],
  ["praefect", "gitaly-shard-01"],
  ["praefect", "gitaly-shard-02"],
  ["praefect", "gitaly-shard-03"],
];
const categories = [
  { key: "all", label: "전체" },
  { key: "edge", label: "엣지" },
  { key: "app", label: "애플리케이션" },
  { key: "storage", label: "저장소" },
  { key: "database", label: "데이터베이스" },
  { key: "object", label: "오브젝트" },
  { key: "runner", label: "러너" },
];
const nodeIcons = {
  edge: Cloud,
  app: GitBranch,
  storage: Layers3,
  database: Database,
  object: HardDrive,
  runner: Server,
};
const healthy = (node: TopologyNode) => node.status === "healthy";
function edgePath(from: string, to: string) {
  const a = coordinates[from],
    b = coordinates[to],
    y1 = a.y + 40,
    y2 = b.y - 40,
    mid = (y1 + y2) / 2;
  return `M${a.x} ${y1} C${a.x} ${mid},${b.x} ${mid},${b.x} ${y2}`;
}

export function TopologyView() {
  const [selected, setSelected] = useState(
    topologyNodes.find((n) => n.id === "gitlab-rails")!,
  );
  const [category, setCategory] = useState("all");
  const [mode, setMode] = useState<"map" | "list">("map");
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const center = () => {
      element.scrollLeft = Math.max(
        0,
        (element.scrollWidth - element.clientWidth) / 2,
      );
    };
    const frame = requestAnimationFrame(center);
    const observer = new ResizeObserver(center);
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [mode]);
  const warning = topologyNodes.filter((n) => !healthy(n)).length;
  const visible =
    category === "all"
      ? topologyNodes
      : topologyNodes.filter((n) => n.category === category);
  const StatusIcon = healthy(selected) ? CheckCircle2 : CircleAlert;
  return (
    <div className="legacy-page v5-topology flex w-full flex-col gap-8">
      <div className="topology-page-heading">
        <div>
          <span className="workspace-eyebrow">
            <Network size={14} />
            인프라 구성
          </span>
          <h1>
            엣지부터, 러너까지<span>.</span>
          </h1>
          <p>엣지부터 데이터와 러너까지. 구성 요소를 눌러 상태를 확인하세요.</p>
        </div>
        <span className="topology-health-summary">
          <i />
          {warning}개 구성 요소 주의
        </span>
      </div>
      <div className="topology-toolbar">
        <div
          className="topology-categories"
          role="group"
          aria-label="인프라 분류"
        >
          {categories.map((c) => (
            <button
              key={c.key}
              aria-pressed={category === c.key}
              onClick={() => setCategory(c.key)}
            >
              {c.label}
              <span>
                {c.key === "all"
                  ? topologyNodes.length
                  : topologyNodes.filter((n) => n.category === c.key).length}
              </span>
            </button>
          ))}
        </div>
        <div
          className="chart-visual-toggle"
          role="group"
          aria-label="구성도 표시 방식"
        >
          <button
            aria-label="구성도 보기"
            aria-pressed={mode === "map"}
            onClick={() => setMode("map")}
          >
            <LayoutGrid size={17} />
          </button>
          <button
            aria-label="목록 보기"
            aria-pressed={mode === "list"}
            onClick={() => setMode("list")}
          >
            <List size={17} />
          </button>
        </div>
      </div>
      <div className="topology-layout">
        <section
          className="v5-panel architecture-panel"
          aria-labelledby="architecture-title"
        >
          <div className="architecture-panel-heading">
            <div>
              <h2 id="architecture-title">GitLab 서비스 아키텍처</h2>
              <p>서울 리전 · 구성 관계 예시</p>
            </div>
            <span className="architecture-legend">
              <i className="green" />
              정상
              <i className="amber" />
              주의
            </span>
          </div>
          {mode === "map" ? (
            <>
              <p className="architecture-pan-hint">
                좌우로 움직여 전체 구성도를 살펴보세요
              </p>
              <div className="architecture-viewport" ref={viewport}>
                <div className="architecture-canvas">
                  <svg
                    viewBox="0 0 960 584"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient
                        id="architecture-edge-gradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop stopColor="#c4b9e8" />
                        <stop offset="1" stopColor="#e3ddef" />
                      </linearGradient>
                    </defs>
                    {edges.map(([from, to]) => (
                      <path
                        key={`${from}-${to}`}
                        d={edgePath(from, to)}
                        className={
                          from === selected.id || to === selected.id
                            ? "architecture-edge selected-edge"
                            : "architecture-edge"
                        }
                      />
                    ))}
                  </svg>
                  {topologyNodes.map((node) => {
                    const point = coordinates[node.id],
                      Icon = nodeIcons[node.category];
                    return (
                      <button
                        key={node.id}
                        className={`architecture-node ${category !== "all" && node.category !== category ? "dimmed-node" : ""}`}
                        style={{
                          left: `${(point.x / 960) * 100}%`,
                          top: point.y - 40,
                        }}
                        onClick={() => setSelected(node)}
                        aria-pressed={selected.id === node.id}
                        aria-label={`${node.name}, ${healthy(node) ? "정상" : "주의"}`}
                        aria-controls="node-inspector"
                      >
                        <span>
                          <Icon size={16} />
                          <i className={healthy(node) ? "green" : "amber"} />
                        </span>
                        <strong>{point.label}</strong>
                        <small>
                          {node.metrics.cpu !== undefined
                            ? `CPU ${node.metrics.cpu}%`
                            : node.metrics.latency
                              ? `${node.metrics.latency}`
                              : node.categoryLabel}
                        </small>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="topology-node-list">
              {visible.map((node) => {
                const Icon = nodeIcons[node.category];
                return (
                  <button
                    key={node.id}
                    className="topology-list-node"
                    aria-pressed={selected.id === node.id}
                    onClick={() => setSelected(node)}
                    aria-controls="node-inspector"
                  >
                    <span>
                      <Icon size={18} />
                      <i className={healthy(node) ? "green" : "amber"} />
                    </span>
                    <strong>{node.name}</strong>
                    <small>{node.categoryLabel}</small>
                    <span className="list-node-metrics">
                      {node.metrics.cpu !== undefined
                        ? `CPU ${node.metrics.cpu}%`
                        : (node.metrics.storage ?? node.metrics.qps ?? "정상")}
                      <ArrowUpRight size={15} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="architecture-caption">
            <span>노드 선택으로 세부 수치를 탐색하세요</span>
            <a href="#node-inspector">
              선택한 노드 상세
              <ArrowRight size={14} />
            </a>
          </div>
        </section>
        <aside
          className="v5-panel topology-inspector"
          id="node-inspector"
          aria-label="선택한 노드 상세"
        >
          <div className="inspector-header">
            <span className="section-kicker">노드 인스펙터</span>
            <span
              className={`inspector-status ${healthy(selected) ? "" : "warning"}`}
            >
              <StatusIcon size={14} />
              {healthy(selected) ? "정상" : "주의"}
            </span>
          </div>
          <span className="inspector-category">{selected.categoryLabel}</span>
          <h2>{selected.name}</h2>
          <p className="inspector-zone">{selected.zone}</p>
          <p className="inspector-description">{selected.description}</p>
          <div className="inspector-metrics" aria-live="polite">
            {(
              [
                { key: "cpu", label: "CPU 사용률" },
                { key: "memory", label: "메모리 사용률" },
              ] as const
            ).map((metric) => {
              const value = selected.metrics[metric.key];
              return value !== undefined ? (
                <div key={metric.key} className="inspector-meter">
                  <div>
                    <span>{metric.label}</span>
                    <strong>{value}%</strong>
                  </div>
                  <span
                    className={
                      value >= 75 ? "meter-track elevated" : "meter-track"
                    }
                  >
                    <i style={{ width: `${value}%` }} />
                  </span>
                </div>
              ) : null;
            })}
            {selected.metrics.latency && (
              <div className="inspector-stat">
                <span>응답 시간</span>
                <strong>{selected.metrics.latency}</strong>
              </div>
            )}
            {selected.metrics.qps && (
              <div className="inspector-stat">
                <span>처리량</span>
                <strong>{selected.metrics.qps}</strong>
              </div>
            )}
            {selected.metrics.storage && (
              <div className="inspector-stat">
                <span>스토리지</span>
                <strong>{selected.metrics.storage}</strong>
              </div>
            )}
            {selected.metrics.instances && (
              <div className="inspector-stat">
                <span>구성</span>
                <strong>{selected.metrics.instances}</strong>
              </div>
            )}
          </div>
          <div
            className={`inspector-observation ${healthy(selected) ? "" : "warning"}`}
          >
            <span>
              {healthy(selected)
                ? "안정적으로 동작하고 있어요"
                : "한 번 더 살펴보세요"}
            </span>
            <p>
              {healthy(selected)
                ? "이 스냅샷에서 리소스 초과 징후는 확인되지 않았어요."
                : "리소스 사용률이 높아졌어요. 관련 지표와 조치 제안을 함께 확인하세요."}
            </p>
            <Link href="/ai-ops">
              AI 진단 보기
              <ArrowRight size={16} />
            </Link>
          </div>
          <span className="inspector-timestamp">
            2026.10.31 10:12 · 모의 스냅샷
          </span>
        </aside>
      </div>
    </div>
  );
}
