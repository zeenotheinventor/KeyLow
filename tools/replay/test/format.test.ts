import { describe, expect, it } from "vitest";

import { formatTable } from "../src/format.ts";

import type { ReplayRow } from "../src/replayRow.ts";

function rowWith(changes: Partial<ReplayRow>): ReplayRow {
  return {
    asOfDate: "2026-04-16",
    eligible: true,
    reasons: [],
    muKcal: 2559.56,
    bandLowKcal: 2290,
    bandHighKcal: 2830,
    gain: 0.7007,
    stepKcal: 59.56,
    stepClamped: false,
    trendWeightKg: 79.592,
    caloriesKcal: 2120,
    proteinG: 127,
    fatG: 72,
    carbsG: 241,
    clamps: [],
    ...changes,
  };
}

/** The cells of the one data line of a table, split on the two-space gap. */
function cellsOf(row: ReplayRow): string[] {
  const dataLine = formatTable([row]).split("\n")[1] ?? "";
  return dataLine.split(/ {2,}/);
}

describe("formatTable", () => {
  it("should print an eligible row as literal cells, to 2, 3 and 1 decimals", () => {
    expect(cellsOf(rowWith({}))).toStrictEqual([
      "2026-04-16",
      "eligible",
      "2559.56",
      "2290-2830",
      "0.701",
      "+59.6",
      "79.59",
      "2120",
      "127",
      "72",
      "241",
      "-",
    ]);
  });

  it("should add clamped after a step that the weekly clamp limited", () => {
    expect(cellsOf(rowWith({ stepKcal: 10, stepClamped: true }))[5]).toBe("+10.0 clamped");
  });

  it("should sign a step that lowered the estimate with a minus and keep clamped", () => {
    expect(cellsOf(rowWith({ stepKcal: -250, stepClamped: true }))[5]).toBe("-250.0 clamped");
  });

  it("should print a plain minus step without the word clamped when it was not clamped", () => {
    expect(cellsOf(rowWith({ stepKcal: -93.4, stepClamped: false }))[5]).toBe("-93.4");
  });

  it("should print a dash for K and the step when the window could not be measured", () => {
    const cells = cellsOf(
      rowWith({
        eligible: false,
        reasons: ["complete_days"],
        gain: null,
        stepKcal: null,
        stepClamped: null,
      }),
    );

    expect(cells[4]).toBe("-");
    expect(cells[5]).toBe("-");
  });

  it.each([
    [["span"], "ineligible (span)"],
    [["weigh_days"], "ineligible (weigh_days)"],
    [["complete_days"], "ineligible (complete_days)"],
    [["span", "weigh_days"], "ineligible (span, weigh_days)"],
    [["span", "weigh_days", "complete_days"], "ineligible (span, weigh_days, complete_days)"],
  ] as const)("should print the reasons %j as %s", (reasons, expected) => {
    const row = rowWith({
      eligible: false,
      reasons: [...reasons],
      gain: null,
      stepKcal: null,
      stepClamped: null,
    });

    expect(formatTable([row]).split("\n")[1]).toContain(`2026-04-16  ${expected}  2559.56`);
  });

  it("should print a dash for the trend weight when the onboarding weight stood in", () => {
    expect(cellsOf(rowWith({ trendWeightKg: null }))[6]).toBe("-");
  });

  it("should list the clamps, comma separated, in the last column", () => {
    expect(cellsOf(rowWith({ clamps: ["floor", "max_deficit"] })).at(-1)).toBe(
      "floor, max_deficit",
    );
  });

  it("should print a dash in the Clamps column when nothing clamped", () => {
    expect(cellsOf(rowWith({ clamps: [] })).at(-1)).toBe("-");
  });

  it("should keep the columns aligned when a cell is wider than its heading", () => {
    const lines = formatTable([
      rowWith({}),
      rowWith({ asOfDate: "2026-04-23", eligible: false, reasons: ["span", "weigh_days"] }),
    ]).split("\n");
    const columnOfMu = lines.map((line) => line.search(/2559\.56|mu/));

    expect(new Set(columnOfMu).size).toBe(1);
  });
});
