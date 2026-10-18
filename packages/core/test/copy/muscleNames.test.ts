import { describe, expect, it } from "vitest";

import { MUSCLE_GROUP_NAMES, MUSCLE_NAMES, NAME_NUMBER } from "../../src/copy";
import { MUSCLE_GROUPS, MUSCLE_IDS, MUSCLES } from "../../src/training";

describe("the muscle names", () => {
  it("should say which of the 22 muscle names read as one thing, and every other as many", () => {
    expect(Object.keys(NAME_NUMBER).sort()).toStrictEqual([...MUSCLE_IDS].sort());
    expect(MUSCLE_IDS.filter((muscle) => NAME_NUMBER[muscle] === "one")).toStrictEqual([
      "chest_upper",
      "chest_lower",
      "lower_back",
      "neck",
    ]);
  });

  it("should name all 22 muscles as the muscle list board does", () => {
    expect(MUSCLE_NAMES).toStrictEqual({
      chest_upper: "Upper chest",
      chest_lower: "Lower chest",
      delt_front: "Front delts",
      delt_side: "Side delts",
      delt_rear: "Rear delts",
      lats: "Lats",
      traps_upper: "Upper traps",
      traps_mid: "Mid traps",
      lower_back: "Lower back",
      biceps: "Biceps",
      triceps: "Triceps",
      forearms: "Forearms",
      abs: "Abs",
      obliques: "Obliques",
      glute_max: "Glutes",
      glute_med: "Side glutes",
      quads: "Quads",
      hamstrings: "Hamstrings",
      adductors: "Adductors",
      calves: "Calves",
      tibialis: "Shins",
      neck: "Neck",
    });
  });

  it("should hold exactly the ids of the muscle list, each name once", () => {
    expect(Object.keys(MUSCLE_NAMES).sort()).toStrictEqual([...MUSCLE_IDS].sort());
    expect(new Set(Object.values(MUSCLE_NAMES)).size).toBe(MUSCLE_IDS.length);
  });
});

describe("the muscle group names", () => {
  it("should name the seven groups as the muscle list board does, in list order", () => {
    expect(MUSCLE_GROUPS.map((group) => MUSCLE_GROUP_NAMES[group])).toStrictEqual([
      "Chest",
      "Shoulders",
      "Back",
      "Arms",
      "Core",
      "Legs",
      "Neck",
    ]);
  });

  it("should hold exactly the groups of the muscle list", () => {
    expect(Object.keys(MUSCLE_GROUP_NAMES).sort()).toStrictEqual([...MUSCLE_GROUPS].sort());
  });

  it("should give every muscle a group that has a name", () => {
    for (const muscle of MUSCLE_IDS) {
      expect(MUSCLE_GROUP_NAMES[MUSCLES[muscle].group]).not.toBe("");
    }
  });
});
