import { describe, expect, it } from "vitest";

import { fallingPoints, trendPoint } from "./trendPoints";
import { pointsInRange, rangeWindow, weighInsInRange } from "../../src/weight";

describe("rangeWindow", () => {
  it("should give 7 days as today and the six before", () => {
    expect(rangeWindow(7, "2026-10-17")).toEqual({ from: "2026-10-11", to: "2026-10-17" });
  });

  it.each([
    [30, "2026-10-17", "2026-09-18"],
    [90, "2026-10-17", "2026-07-20"],
    [365, "2026-10-17", "2025-10-18"],
  ] as const)("should give %s days ending %s from %s", (range, today, from) => {
    expect(rangeWindow(range, today)).toEqual({ from, to: today });
  });

  it("should cross a month and a year end", () => {
    expect(rangeWindow(7, "2026-01-03")).toEqual({ from: "2025-12-28", to: "2026-01-03" });
  });

  it("should count the leap day of 2028 in a year", () => {
    expect(rangeWindow(365, "2028-02-29")).toEqual({ from: "2027-03-02", to: "2028-02-29" });
    expect(rangeWindow(365, "2028-03-01")).toEqual({ from: "2027-03-03", to: "2028-03-01" });
    expect(rangeWindow(365, "2028-12-31")).toEqual({ from: "2028-01-02", to: "2028-12-31" });
    expect(rangeWindow(365, "2029-02-28")).toEqual({ from: "2028-03-01", to: "2029-02-28" });
  });

  it("should give a window of exactly the number of days, ends included", () => {
    const { from, to } = rangeWindow(30, "2026-10-17");
    const dayCount = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;

    expect(dayCount).toBe(30);
  });
});

describe("pointsInRange", () => {
  const points = fallingPoints("2026-10-01", 20, 0.1);

  it("should keep exactly the 7 days from 11 to 17 October", () => {
    expect(pointsInRange(points, 7, "2026-10-17").map((point) => point.date)).toEqual([
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
    ]);
  });

  it("should leave out a point after today", () => {
    expect(pointsInRange(points, 7, "2026-10-17").map((point) => point.date)).not.toContain(
      "2026-10-18",
    );
  });

  it("should return the points unchanged, not recomputed", () => {
    const kept = pointsInRange(points, 7, "2026-10-17");

    expect(kept[0]).toBe(points[10]);
  });

  it("should return everything a long range covers", () => {
    expect(pointsInRange(points, 365, "2026-10-20")).toHaveLength(20);
  });

  it("should return nothing for no points or a window with none", () => {
    expect(pointsInRange([], 7, "2026-10-17")).toEqual([]);
    expect(pointsInRange(points, 7, "2026-12-01")).toEqual([]);
  });

  it("should keep a point on each edge of a leap year window", () => {
    const edges = [
      trendPoint({ date: "2027-03-01" }),
      trendPoint({ date: "2027-03-02" }),
      trendPoint({ date: "2028-02-29" }),
      trendPoint({ date: "2028-03-01" }),
    ];

    expect(pointsInRange(edges, 365, "2028-02-29").map((point) => point.date)).toEqual([
      "2027-03-02",
      "2028-02-29",
    ]);
  });
});

describe("weighInsInRange", () => {
  const rows = [
    { id: "a", local_date: "2026-10-10", weight_kg: 81 },
    { id: "b", local_date: "2026-10-11", weight_kg: 80.9 },
    { id: "c", local_date: "2026-10-11", weight_kg: 80.7 },
    { id: "d", local_date: "2026-10-17", weight_kg: 80.5 },
    { id: "e", local_date: "2026-10-18", weight_kg: 80.4 },
  ];

  it("should keep the rows whose local_date is in the window, several to a day, in order", () => {
    expect(weighInsInRange(rows, 7, "2026-10-17").map((row) => row.id)).toEqual(["b", "c", "d"]);
  });

  it("should filter by local_date alone", () => {
    const withInstants = rows.map((row) => ({ ...row, measured_at: "2020-01-01T00:00:00Z" }));

    expect(weighInsInRange(withInstants, 7, "2026-10-17")).toHaveLength(3);
  });

  it("should return the rows themselves", () => {
    expect(weighInsInRange(rows, 7, "2026-10-17")[0]).toBe(rows[1]);
  });

  it("should return nothing for no rows", () => {
    expect(weighInsInRange([], 30, "2026-10-17")).toEqual([]);
  });
});
