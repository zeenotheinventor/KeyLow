import { describe, expect, it } from "vitest";

import { MUSCLE_IDS } from "../../../scripts/exercises/muscles";
import {
  formatMuscleShares,
  formatShareWeight,
  parseMuscleShares,
} from "../../../scripts/exercises/muscleShares";

describe("the muscle list", () => {
  it("should hold the 22 ids of ADR 0005, each once", () => {
    expect(MUSCLE_IDS).toHaveLength(22);
    expect(new Set(MUSCLE_IDS).size).toBe(22);
  });
});

describe("formatShareWeight", () => {
  it.each([
    [1, "1.0"],
    [0.5, "0.5"],
    [0.2, "0.2"],
    [0, "0.0"],
    [0.25, "0.25"],
    [0.333, "0.33"],
  ])("should write %d as %s", (weight, text) => {
    expect(formatShareWeight(weight)).toBe(text);
  });
});

describe("formatMuscleShares", () => {
  it("should put primary first, then secondary, then stabiliser, heavier first, then the ADR order", () => {
    expect(
      formatMuscleShares([
        { muscle: "calves", role: "stabiliser", weight: 0.2 },
        { muscle: "triceps", role: "secondary", weight: 0.5 },
        { muscle: "chest_upper", role: "secondary", weight: 0.6 },
        { muscle: "delt_front", role: "secondary", weight: 0.5 },
        { muscle: "chest_lower", role: "primary", weight: 1 },
      ]),
    ).toBe(
      "chest_lower:primary:1.0;chest_upper:secondary:0.6;delt_front:secondary:0.5;triceps:secondary:0.5;calves:stabiliser:0.2",
    );
  });
});

describe("parseMuscleShares", () => {
  it("should read what formatMuscleShares wrote", () => {
    expect(parseMuscleShares("delt_side:primary:1.0;traps_upper:secondary:0.3")).toEqual([
      { muscle: "delt_side", role: "primary", weight: "1.0" },
      { muscle: "traps_upper", role: "secondary", weight: "0.3" },
    ]);
  });

  it("should read an empty field as no shares", () => {
    expect(parseMuscleShares("")).toEqual([]);
  });

  it("should refuse an entry that is not id:role:weight", () => {
    expect(() => parseMuscleShares("delt_side:primary")).toThrow(
      "a muscle share must be written id:role:weight",
    );
  });
});
