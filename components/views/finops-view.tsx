"use client";

import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Coins,
  Leaf,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatedNumber } from "@/components/overview/animated-number";
import {
  finOpsCostBreakdown as breakdown,
  finOpsData as data,
  finOpsSavingsRecommendations as recommendations,
} from "@/lib/mock-data";
import { number } from "@/lib/overview-data";
import {
  calculateSavingsPlan,
  recommendationSavings as amount,
} from "@/lib/finops-plan";

const colors = [
  "#8874d9",
  "#b3a0e6",
  "#a8c8c0",
  "#c9d8cb",
  "#e1c69f",
  "#c8c9d9",
];
const shortNames = [
  "EKS 스팟 러너",
  "온디맨드 인스턴스",
  "아티팩트 스토리지",
  "데이터베이스",
  "Gitaly 스토리지",
  "네트워크",
];

export function FinOpsView() {
  const [selected, setSelected] = useState(0);
  const [chosen, setChosen] = useState<string[]>([]);
  const row = breakdown[selected];
  const { savings, forecast } = calculateSavingsPlan(chosen);
  const before = data.monthlyTotal / (1 + data.monthlyDelta / 100);
  function toggle(id: string) {
    setChosen((ids) =>
      ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id],
    );
  }
  function exportPlan() {
    const rows = recommendations.filter((r) => chosen.includes(r.id));
    const csv =
      "\uFEFF제안,예상 월 절감액(USD)\r\n" +
      rows.map((r) => `"${r.title}",${amount(r.impact)}`).join("\r\n") +
      `\r\n합계,${savings}\r\n예상 월 비용,${forecast}`;
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "infradash-savings-plan.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("선택한 절감안을 리포트로 저장했습니다");
  }
  return (
    <div className="legacy-page v5-finops flex w-full flex-col gap-8">
      <div className="topology-page-heading">
        <div>
          <span className="workspace-eyebrow">
            <Wallet size={14} />
            클라우드 비용
          </span>
          <h1>
            클라우드 비용, 더 가볍게<span>.</span>
          </h1>
          <p>어디에 쓰고 있는지, 얼마나 줄일 수 있는지 확인하세요.</p>
        </div>
        <span className="cost-month">2026년 10월 · USD 기준</span>
      </div>
      <div className="cost-kpis">
        <div className="cost-kpi cost-primary">
          <span>이번 달 인프라 비용</span>
          <strong>
            $<AnimatedNumber value={data.monthlyTotal} />
          </strong>
          <div>
            <span>
              <ArrowDownRight size={16} />
              {Math.abs(data.monthlyDelta)}%
            </span>
            전월 대비 ${number.format(Math.round(before - data.monthlyTotal))}{" "}
            절감
          </div>
        </div>
        <div className="cost-kpi">
          <span>스팟 인스턴스 절감</span>
          <strong>
            $<AnimatedNumber value={data.spotSavings} />
          </strong>
          <div>
            <i className="green" />
            스팟 채택 비중 {data.spotRatio}%
          </div>
        </div>
        <div className="cost-kpi">
          <span>유휴 리소스 비용</span>
          <strong>
            $<AnimatedNumber value={data.idleWaste} />
          </strong>
          <div>
            <i className="amber" />한 번 더 점검할 비용
          </div>
        </div>
        <div className="cost-kpi">
          <span>회수 가능한 스토리지</span>
          <strong>{data.reclaimableStorage}</strong>
          <div>
            <i className="purple" />
            미사용 이미지와 캐시
          </div>
        </div>
      </div>
      <div className="cost-analysis-layout">
        <section
          className="v5-panel cost-distribution"
          aria-labelledby="cost-composition-title"
        >
          <div className="v5-panel-head">
            <div>
              <span className="section-kicker">지출의 구성</span>
              <h2 id="cost-composition-title">비용이 머무는 곳</h2>
            </div>
            <span className="cost-panel-total">6개 항목</span>
          </div>
          <div className="cost-donut-area">
            <div className="cost-donut">
              <svg
                viewBox="0 0 240 240"
                role="img"
                aria-label={`월간 총 비용 ${number.format(data.monthlyTotal)}달러. 선택 항목 ${row.category} ${row.percentage}%`}
              >
                <circle
                  cx="120"
                  cy="120"
                  r="90"
                  fill="none"
                  stroke="var(--subtle)"
                  strokeWidth="24"
                />
                {breakdown.map((item, i) => {
                  const accumulated = breakdown
                      .slice(0, i)
                      .reduce(
                        (sum, r) => sum + (r.cost / data.monthlyTotal) * 100,
                        0,
                      ),
                    percent = (item.cost / data.monthlyTotal) * 100;
                  return (
                    <circle
                      key={item.category}
                      cx="120"
                      cy="120"
                      r="90"
                      fill="none"
                      pathLength="100"
                      stroke={colors[i]}
                      strokeWidth={selected === i ? 28 : 20}
                      strokeDasharray={`${percent - 0.9} ${100 - percent + 0.9}`}
                      strokeDashoffset={-accumulated}
                      transform="rotate(-90 120 120)"
                      className={selected === i ? "cost-selected-segment" : ""}
                      onPointerEnter={() => setSelected(i)}
                    />
                  );
                })}
              </svg>
              <div>
                <span>{shortNames[selected]}</span>
                <strong>
                  $<AnimatedNumber value={row.cost} />
                </strong>
                <small>전체 비용의 {row.percentage}%</small>
              </div>
            </div>
            <div className="cost-distribution-note">
              <span className="cost-note-icon">
                <Coins size={20} />
              </span>
              <h3>
                {selected === 0
                  ? "스팟을 잘 활용하고 있어요"
                  : `${shortNames[selected]} 비용`}
              </h3>
              <p>
                {selected === 0
                  ? "스팟 인스턴스로 빌드 비용을 낮추고 있어요. 사용 비중과 안정성을 함께 확인해 보세요."
                  : `${row.category}에 이번 달 $${number.format(row.cost)}를 사용했어요.`}
              </p>
              <span className="cost-row-status">{row.status}</span>
            </div>
          </div>
          <div className="cost-breakdown-label">
            <span>인프라 항목</span>
            <span>월 비용 / 비중</span>
          </div>
          <div
            className="cost-breakdown-list"
            role="group"
            aria-label="지출 항목 선택"
          >
            {breakdown.map((item, i) => (
              <button
                key={item.category}
                onClick={() => setSelected(i)}
                aria-pressed={selected === i}
              >
                <i style={{ background: colors[i] }} />
                <span className="cost-category-name">{shortNames[i]}</span>
                <span className="cost-category-bar">
                  <i
                    style={{
                      width: `${(item.percentage / 32.4) * 100}%`,
                      background: colors[i],
                    }}
                  />
                </span>
                <strong>${number.format(item.cost)}</strong>
                <span className="cost-category-percent">
                  {item.percentage}%
                </span>
                <ArrowUpRight size={14} />
              </button>
            ))}
          </div>
          <div className="cost-distribution-footer">
            <span>합계</span>
            <strong>${number.format(data.monthlyTotal)}</strong>
          </div>
        </section>
        <section
          className="v5-panel cost-simulator"
          aria-labelledby="savings-title"
        >
          <div className="v5-panel-head">
            <div>
              <span className="section-kicker">절감안 시뮬레이션</span>
              <h2 id="savings-title">가볍게 만들 여지가 있어요</h2>
            </div>
            <Leaf size={20} />
          </div>
          <p className="cost-simulator-intro">
            제안을 선택하고, 다음 달 예상 비용을 살펴보세요.
          </p>
          <div className="savings-options">
            {recommendations.map((r) => (
              <button
                key={r.id}
                className="savings-option"
                aria-pressed={chosen.includes(r.id)}
                onClick={() => toggle(r.id)}
              >
                <span
                  className={
                    chosen.includes(r.id)
                      ? "savings-check checked"
                      : "savings-check"
                  }
                >
                  {chosen.includes(r.id) && <Check size={12} />}
                </span>
                <span>
                  <strong>{r.title}</strong>
                  <small>{r.effort.split(" (")[0]}</small>
                  <span className="savings-option-amount">
                    월 ${number.format(amount(r.impact))} 절감 예상
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="cost-forecast">
            <div>
              <span>선택한 제안을 반영하면</span>
              <span>{chosen.length}개 선택</span>
            </div>
            <strong>
              $<AnimatedNumber value={forecast} />
              <span>/ 월</span>
            </strong>
            <div className="forecast-comparison">
              <span>현재 ${number.format(data.monthlyTotal)}</span>
              <span className={savings > 0 ? "forecast-saving" : ""}>
                {savings > 0
                  ? `−$${number.format(savings)}`
                  : "제안을 선택해 보세요"}
              </span>
            </div>
            <div className="forecast-track">
              <i
                style={{ width: `${(forecast / data.monthlyTotal) * 100}%` }}
              />
            </div>
            <span className="forecast-annual">
              연간 최대 $<AnimatedNumber value={savings * 12} /> 절감 예상
            </span>
          </div>
          <button
            className="export-savings"
            onClick={exportPlan}
            disabled={chosen.length === 0}
          >
            <ArrowDownToLine size={17} />
            선택한 절감안 저장
          </button>
          <p className="cost-simulation-note">
            모의 데이터로 절감액을 단순 합산한 예상치예요. 실제 클라우드 설정은
            변경하지 않아요.
          </p>
        </section>
      </div>
    </div>
  );
}
