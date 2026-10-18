import { describe, expect, it } from "vitest";

import {
  isMuscleId,
  MUSCLE_GROUPS,
  MUSCLE_IDS,
  MUSCLE_LIST_VERSION,
  MUSCLE_SIZE_CLASSES,
  MUSCLES,
} from "../../src/training";

import type { MuscleGroup, MuscleId, MuscleSizeClass } from "../../src/training";

/* ADR 0005, "The muscle list is the contract", group by group in its order. */
const acceptedList: [MuscleGroup, MuscleId[]][] = [
  ["chest", ["chest_upper", "chest_lower"]],
  ["shoulders", ["delt_front", "delt_side", "delt_rear"]],
  ["back", ["lats", "traps_upper", "traps_mid", "lower_back"]],
  ["arms", ["biceps", "triceps", "forearms"]],
  ["core", ["abs", "obliques"]],
  ["legs", ["glute_max", "glute_med", "quads", "hamstrings", "adductors", "calves", "tibialis"]],
  ["neck", ["neck"]],
];

/* ADR 0005, "The heat model", the size class table. */
const sizeClassTable: Record<MuscleSizeClass, MuscleId[]> = {
  small: [
    "delt_front",
    "delt_side",
    "delt_rear",
    "biceps",
    "triceps",
    "forearms",
    "calves",
    "tibialis",
    "neck",
    "abs",
    "obliques",
  ],
  medium: [
    "chest_upper",
    "chest_lower",
    "lats",
    "traps_upper",
    "traps_mid",
    "glute_med",
    "adductors",
  ],
  large: ["quads", "hamstrings", "glute_max", "lower_back"],
};

describe("the muscle list", () => {
  it("should hold exactly the 22 ids of ADR 0005, in its order", () => {
    expect(MUSCLE_IDS).toEqual([
      "chest_upper",
      "chest_lower",
      "delt_front",
      "delt_side",
      "delt_rear",
      "lats",
      "traps_upper",
      "traps_mid",
      "lower_back",
      "biceps",
      "triceps",
      "forearms",
      "abs",
      "obliques",
      "glute_max",
      "glute_med",
      "quads",
      "hamstrings",
      "adductors",
      "calves",
      "tibialis",
      "neck",
    ]);
    expect(MUSCLE_IDS).toHaveLength(22);
    expect(MUSCLE_IDS).toEqual(acceptedList.flatMap(([, ids]) => ids));
  });

  it("should be list version 1", () => {
    expect(MUSCLE_LIST_VERSION).toBe(1);
  });

  it("should use ids the muscles table accepts", () => {
    for (const id of MUSCLE_IDS) {
      expect(id).toMatch(/^[a-z_]+$/);
    }
  });

  it("should hold the muscle groups of Amendment 1 in the order of the list", () => {
    expect(MUSCLE_GROUPS).toEqual(["chest", "shoulders", "back", "arms", "core", "legs", "neck"]);
    expect(MUSCLE_GROUPS).toEqual(acceptedList.map(([group]) => group));
  });

  it("should hold the three size classes", () => {
    expect(MUSCLE_SIZE_CLASSES).toEqual(["small", "medium", "large"]);
  });

  it.each(acceptedList)("should put every %s muscle in its group", (group, ids) => {
    for (const id of ids) {
      expect(MUSCLES[id].group).toBe(group);
    }
  });

  it.each(Object.entries(sizeClassTable))(
    "should give the %s size class to the muscles of the heat model table",
    (sizeClass, ids) => {
      expect(MUSCLE_IDS.filter((id) => MUSCLES[id].sizeClass === sizeClass).sort()).toEqual(
        [...ids].sort(),
      );
    },
  );

  it("should describe each listed muscle and nothing else", () => {
    expect(Object.keys(MUSCLES)).toEqual([...MUSCLE_IDS]);
  });
});

describe("isMuscleId", () => {
  it.each(MUSCLE_IDS)("should accept %s", (id) => {
    expect(isMuscleId(id)).toBe(true);
  });

  it.each([["delts"], ["Chest_upper"], ["glutes"], [""], ["toString"], [1], [null], [undefined]])(
    "should reject %j",
    (value) => {
      expect(isMuscleId(value)).toBe(false);
    },
  );
});
