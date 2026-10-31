import { dailyPipelines, successRate, type PipelineDay } from "@/lib/mock-data";

export type OverviewRange = 7 | 30;
export const number = new Intl.NumberFormat("ko-KR");
export const shortDate = (date: string) =>
  `${Number(date.slice(5, 7))}.${Number(date.slice(8))}`;
export const dayTotal = (day: PipelineDay) =>
  day.success + day.failed + day.canceled;
export function getOverview(range: OverviewRange) {
  const days = dailyPipelines.slice(-range);
  const previous = dailyPipelines.slice(-range * 2, -range);
  const sum = (
    key: keyof Pick<PipelineDay, "success" | "failed" | "canceled">,
  ) => days.reduce((n, d) => n + d[key], 0);
  const rate = successRate(days);
  return {
    days,
    previous,
    rate,
    delta: rate - successRate(previous),
    total: days.reduce((n, d) => n + dayTotal(d), 0),
    success: sum("success"),
    failed: sum("failed"),
    canceled: sum("canceled"),
  };
}
export function pipelineCsv(days: PipelineDay[]) {
  return (
    "\uFEFF날짜,성공,실패,취소\r\n" +
    days
      .map((d) => `${d.date},${d.success},${d.failed},${d.canceled}`)
      .join("\r\n")
  );
}

/** Catmull–Rom to cubic Bézier, with a bounded vertical domain and no external chart runtime. */
export function smoothPath(points: readonly (readonly [number, number])[]) {
  if (!points.length) return "";
  let result = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)],
      p1 = points[i],
      p2 = points[i + 1],
      p3 = points[Math.min(points.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    // Keep controls inside their segment's vertical bounds to avoid invented extremes.
    const low = Math.min(p1[1], p2[1]),
      high = Math.max(p1[1], p2[1]);
    result += ` C ${c1[0]} ${Math.max(low, Math.min(high, c1[1]))}, ${c2[0]} ${Math.max(low, Math.min(high, c2[1]))}, ${p2[0]} ${p2[1]}`;
  }
  return result;
}
