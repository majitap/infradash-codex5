"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Box,
  Cloud,
  Database,
  GitBranch,
  Layers3,
  Server,
} from "lucide-react";
import {
  topologyNodes,
  runnerBusy,
  runnerCapacity,
  runnerCounts,
} from "@/lib/mock-data";

const mapNodes = [
  {
    node: topologyNodes.find((n) => n.id === "cf-edge")!,
    label: "Cloudflare",
    icon: Cloud,
    className: "map-edge",
  },
  {
    node: topologyNodes.find((n) => n.id === "gitlab-rails")!,
    label: "GitLab",
    icon: GitBranch,
    className: "map-app",
  },
  {
    node: topologyNodes.find((n) => n.id === "gitaly-shard-02")!,
    label: "Gitaly",
    icon: Layers3,
    className: "map-storage",
  },
  {
    node: topologyNodes.find((n) => n.category === "database")!,
    label: "PostgreSQL",
    icon: Database,
    className: "map-database",
  },
  {
    node: topologyNodes.find((n) => n.category === "runner")!,
    label: "EKS 러너",
    icon: Server,
    className: "map-runner",
  },
];
function point(angle: number, r = 96) {
  const a = (angle * Math.PI) / 180;
  return [120 + r * Math.cos(a), 120 + r * Math.sin(a)];
}
function arc(a: number, b: number) {
  const from = point(a),
    to = point(b);
  return `M${from[0]},${from[1]} A96,96 0 0 1 ${to[0]},${to[1]}`;
}

export function InfrastructureCard() {
  const [tab, setTab] = useState<"flow" | "capacity">("flow");
  const [node, setNode] = useState(mapNodes[1].node);
  const utilization = Math.round((runnerBusy / runnerCapacity) * 100);
  return (
    <section
      className="v5-panel infrastructure-panel"
      aria-labelledby="infra-title"
    >
      <div className="v5-panel-head">
        <div>
          <span className="section-kicker">인프라 상태</span>
          <h2 id="infra-title">서로 연결된 서비스</h2>
        </div>
        <Link
          href="/topology"
          className="v5-icon-link"
          aria-label="전체 인프라 구성도 보기"
        >
          <ArrowUpRight size={20} />
        </Link>
      </div>
      <div className="infra-view-switch" role="group" aria-label="인프라 보기">
        <button aria-pressed={tab === "flow"} onClick={() => setTab("flow")}>
          서비스 흐름
        </button>
        <button
          aria-pressed={tab === "capacity"}
          onClick={() => setTab("capacity")}
        >
          러너 용량
        </button>
      </div>
      {tab === "flow" ? (
        <div className="infra-content" key="flow">
          <div
            className="service-flow-map"
            role="group"
            aria-label="인프라 노드를 선택해 상태를 확인하세요"
          >
            <svg
              viewBox="0 0 360 224"
              preserveAspectRatio="none"
              className="service-flow-lines"
              aria-hidden="true"
            >
              <path d="M180 42V82M180 124V146Q180 154 172 154H64Q56 154 56 162V168M180 154V168M180 154H296Q304 154 304 162V168" />
              <path
                className="flow-travel"
                d="M180 42V82M180 124V154H56V168M180 154V168M180 154H304V168"
              />
            </svg>
            <span className="flow-map-annotation">트래픽 경로</span>
            {mapNodes.map(({ node: n, label, icon: Icon, className }) => (
              <button
                key={n.id}
                className={`map-node ${className} ${n.status !== "healthy" ? "node-warning" : ""}`}
                onClick={() => setNode(n)}
                aria-pressed={node.id === n.id}
                aria-label={`${n.name}, ${n.status === "healthy" ? "정상" : "주의"}`}
              >
                <Icon size={17} strokeWidth={1.7} />
                <span>{label}</span>
                <i />
              </button>
            ))}
          </div>
          <div className="node-peek" aria-live="polite">
            <div>
              <span
                className={
                  node.status === "healthy"
                    ? "peek-status"
                    : "peek-status warning"
                }
              >
                <i />
                {node.status === "healthy" ? "정상" : "주의 필요"}
              </span>
              <span className="node-peek-zone">{node.zone}</span>
            </div>
            <h3>{node.name}</h3>
            <div className="node-peek-metrics">
              {node.metrics.latency && (
                <span>
                  응답 <strong>{node.metrics.latency}</strong>
                </span>
              )}
              {node.metrics.cpu !== undefined && (
                <span>
                  CPU <strong>{node.metrics.cpu}%</strong>
                </span>
              )}
              {node.metrics.memory !== undefined && (
                <span>
                  메모리 <strong>{node.metrics.memory}%</strong>
                </span>
              )}
              {!node.metrics.cpu && node.metrics.qps && (
                <span>
                  처리량 <strong>{node.metrics.qps}</strong>
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="infra-content capacity-content" key="capacity">
          <div
            className="segmented-capacity"
            role="img"
            aria-label={`동시 실행 슬롯 ${runnerCapacity}개 중 ${runnerBusy}개 사용, 사용률 ${utilization}%`}
          >
            <svg viewBox="0 0 240 240" aria-hidden="true">
              <defs>
                <linearGradient id="capacity-color">
                  <stop stopColor="#b2a6ff" />
                  <stop offset="1" stopColor="#6254ed" />
                </linearGradient>
              </defs>
              {Array.from({ length: runnerCapacity }, (_, i) => {
                const start = 140 + (i * 260) / runnerCapacity;
                return (
                  <path
                    key={i}
                    d={arc(start, start + 260 / runnerCapacity - 1.6)}
                    stroke={
                      i < runnerBusy
                        ? "url(#capacity-color)"
                        : "var(--soft-purple)"
                    }
                    strokeWidth="13"
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>
            <div>
              <span>슬롯 사용률</span>
              <strong>
                {utilization}
                <small>%</small>
              </strong>
              <span>
                {runnerBusy} / {runnerCapacity}개 사용 중
              </span>
            </div>
          </div>
          <div className="capacity-stats">
            <span>
              <i className="green" />
              온라인<strong>{runnerCounts.online}</strong>
            </span>
            <span>
              <i className="gray" />
              오프라인<strong>{runnerCounts.offline}</strong>
            </span>
            <span>
              <i className="amber" />
              일시정지<strong>{runnerCounts.paused}</strong>
            </span>
          </div>
        </div>
      )}
      <Link
        href={tab === "flow" ? "/topology" : "/runners"}
        className="infra-footer"
      >
        <span>
          <Box size={15} />
          {tab === "flow"
            ? `${topologyNodes.length}개 구성 요소를 한눈에`
            : `여유 슬롯 ${runnerCapacity - runnerBusy}개`}
        </span>
        <ArrowRight size={18} />
      </Link>
    </section>
  );
}
