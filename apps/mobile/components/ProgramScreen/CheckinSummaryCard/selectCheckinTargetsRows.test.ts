import { selectCheckinTargetsRows } from "./selectCheckinTargetsRows";

import type { TargetsRow } from "@keylow/api-client";

// The check-in's own row, and the row of the same programme that held before it.

function row(
  id: string,
  source: "start" | "checkin" | "recompute",
  effectiveFrom: string,
  effectiveTo: string | null,
): TargetsRow {
  return {
    id,
    effectiveFrom,
    effectiveTo,
    isCurrent: effectiveTo === null,
    caloriesKcal: 2000,
    proteinG: 120,
    fatG: 70,
    carbsG: 200,
    dowCaloriesKcal: [2000, 2000, 2000, 2000, 2000, 2000, 2000],
    basis: {
      source,
      tdeeKcal: 2500,
      trendWeightKg: 80,
      bmrKcal: 1755,
      goal: "lose",
      ratePctPerWeek: 0.5,
      effectiveRatePctPerWeek: 0.5,
      proteinGPerKg: 1.6,
      fatFraction: 0.4,
      dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
      clamps: [],
    },
  };
}

describe("selectCheckinTargetsRows", () => {
  it("should pick the check-in's row and the row before it, though a recompute row is the current one", () => {
    const history = [
      row("start", "start", "2026-09-25", "2026-10-09"),
      row("checkin", "checkin", "2026-10-09", "2026-10-12"),
      row("recompute", "recompute", "2026-10-12", null),
    ];

    const rows = selectCheckinTargetsRows(history, "2026-10-09", "2026-09-25");

    expect([rows?.targets.id, rows?.previousTargets.id]).toEqual(["checkin", "start"]);
  });

  it("should skip a row that held for no days when it stands right before the check-in's row", () => {
    const history = [
      row("start", "start", "2026-09-25", "2026-10-09"),
      row("same-day recompute", "recompute", "2026-10-09", "2026-10-09"),
      row("checkin", "checkin", "2026-10-09", null),
    ];

    const rows = selectCheckinTargetsRows(history, "2026-10-09", "2026-09-25");

    expect(rows?.previousTargets.id).toBe("start");
  });

  it("should find the check-in's row when an edit on the same day left it holding for no days", () => {
    const history = [
      row("start", "start", "2026-09-25", "2026-10-09"),
      row("checkin", "checkin", "2026-10-09", "2026-10-09"),
      row("recompute", "recompute", "2026-10-09", null),
    ];

    const rows = selectCheckinTargetsRows(history, "2026-10-09", "2026-09-25");

    expect([rows?.targets.id, rows?.previousTargets.id]).toEqual(["checkin", "start"]);
  });

  it("should leave out rows from before the programme began, which are another programme's", () => {
    const history = [
      row("ended", "start", "2026-08-01", "2026-10-09"),
      row("checkin", "checkin", "2026-10-09", null),
    ];

    expect(selectCheckinTargetsRows(history, "2026-10-09", "2026-09-25")).toBeNull();
  });

  it("should give nothing when no row came from a check-in on or after the check-in's day", () => {
    const history = [
      row("start", "start", "2026-09-25", "2026-10-02"),
      row("older checkin", "checkin", "2026-10-02", null),
    ];

    expect(selectCheckinTargetsRows(history, "2026-10-09", "2026-09-25")).toBeNull();
  });
});
