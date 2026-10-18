import { describe, expect, it } from "vitest";

import {
  deriveMusclePriority,
  GOAL_PRESETS_V1,
  MUSCLE_IDS,
  TRAINING_PARAMS_VERSION,
} from "../../src/training";

import type { GoalAnswers, MuscleId, TrainingFocus, TrainingGoal } from "../../src/training";

/*
 * The goal presets v1 that Zee agreed on 2026-10-18 (Linear document "Goal presets and golden suggestions",
 * on KEY-396). Every number below is copied from that document as a literal and is never computed from
 * the code under test or from the params. A change to any value is a new params version (ADR 0002 and
 * ADR 0005, "Consequences"), never an edit of this table.
 */

type Priority = 0 | 1 | 2 | 3;
type Focus = TrainingFocus;

// The document's table 1.2, one row per muscle in the order of the list: aesthetic, strength and hybrid
// bases, then the overlay of each focus. A null cell is a dot in the document: the overlay does not raise
// that muscle.
type BaseRow = readonly [
  MuscleId,
  Priority,
  Priority,
  Priority,
  Priority | null,
  Priority | null,
  Priority | null,
  Priority | null,
  Priority | null,
  Priority | null,
];

/* prettier-ignore */
const BASES_AND_OVERLAYS: readonly BaseRow[] = [
  ["chest_upper", 2, 1, 2, 3, 3, null, null, null, null],
  ["chest_lower", 2, 3, 3, null, 3, null, null, null, null],
  ["delt_front", 1, 3, 3, null, null, null, null, null, null],
  ["delt_side", 2, 1, 2, 3, null, null, null, null, null],
  ["delt_rear", 2, 1, 2, 2, null, null, null, null, null],
  ["lats", 2, 1, 2, 3, null, null, null, null, null],
  ["traps_upper", 0, 1, 1, null, null, null, null, null, null],
  ["traps_mid", 2, 1, 2, 2, null, null, null, null, null],
  ["lower_back", 1, 3, 3, null, null, null, null, null, null],
  ["biceps", 2, 1, 2, null, null, 3, null, null, null],
  ["triceps", 2, 1, 2, null, null, 3, null, null, null],
  ["forearms", 1, 1, 1, null, null, 2, null, null, null],
  ["abs", 0, 0, 0, null, null, null, null, null, null],
  ["obliques", 0, 0, 0, null, null, null, null, null, null],
  ["glute_max", 2, 3, 3, null, null, null, 3, null, null],
  ["glute_med", 0, 0, 0, null, null, null, 3, null, null],
  ["quads", 2, 3, 3, null, null, null, null, 3, null],
  ["hamstrings", 2, 3, 3, null, null, null, null, 3, null],
  ["adductors", 0, 0, 0, null, null, null, null, 2, null],
  ["calves", 1, 0, 1, null, null, null, null, 3, null],
  ["tibialis", 0, 0, 0, null, null, null, null, null, null],
  ["neck", 0, 0, 0, null, null, null, null, null, null],
];

const recordOfBase = (column: 1 | 2 | 3): Record<string, Priority> =>
  Object.fromEntries(BASES_AND_OVERLAYS.map((row) => [row[0], row[column]]));

// The document's table 1.3: the complete priority of every muscle for every goal and single focus.
// Columns: overall, v_taper, chest, arms, glutes, legs.
type FullRow = readonly [MuscleId, Priority, Priority, Priority, Priority, Priority, Priority];

const FOCUS_COLUMNS: readonly Focus[] = ["overall", "v_taper", "chest", "arms", "glutes", "legs"];

/* prettier-ignore */
const AESTHETIC_TABLE: readonly FullRow[] = [
  ["chest_upper", 2, 3, 3, 2, 2, 2],
  ["chest_lower", 2, 2, 3, 2, 2, 2],
  ["delt_front", 1, 1, 1, 1, 1, 1],
  ["delt_side", 2, 3, 2, 2, 2, 2],
  ["delt_rear", 2, 2, 2, 2, 2, 2],
  ["lats", 2, 3, 2, 2, 2, 2],
  ["traps_upper", 0, 0, 0, 0, 0, 0],
  ["traps_mid", 2, 2, 2, 2, 2, 2],
  ["lower_back", 1, 1, 1, 1, 1, 1],
  ["biceps", 2, 2, 2, 3, 2, 2],
  ["triceps", 2, 2, 2, 3, 2, 2],
  ["forearms", 1, 1, 1, 2, 1, 1],
  ["abs", 0, 0, 0, 0, 0, 0],
  ["obliques", 0, 0, 0, 0, 0, 0],
  ["glute_max", 2, 2, 2, 2, 3, 2],
  ["glute_med", 0, 0, 0, 0, 3, 0],
  ["quads", 2, 2, 2, 2, 2, 3],
  ["hamstrings", 2, 2, 2, 2, 2, 3],
  ["adductors", 0, 0, 0, 0, 0, 2],
  ["calves", 1, 1, 1, 1, 1, 3],
  ["tibialis", 0, 0, 0, 0, 0, 0],
  ["neck", 0, 0, 0, 0, 0, 0],
];

/* prettier-ignore */
const STRENGTH_TABLE: readonly FullRow[] = [
  ["chest_upper", 1, 3, 3, 1, 1, 1],
  ["chest_lower", 3, 3, 3, 3, 3, 3],
  ["delt_front", 3, 3, 3, 3, 3, 3],
  ["delt_side", 1, 3, 1, 1, 1, 1],
  ["delt_rear", 1, 2, 1, 1, 1, 1],
  ["lats", 1, 3, 1, 1, 1, 1],
  ["traps_upper", 1, 1, 1, 1, 1, 1],
  ["traps_mid", 1, 2, 1, 1, 1, 1],
  ["lower_back", 3, 3, 3, 3, 3, 3],
  ["biceps", 1, 1, 1, 3, 1, 1],
  ["triceps", 1, 1, 1, 3, 1, 1],
  ["forearms", 1, 1, 1, 2, 1, 1],
  ["abs", 0, 0, 0, 0, 0, 0],
  ["obliques", 0, 0, 0, 0, 0, 0],
  ["glute_max", 3, 3, 3, 3, 3, 3],
  ["glute_med", 0, 0, 0, 0, 3, 0],
  ["quads", 3, 3, 3, 3, 3, 3],
  ["hamstrings", 3, 3, 3, 3, 3, 3],
  ["adductors", 0, 0, 0, 0, 0, 2],
  ["calves", 0, 0, 0, 0, 0, 3],
  ["tibialis", 0, 0, 0, 0, 0, 0],
  ["neck", 0, 0, 0, 0, 0, 0],
];

/* prettier-ignore */
const HYBRID_TABLE: readonly FullRow[] = [
  ["chest_upper", 2, 3, 3, 2, 2, 2],
  ["chest_lower", 3, 3, 3, 3, 3, 3],
  ["delt_front", 3, 3, 3, 3, 3, 3],
  ["delt_side", 2, 3, 2, 2, 2, 2],
  ["delt_rear", 2, 2, 2, 2, 2, 2],
  ["lats", 2, 3, 2, 2, 2, 2],
  ["traps_upper", 1, 1, 1, 1, 1, 1],
  ["traps_mid", 2, 2, 2, 2, 2, 2],
  ["lower_back", 3, 3, 3, 3, 3, 3],
  ["biceps", 2, 2, 2, 3, 2, 2],
  ["triceps", 2, 2, 2, 3, 2, 2],
  ["forearms", 1, 1, 1, 2, 1, 1],
  ["abs", 0, 0, 0, 0, 0, 0],
  ["obliques", 0, 0, 0, 0, 0, 0],
  ["glute_max", 3, 3, 3, 3, 3, 3],
  ["glute_med", 0, 0, 0, 0, 3, 0],
  ["quads", 3, 3, 3, 3, 3, 3],
  ["hamstrings", 3, 3, 3, 3, 3, 3],
  ["adductors", 0, 0, 0, 0, 0, 2],
  ["calves", 1, 1, 1, 1, 1, 3],
  ["tibialis", 0, 0, 0, 0, 0, 0],
  ["neck", 0, 0, 0, 0, 0, 0],
];

const GOALS: readonly TrainingGoal[] = ["aesthetic", "strength", "hybrid"];

const TABLES: Readonly<Record<TrainingGoal, readonly FullRow[]>> = {
  aesthetic: AESTHETIC_TABLE,
  strength: STRENGTH_TABLE,
  hybrid: HYBRID_TABLE,
};

// The document's table 1.4: what each preset ranks first (priority 3) and leaves not targeted (priority 0).
const AESTHETIC_SEVEN = [
  "traps_upper",
  "abs",
  "obliques",
  "glute_med",
  "adductors",
  "tibialis",
  "neck",
];
const STRENGTH_SEVEN = ["abs", "obliques", "glute_med", "adductors", "calves", "tibialis", "neck"];
const HYBRID_SIX = ["abs", "obliques", "glute_med", "adductors", "tibialis", "neck"];
const THE_SIX = ["chest_lower", "delt_front", "lower_back", "glute_max", "quads", "hamstrings"];

type PresetLists = Readonly<{ first: readonly string[]; notTargeted: readonly string[] }>;

const LISTS: Readonly<Record<TrainingGoal, Readonly<Record<Focus, PresetLists>>>> = {
  aesthetic: {
    overall: { first: [], notTargeted: AESTHETIC_SEVEN },
    v_taper: { first: ["chest_upper", "delt_side", "lats"], notTargeted: AESTHETIC_SEVEN },
    chest: { first: ["chest_upper", "chest_lower"], notTargeted: AESTHETIC_SEVEN },
    arms: { first: ["biceps", "triceps"], notTargeted: AESTHETIC_SEVEN },
    glutes: {
      first: ["glute_max", "glute_med"],
      notTargeted: ["traps_upper", "abs", "obliques", "adductors", "tibialis", "neck"],
    },
    legs: {
      first: ["quads", "hamstrings", "calves"],
      notTargeted: ["traps_upper", "abs", "obliques", "glute_med", "tibialis", "neck"],
    },
  },
  strength: {
    overall: { first: THE_SIX, notTargeted: STRENGTH_SEVEN },
    v_taper: {
      first: [...THE_SIX, "chest_upper", "delt_side", "lats"],
      notTargeted: STRENGTH_SEVEN,
    },
    chest: { first: [...THE_SIX, "chest_upper"], notTargeted: STRENGTH_SEVEN },
    arms: { first: [...THE_SIX, "biceps", "triceps"], notTargeted: STRENGTH_SEVEN },
    glutes: {
      first: [...THE_SIX, "glute_med"],
      notTargeted: ["abs", "obliques", "adductors", "calves", "tibialis", "neck"],
    },
    legs: {
      first: [...THE_SIX, "calves"],
      notTargeted: ["abs", "obliques", "glute_med", "tibialis", "neck"],
    },
  },
  hybrid: {
    overall: { first: THE_SIX, notTargeted: HYBRID_SIX },
    v_taper: { first: [...THE_SIX, "chest_upper", "delt_side", "lats"], notTargeted: HYBRID_SIX },
    chest: { first: [...THE_SIX, "chest_upper"], notTargeted: HYBRID_SIX },
    arms: { first: [...THE_SIX, "biceps", "triceps"], notTargeted: HYBRID_SIX },
    glutes: {
      first: [...THE_SIX, "glute_med"],
      notTargeted: ["abs", "obliques", "adductors", "tibialis", "neck"],
    },
    legs: {
      first: [...THE_SIX, "calves"],
      notTargeted: ["abs", "obliques", "glute_med", "tibialis", "neck"],
    },
  },
};

const answersFor = (goal: TrainingGoal, focus: readonly Focus[]): GoalAnswers => ({
  goal,
  focus: [...focus],
  days_per_week: 4,
  session_minutes: 60,
  equipment: ["barbell", "dumbbell"],
  experience: "intermediate",
});

const priorityOf = (goal: TrainingGoal, focus: readonly Focus[]) =>
  deriveMusclePriority(answersFor(goal, focus), GOAL_PRESETS_V1);

const cellOf = (row: FullRow, focus: Focus): Priority => {
  switch (focus) {
    case "overall":
      return row[1];
    case "v_taper":
      return row[2];
    case "chest":
      return row[3];
    case "arms":
      return row[4];
    case "glutes":
      return row[5];
    case "legs":
      return row[6];
  }
};

const columnOf = (table: readonly FullRow[], focus: Focus): Record<string, Priority> =>
  Object.fromEntries(table.map((row) => [row[0], cellOf(row, focus)]));

const musclesWhere = (priority: Readonly<Record<string, number>>, level: number): string[] =>
  Object.entries(priority)
    .filter(([, value]) => value === level)
    .map(([muscle]) => muscle)
    .sort();

describe("GOAL_PRESETS_V1", () => {
  it("should carry the keylow-training-v1 version", () => {
    expect(GOAL_PRESETS_V1.version).toBe("keylow-training-v1");
    expect(GOAL_PRESETS_V1.version).toBe(TRAINING_PARAMS_VERSION);
  });

  // Every v1 value, written out. Changing one is a new params version, never an edit of this one.
  it("should hold exactly the values Zee agreed", () => {
    expect(GOAL_PRESETS_V1).toStrictEqual({
      version: "keylow-training-v1",
      basePriority: {
        aesthetic: recordOfBase(1),
        strength: recordOfBase(2),
        hybrid: recordOfBase(3),
      },
      focusPriority: {
        v_taper: { chest_upper: 3, delt_side: 3, delt_rear: 2, lats: 3, traps_mid: 2 },
        chest: { chest_upper: 3, chest_lower: 3 },
        arms: { biceps: 3, triceps: 3, forearms: 2 },
        glutes: { glute_max: 3, glute_med: 3 },
        legs: { quads: 3, hamstrings: 3, adductors: 2, calves: 3 },
        overall: {},
      },
      exerciseTargets: {
        aesthetic: {
          compound: { repMin: 8, repMax: 10, targetRir: 2 },
          isolation: { repMin: 12, repMax: 15, targetRir: 1 },
        },
        strength: {
          compound: { repMin: 3, repMax: 5, targetRir: 2 },
          isolation: { repMin: 8, repMax: 12, targetRir: 2 },
        },
        hybrid: {
          compound: { repMin: 5, repMax: 8, targetRir: 2 },
          isolation: { repMin: 10, repMax: 15, targetRir: 1 },
        },
      },
      setsPerExercise: { beginner: 2, intermediate: 3, advanced: 4 },
    });
  });

  it("should give every base a priority for each of the 22 muscles", () => {
    for (const base of Object.values(GOAL_PRESETS_V1.basePriority)) {
      expect(Object.keys(base)).toStrictEqual([...MUSCLE_IDS]);
    }
  });
});

describe("deriveMusclePriority", () => {
  describe.each(GOALS)("goal %s", (goal) => {
    describe.each(FOCUS_COLUMNS)("with focus %s", (focus) => {
      const lists = LISTS[goal][focus];
      const priority = priorityOf(goal, [focus]);

      it("should give each of the 22 muscles the agreed priority", () => {
        expect(priority).toStrictEqual(columnOf(TABLES[goal], focus));
      });

      it("should leave exactly the agreed muscles not targeted", () => {
        expect(musclesWhere(priority, 0)).toStrictEqual([...lists.notTargeted].sort());
      });

      it("should rank exactly the agreed muscles first", () => {
        expect(musclesWhere(priority, 3)).toStrictEqual([...lists.first].sort());
      });
    });
  });

  describe("the V-taper user of the golden week (aesthetic with V-taper)", () => {
    const priority = priorityOf("aesthetic", ["v_taper"]);

    it("should rank side delts, lats and upper chest above every other muscle", () => {
      const others = Object.entries(priority).filter(
        ([muscle]) => !["delt_side", "lats", "chest_upper"].includes(muscle),
      );

      expect([priority.delt_side, priority.lats, priority.chest_upper]).toStrictEqual([3, 3, 3]);
      expect(Math.max(...others.map(([, value]) => value))).toBe(2);
    });

    it("should leave abs, obliques and the other five agreed muscles not targeted", () => {
      expect(musclesWhere(priority, 0)).toStrictEqual(
        ["abs", "adductors", "glute_med", "neck", "obliques", "tibialis", "traps_upper"].sort(),
      );
    });
  });

  describe("several focuses", () => {
    it("should take the highest priority per muscle (aesthetic with V-taper and arms)", () => {
      expect(priorityOf("aesthetic", ["v_taper", "arms"])).toStrictEqual({
        chest_upper: 3,
        chest_lower: 2,
        delt_front: 1,
        delt_side: 3,
        delt_rear: 2,
        lats: 3,
        traps_upper: 0,
        traps_mid: 2,
        lower_back: 1,
        biceps: 3,
        triceps: 3,
        forearms: 2,
        abs: 0,
        obliques: 0,
        glute_max: 2,
        glute_med: 0,
        quads: 2,
        hamstrings: 2,
        adductors: 0,
        calves: 1,
        tibialis: 0,
        neck: 0,
      });
    });

    it("should take the highest priority per muscle (hybrid with glutes and legs)", () => {
      expect(priorityOf("hybrid", ["glutes", "legs"])).toStrictEqual({
        chest_upper: 2,
        chest_lower: 3,
        delt_front: 3,
        delt_side: 2,
        delt_rear: 2,
        lats: 2,
        traps_upper: 1,
        traps_mid: 2,
        lower_back: 3,
        biceps: 2,
        triceps: 2,
        forearms: 1,
        abs: 0,
        obliques: 0,
        glute_max: 3,
        glute_med: 3,
        quads: 3,
        hamstrings: 3,
        adductors: 2,
        calves: 3,
        tibialis: 0,
        neck: 0,
      });
    });

    it("should not let a lower focus priority pull a muscle below the goal's base", () => {
      // Strength ranks delt_front 3 and no focus raises it, so legs and arms leave it at 3.
      expect(priorityOf("strength", ["legs", "arms"]).delt_front).toBe(3);
    });

    it("should give the same priorities whatever order the focuses are chosen in", () => {
      expect(priorityOf("aesthetic", ["arms", "v_taper"])).toStrictEqual(
        priorityOf("aesthetic", ["v_taper", "arms"]),
      );
    });

    it("should add nothing for overall beside other focuses", () => {
      expect(priorityOf("strength", ["overall", "v_taper"])).toStrictEqual(
        columnOf(STRENGTH_TABLE, "v_taper"),
      );
    });
  });

  describe("no focus", () => {
    it.each(GOALS)("should give exactly the %s base for an empty focus", (goal) => {
      expect(priorityOf(goal, [])).toStrictEqual(columnOf(TABLES[goal], "overall"));
    });
  });

  it("should return the 22 muscles in the order of the list", () => {
    expect(Object.keys(priorityOf("hybrid", ["chest"]))).toStrictEqual([...MUSCLE_IDS]);
  });
});
