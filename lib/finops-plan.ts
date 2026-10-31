import { finOpsData, finOpsSavingsRecommendations } from "@/lib/mock-data";

export const recommendationSavings = (impact: string) =>
  Number(impact.match(/\$([\d,]+)/)?.[1].replaceAll(",", "") ?? 0);
export function calculateSavingsPlan(ids: readonly string[]) {
  const selected = finOpsSavingsRecommendations.filter((r) =>
    ids.includes(r.id),
  );
  const savings = selected.reduce(
    (sum, r) => sum + recommendationSavings(r.impact),
    0,
  );
  return {
    selected,
    savings,
    annual: savings * 12,
    forecast: finOpsData.monthlyTotal - savings,
  };
}
