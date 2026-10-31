import assert from "node:assert/strict";
import { test } from "node:test";
import { getOverview, pipelineCsv, smoothPath } from "../lib/overview-data";

test("7/30-day cards, chart and report share the same non-overlapping date windows", () => {
  for (const [range, expected] of [
    [7, 3258],
    [30, 13287],
  ] as const) {
    const data = getOverview(range);
    assert.equal(data.days.length, range);
    assert.equal(data.previous.length, range);
    assert.equal(data.total, expected);
    assert.equal(data.success + data.failed + data.canceled, data.total);
    assert.equal(
      data.rate,
      (data.success / (data.success + data.failed)) * 100,
    );
    assert.equal(data.days.at(-1)!.date, "2026-10-31");
    assert.ok(data.previous.at(-1)!.date < data.days[0].date);
    assert.equal(
      new Set([...data.days, ...data.previous].map((d) => d.date)).size,
      range * 2,
    );
  }
});

test("Korean CSV preserves every day and the displayed totals", () => {
  const data = getOverview(30);
  const csv = pipelineCsv(data.days);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const [header, ...rows] = csv.slice(1).split("\r\n");
  assert.equal(header, "날짜,성공,실패,취소");
  assert.equal(rows.length, 30);
  const total = rows.reduce(
    (sum, row) =>
      sum +
      row
        .split(",")
        .slice(1)
        .reduce((a, n) => a + Number(n), 0),
    0,
  );
  assert.equal(total, data.total);
  assert.match(rows.at(-1)!, /^2026-10-31,/);
});

test("smoothed chart never introduces extrema outside an adjacent pair of data values", () => {
  const points = [
    [0, 140],
    [100, 10],
    [200, 100],
    [300, 5],
    [400, 160],
  ] as const;
  const path = smoothPath(points);
  assert.ok(!/NaN|Infinity/.test(path));
  const segments = [
    ...path.matchAll(
      / C ([\d.e+-]+) ([\d.e+-]+), ([\d.e+-]+) ([\d.e+-]+), ([\d.e+-]+) ([\d.e+-]+)/g,
    ),
  ];
  assert.equal(segments.length, points.length - 1);
  segments.forEach((segment, i) => {
    const low = Math.min(points[i][1], points[i + 1][1]),
      high = Math.max(points[i][1], points[i + 1][1]);
    for (const y of [Number(segment[2]), Number(segment[4])])
      assert.ok(y >= low && y <= high);
    assert.equal(Number(segment[5]), points[i + 1][0]);
    assert.equal(Number(segment[6]), points[i + 1][1]);
  });
  assert.equal(smoothPath([]), "");
  assert.equal(smoothPath([[3, 7]]), "M 3 7");
});
