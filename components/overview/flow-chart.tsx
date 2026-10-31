"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  ChartNoAxesCombined,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { AnimatedNumber } from "./animated-number";
import { dayTotal, number, shortDate, smoothPath } from "@/lib/overview-data";
import type { PipelineDay } from "@/lib/mock-data";

type Props = {
  days: PipelineDay[];
  previous: PipelineDay[];
  total: number;
  selectedDate: string | null;
  onSelect: (date: string) => void;
};
export function FlowChart({
  days,
  previous,
  total,
  selectedDate,
  onSelect,
}: Props) {
  const [mode, setMode] = useState<"line" | "bar">("line");
  const [compare, setCompare] = useState(true);
  const gradient = useId().replaceAll(":", "");
  const index = Math.max(
    0,
    selectedDate
      ? days.findIndex((d) => d.date === selectedDate)
      : days.length - 1,
  );
  const selected = days[index];
  const max =
    Math.ceil(
      Math.max(
        ...days.map(dayTotal),
        ...(compare ? previous.map(dayTotal) : [0]),
      ) / 100,
    ) * 100;
  const points = (items: PipelineDay[]) =>
    items.map(
      (d, i) =>
        [
          24 + (i / (items.length - 1)) * 672,
          184 - (dayTotal(d) / max) * 160,
        ] as const,
    );
  const current = points(days),
    prior = points(previous),
    line = smoothPath(current),
    selectedPoint = current[index];
  const setIndex = (i: number) =>
    onSelect(days[Math.max(0, Math.min(days.length - 1, i))].date);
  const selectAt = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setIndex(
      Math.round(
        ((((e.clientX - rect.left) / rect.width) * 720 - 24) / 672) *
          (days.length - 1),
      ),
    );
  };
  return (
    <section className="v5-panel flow-panel" aria-labelledby="flow-title">
      <div className="v5-panel-head">
        <div>
          <span className="section-kicker">배포 흐름</span>
          <h2 id="flow-title">파이프라인 실행 추이</h2>
        </div>
        <Link
          className="v5-icon-link"
          href="/pipelines"
          aria-label="파이프라인 분석 보기"
        >
          <ArrowUpRight size={20} />
        </Link>
      </div>
      <div className="flow-chart-top">
        <div className="flow-total">
          <strong>
            <AnimatedNumber value={total} />
          </strong>
          <span>
            회 실행
            <span className="subtle-separator" /> {shortDate(days[0].date)} —{" "}
            {shortDate(days.at(-1)!.date)}
          </span>
        </div>
        <div
          className="chart-visual-toggle"
          role="group"
          aria-label="차트 표시 방식"
        >
          <button
            onClick={() => setMode("line")}
            aria-pressed={mode === "line"}
            aria-label="곡선 차트"
          >
            <ChartNoAxesCombined size={18} />
          </button>
          <button
            onClick={() => setMode("bar")}
            aria-pressed={mode === "bar"}
            aria-label="막대 차트"
          >
            <BarChart3 size={18} />
          </button>
        </div>
      </div>
      <div className="flow-canvas" key={`${days.length}-${mode}`}>
        <div className="flow-axis" aria-hidden="true">
          {[max, max / 2, 0].map((n) => (
            <span key={n}>{number.format(n)}</span>
          ))}
        </div>
        {mode === "line" ? (
          <svg
            className="flow-svg"
            viewBox="0 0 720 208"
            preserveAspectRatio="none"
            onPointerMove={selectAt}
            onPointerDown={selectAt}
            role="img"
            aria-label={`${days.length}일 파이프라인 실행 추이. 아래 날짜 조절기로 수치를 확인할 수 있습니다.`}
          >
            <defs>
              <linearGradient
                id={`area-${gradient}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="var(--primary)"
                  stopOpacity=".24"
                />
                <stop
                  offset="100%"
                  stopColor="var(--primary)"
                  stopOpacity="0"
                />
              </linearGradient>
              <linearGradient
                id={`stroke-${gradient}`}
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop stopColor="#aa9bff" />
                <stop offset="100%" stopColor="var(--primary)" />
              </linearGradient>
            </defs>
            {[24, 104, 184].map((y) => (
              <line
                key={y}
                x1="0"
                x2="720"
                y1={y}
                y2={y}
                className="flow-gridline"
              />
            ))}
            {compare && (
              <path d={smoothPath(prior)} className="flow-previous" />
            )}
            <path
              d={`${line} L 696 184 L 24 184 Z`}
              fill={`url(#area-${gradient})`}
            />
            <line
              x1={selectedPoint[0]}
              x2={selectedPoint[0]}
              y1="16"
              y2="184"
              className="flow-selection-line"
            />
            <path
              d={line}
              stroke={`url(#stroke-${gradient})`}
              className="flow-current"
            />
            <circle
              cx={selectedPoint[0]}
              cy={selectedPoint[1]}
              r="10"
              className="flow-dot-glow"
            />
            <circle
              cx={selectedPoint[0]}
              cy={selectedPoint[1]}
              r="5"
              className="flow-dot"
            />
          </svg>
        ) : (
          <div
            className={`v5-bar-chart ${days.length === 30 ? "v5-month-bars" : ""}`}
            role="group"
            aria-label="날짜별 파이프라인 실행"
          >
            {days.map((day, i) => (
              <button
                key={day.date}
                onClick={() => setIndex(i)}
                aria-pressed={index === i}
                aria-label={`${day.date}, 전체 ${dayTotal(day)}회, 실패 ${day.failed}회${compare ? `, 이전 기간 ${dayTotal(previous[i])}회` : ""}`}
              >
                <span className="v5-bar-track">
                  {compare && (
                    <span
                      className="bar-comparison"
                      style={{
                        height: `${(dayTotal(previous[i]) / max) * 100}%`,
                      }}
                    />
                  )}
                  <span
                    className="v5-bar-fill"
                    style={{ height: `${(dayTotal(day) / max) * 100}%` }}
                  >
                    <span
                      style={{
                        height: `${(day.failed / dayTotal(day)) * 100}%`,
                      }}
                    />
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flow-date-labels" aria-hidden="true">
        {(days.length === 7
          ? days
          : days.filter(
              (_, i) => i === 0 || i === 7 || i === 14 || i === 21 || i === 29,
            )
        ).map((d) => (
          <span key={d.date}>{shortDate(d.date)}</span>
        ))}
      </div>
      <div className="flow-scrubber">
        <button
          aria-label="이전 날짜"
          onClick={() => setIndex(index - 1)}
          disabled={index === 0}
        >
          <ChevronLeft size={16} />
        </button>
        <input
          type="range"
          min="0"
          max={days.length - 1}
          value={index}
          aria-label="차트 날짜 선택"
          aria-valuetext={`${selected.date}, 총 ${dayTotal(selected)}회`}
          onChange={(e) => setIndex(Number(e.target.value))}
        />
        <button
          aria-label="다음 날짜"
          onClick={() => setIndex(index + 1)}
          disabled={index === days.length - 1}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="flow-chart-bottom">
        <button
          className="comparison-button"
          onClick={() => setCompare(!compare)}
          aria-pressed={compare}
        >
          <span className={compare ? "checked" : ""}>
            {compare && <Check size={10} />}
          </span>
          이전 {days.length}일과 비교
        </button>
        <div className="flow-chart-legend">
          <span>
            <i />
            선택 기간
          </span>
          {compare && (
            <span>
              <i className="legend-previous" />
              이전 기간
            </span>
          )}
          {mode === "bar" && (
            <span>
              <i className="legend-failed" />
              실패
            </span>
          )}
        </div>
      </div>
      <div className="flow-selection-summary" aria-live="polite">
        <div>
          <strong>{shortDate(selected.date)}</strong>
          <span>
            {new Date(`${selected.date}T12:00:00`).toLocaleDateString("ko-KR", {
              weekday: "long",
            })}
          </span>
        </div>
        <span>
          <i className="green" />
          성공 <strong>{number.format(selected.success)}</strong>
        </span>
        <span>
          <i className="red" />
          실패 <strong>{selected.failed}</strong>
        </span>
        <span className="selection-canceled">
          취소 <strong>{selected.canceled}</strong>
        </span>
      </div>
    </section>
  );
}
