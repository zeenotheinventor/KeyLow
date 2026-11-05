import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { actualStateAt, THURSDAY_EVENING } from "./goldenWeekInputs";
import { MUSCLE_GROUP_NAMES, MUSCLE_NAMES } from "../../src/copy";
import { muscleIdSchema } from "../../src/schemas";
import {
  filterMuscleListGroups,
  MUSCLE_GROUPS,
  MUSCLE_IDS,
  muscleListGroups,
  musclesAboveRest,
  MUSCLES,
} from "../../src/training";

// A record keyed by the muscle enum must hold every muscle id.
const heatStatesSchema = z.record(
  muscleIdSchema,
  z.object({ heat: z.number(), readyAt: z.string() }),
);

const NOW = "2026-10-15T18:00:00.000Z";

/*
 * The rows of the `body · muscle-list` board, Actual, now (Thursday 15 October, 19:00 in London), as the
 * canvas draws them: [name, heat percent, step, ready in hours]. The canvas was computed by core on the
 * golden week, and these are its literals.
 */
const boardGroups: [string, [string, number, number, number][]][] = [
  [
    "Chest",
    [
      ["Upper chest", 5, 1, 0],
      ["Lower chest", 5, 1, 0],
    ],
  ],
  [
    "Shoulders",
    [
      ["Front delts", 4, 0, 0],
      ["Side delts", 3, 0, 0],
      ["Rear delts", 9, 1, 0],
    ],
  ],
  [
    "Back",
    [
      ["Lats", 24, 1, 0],
      ["Upper traps", 0, 0, 0],
      ["Mid traps", 17, 1, 0],
      ["Lower back", 21, 1, 0],
    ],
  ],
  [
    "Arms",
    [
      ["Biceps", 14, 1, 0],
      ["Triceps", 5, 1, 0],
      ["Forearms", 3, 0, 0],
    ],
  ],
  [
    "Core",
    [
      ["Abs", 0, 0, 0],
      ["Obliques", 0, 0, 0],
    ],
  ],
  [
    "Legs",
    [
      ["Glutes", 40, 3, 19],
      ["Side glutes", 0, 0, 0],
      ["Quads", 50, 3, 27],
      ["Hamstrings", 55, 3, 31],
      ["Adductors", 0, 0, 0],
      ["Calves", 20, 1, 0],
      ["Shins", 0, 0, 0],
    ],
  ],
  ["Neck", [["Neck", 0, 0, 0]]],
];

describe("muscleListGroups", () => {
  const states = actualStateAt(THURSDAY_EVENING);
  const groups = muscleListGroups(states, NOW);

  it("should give the seven groups in the order of the muscle list", () => {
    expect(groups.map(({ group }) => group)).toStrictEqual([...MUSCLE_GROUPS]);
    expect(groups.map(({ group }) => MUSCLE_GROUP_NAMES[group])).toStrictEqual([
      "Chest",
      "Shoulders",
      "Back",
      "Arms",
      "Core",
      "Legs",
      "Neck",
    ]);
  });

  it("should give 22 rows and each muscle once", () => {
    const muscles = groups.flatMap(({ rows }) => rows.map(({ muscle }) => muscle));

    expect(muscles).toHaveLength(22);
    expect([...muscles].sort()).toStrictEqual([...MUSCLE_IDS].sort());
  });

  it("should put each muscle in its own group", () => {
    for (const { group, rows } of groups) {
      for (const { muscle } of rows) {
        expect(MUSCLES[muscle].group).toBe(group);
      }
    }
  });

  it("should draw the rows of the board: name, heat percent, step and ready in hours", () => {
    expect(
      groups.map(({ group, rows }) => [
        MUSCLE_GROUP_NAMES[group],
        rows.map(({ muscle, heatPercent, heatStep, readyInHours }) => [
          MUSCLE_NAMES[muscle],
          heatPercent,
          heatStep,
          readyInHours,
        ]),
      ]),
    ).toStrictEqual(boardGroups);
  });

  it("should read ready in hours from the moment given, 0 for a muscle that is ready", () => {
    const later = muscleListGroups(states, "2026-10-16T18:00:00.000Z");
    const hamstrings = later
      .flatMap(({ rows }) => rows)
      .find(({ muscle }) => muscle === "hamstrings");

    expect(hamstrings?.readyInHours).toBe(7);
  });
});

describe("muscleListGroups, properties", () => {
  it("should hold every muscle once and give a step from 0 to 5 for any heat", () => {
    const heats = fc.array(fc.double({ min: 0, max: 1, noNaN: true }), {
      minLength: MUSCLE_IDS.length,
      maxLength: MUSCLE_IDS.length,
    });

    fc.assert(
      fc.property(heats, (values) => {
        const states = heatStatesSchema.parse(
          Object.fromEntries(
            MUSCLE_IDS.map((muscle, index) => [muscle, { heat: values[index] ?? 0, readyAt: NOW }]),
          ),
        );
        const rows = muscleListGroups(states, NOW).flatMap((group) => group.rows);

        expect(rows).toHaveLength(22);
        for (const { heatStep } of rows) {
          expect(heatStep).toBeGreaterThanOrEqual(0);
          expect(heatStep).toBeLessThanOrEqual(5);
        }
      }),
    );
  });
});

describe("musclesAboveRest", () => {
  const groups = muscleListGroups(actualStateAt(THURSDAY_EVENING), NOW);
  const { rows, moreAtRest } = musclesAboveRest(groups);

  it("should give the 12 muscles of the web board, hottest first", () => {
    expect(rows.map(({ muscle }) => MUSCLE_NAMES[muscle])).toStrictEqual([
      "Hamstrings",
      "Quads",
      "Glutes",
      "Lats",
      "Lower back",
      "Calves",
      "Mid traps",
      "Biceps",
      "Rear delts",
      "Upper chest",
      "Lower chest",
      "Triceps",
    ]);
  });

  it("should count the muscles it leaves out, which are at rest", () => {
    expect(moreAtRest).toBe(10);
    expect(rows.length + moreAtRest).toBe(MUSCLE_IDS.length);
  });

  it("should keep the order of the muscle list among muscles of the same heat", () => {
    const fivePercent = rows.filter(({ heatPercent }) => heatPercent === 5);

    expect(fivePercent.map(({ muscle }) => muscle)).toStrictEqual([
      "chest_upper",
      "chest_lower",
      "triceps",
    ]);
  });

  it("should give no rows when every muscle is at rest", () => {
    const rested = groups.map(({ group, rows: groupRows }) => ({
      group,
      rows: groupRows.map((row) => ({ ...row, heatPercent: 0, heatStep: 0 })),
    }));

    expect(musclesAboveRest(rested)).toStrictEqual({ rows: [], moreAtRest: 22 });
  });
});

describe("filterMuscleListGroups", () => {
  const groups = muscleListGroups(actualStateAt(THURSDAY_EVENING), NOW);
  const namesIn = (filtered: ReturnType<typeof filterMuscleListGroups>) =>
    filtered.flatMap(({ rows }) => rows.map(({ muscle }) => MUSCLE_NAMES[muscle]));

  it("should keep everything for an empty or blank query", () => {
    expect(filterMuscleListGroups(groups, "")).toStrictEqual(groups);
    expect(filterMuscleListGroups(groups, "   ")).toStrictEqual(groups);
  });

  it("should keep the muscles whose name holds the query, ignoring case and the spaces around it", () => {
    expect(namesIn(filterMuscleListGroups(groups, " DELTS "))).toStrictEqual([
      "Front delts",
      "Side delts",
      "Rear delts",
    ]);
  });

  it("should find a capitalised name from a lowercase query", () => {
    expect(namesIn(filterMuscleListGroups(groups, "ham"))).toStrictEqual(["Hamstrings"]);
  });

  it("should drop a group that has no muscle left", () => {
    const filtered = filterMuscleListGroups(groups, "traps");

    expect(filtered.map(({ group }) => group)).toStrictEqual(["back"]);
  });

  it("should give no groups when nothing matches", () => {
    expect(filterMuscleListGroups(groups, "zzz")).toStrictEqual([]);
  });
});
