import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateSavingsPlan,
  recommendationSavings,
} from "../lib/finops-plan";

test("savings preview uses only selected recommendations and never double counts an ID", () => {
  const empty = calculateSavingsPlan([]);
  assert.equal(empty.forecast, 38420);
  assert.equal(empty.savings, 0);
  const plan = calculateSavingsPlan(["rec-01", "rec-02"]);
  assert.equal(plan.forecast, 35960);
  assert.equal(plan.savings, 2460);
  assert.equal(plan.annual, 29520);
  assert.equal(plan.selected.length, 2);
  assert.deepEqual(
    calculateSavingsPlan(["rec-01", "rec-02", "rec-01", "unknown"]),
    plan,
  );
  const all = calculateSavingsPlan(["rec-01", "rec-02", "rec-03"]);
  assert.equal(all.forecast, 35470);
  assert.equal(all.annual, 35400);
});

test("currency amounts retain thousands separators while non-amount text becomes zero", () => {
  assert.equal(recommendationSavings("$1,620 / 월 절감"), 1620);
  assert.equal(recommendationSavings("예상 금액 없음"), 0);
});
