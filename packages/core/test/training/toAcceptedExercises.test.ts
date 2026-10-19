import { describe, expect, it } from "vitest";

import { routine } from "./goldenWeekInputs";
import { GOLDEN_LIBRARY, idOf, V_TAPER_GOALS, WEDNESDAY_STATE } from "./suggestGolden";
import { goalsWith, libraryExercise, plannedDayOf, stateWith } from "./suggestPlanInputs";
import {
  buildSetSnapshot,
  suggestSession,
  SUGGEST_PARAMS_V1,
  toAcceptedExercises,
} from "../../src/training";

import type { PlanRoutineDay } from "../../src/training";

/*
 * The helper that turns a suggestion into the entries a later ticket stores and the projection counts:
 * only what the suggestion added, never the planned exercises it kept.
 */

const guid = (n: number): string => `00000001-0000-4000-8000-${String(n).padStart(12, "0")}`;

const legs: PlanRoutineDay = (() => {
  const day = routine.days.find((each) => each.weekday === 3);
  if (day === undefined) {
    throw new Error("The golden routine has a Thursday");
  }
  return day;
})();

describe("toAcceptedExercises", () => {
  it("should give only the added exercise of the golden Legs suggestion, not the 5 planned ones", () => {
    const suggestion = suggestSession(
      WEDNESDAY_STATE,
      V_TAPER_GOALS,
      GOLDEN_LIBRARY,
      { plannedDay: legs },
      SUGGEST_PARAMS_V1,
    );
    const press = GOLDEN_LIBRARY.find((each) => each.id === idOf("Incline Dumbbell Press"));
    if (press === undefined) {
      throw new Error("The golden library has the incline press");
    }
    expect(toAcceptedExercises(suggestion, GOLDEN_LIBRARY)).toStrictEqual([
      {
        id: press.id,
        position: 5,
        exercise_id: press.id,
        target_sets: 3,
        target_rir: 2,
        rep_min: 8,
        rep_max: 10,
        exercise: { id: press.id, name: press.name, equipment: "dumbbell", mechanic: "compound" },
        muscles: press.muscles,
        snapshot: buildSetSnapshot(
          { id: press.id, name: press.name, equipment: press.equipment, mechanic: press.mechanic },
          press.muscles,
        ),
      },
    ]);
  });

  it("should freeze the exercise in the snapshot: its name, equipment, mechanic and muscle map", () => {
    const suggestion = suggestSession(
      WEDNESDAY_STATE,
      V_TAPER_GOALS,
      GOLDEN_LIBRARY,
      { plannedDay: legs },
      SUGGEST_PARAMS_V1,
    );
    const [accepted] = toAcceptedExercises(suggestion, GOLDEN_LIBRARY);
    expect(accepted?.snapshot).toMatchObject({
      kind: "exercise",
      ref: idOf("Incline Dumbbell Press"),
      name: "Incline Dumbbell Press",
      equipment: "dumbbell",
      mechanic: "compound",
    });
    expect(accepted?.snapshot.muscles).toContainEqual({
      muscle_id: "chest_upper",
      role: "primary",
      weight: 1,
    });
  });

  it("should give an added exercise its place after the planned ones, with its sets and RIR", () => {
    // The snapshot needs row ids that are GUIDs. The cable row is kept although lats are hot.
    const squat = libraryExercise(guid(1), ["quads"]);
    const cableRow = libraryExercise(guid(2), ["lats", "traps_mid"], { equipment: "cable" });
    const shrug = libraryExercise(guid(3), ["traps_mid"], {
      equipment: "dumbbell",
      mechanic: "isolation",
    });
    const library = [squat, cableRow, shrug];
    const suggestion = suggestSession(
      stateWith({ lats: { heat: 0.6 } }),
      goalsWith({ traps_mid: 2 }),
      library,
      {
        plannedDay: plannedDayOf([
          { exercise: squat, sets: 4 },
          { exercise: cableRow, sets: 4 },
        ]),
      },
      SUGGEST_PARAMS_V1,
    );
    expect(toAcceptedExercises(suggestion, library)).toMatchObject([
      {
        id: guid(3),
        position: 2,
        exercise_id: guid(3),
        target_sets: 3,
        target_rir: 1,
        snapshot: { ref: guid(3), mechanic: "isolation" },
      },
    ]);
  });

  it("should give nothing for a suggestion of nothing", () => {
    const suggestion = suggestSession(
      stateWith({}),
      goalsWith({}),
      GOLDEN_LIBRARY,
      { plannedDay: legs },
      SUGGEST_PARAMS_V1,
    );
    expect(suggestion.kind).toBe("nothing");
    expect(toAcceptedExercises(suggestion, GOLDEN_LIBRARY)).toStrictEqual([]);
  });

  it("should give every exercise of a fresh session, which the suggestion added", () => {
    const suggestion = suggestSession(
      WEDNESDAY_STATE,
      V_TAPER_GOALS,
      GOLDEN_LIBRARY,
      {},
      SUGGEST_PARAMS_V1,
    );
    const accepted = toAcceptedExercises(suggestion, GOLDEN_LIBRARY);
    expect(accepted.map((each) => each.exercise_id)).toStrictEqual([
      idOf("Barbell Deadlift"),
      idOf("Incline Dumbbell Press"),
      idOf("Barbell Squat"),
      idOf("Side Lateral Raise"),
      idOf("Romanian Deadlift"),
      idOf("Barbell Bench Press - Medium Grip"),
    ]);
    expect(accepted.map((each) => each.position)).toStrictEqual([0, 1, 2, 3, 4, 5]);
  });

  it("should throw a RangeError stating the rule when the library lacks a suggested exercise", () => {
    const suggestion = suggestSession(
      WEDNESDAY_STATE,
      V_TAPER_GOALS,
      GOLDEN_LIBRARY,
      { plannedDay: legs },
      SUGGEST_PARAMS_V1,
    );
    let error: unknown;
    try {
      toAcceptedExercises(suggestion, []);
    } catch (thrown) {
      error = thrown;
    }
    expect(error).toStrictEqual(new RangeError("A suggested exercise must be in the library"));
  });
});
