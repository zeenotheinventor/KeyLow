import { describe, expect, it } from "vitest";

import { recordOfMuscles, routine } from "./goldenWeekInputs";
import {
  GOLDEN_LIBRARY,
  idOf,
  STRENGTH_GOALS,
  V_TAPER_GOALS,
  WEDNESDAY_STATE,
} from "./suggestGolden";
import { suggestSession, SUGGEST_PARAMS_V1 } from "../../src/training";

import type {
  MuscleId,
  PlanAdjusted,
  PlanRoutineDay,
  Suggestion,
  SuggestionReason,
} from "../../src/training";

/*
 * The golden suggestion on a planned day, from Zee's agreed document on KEY-396 (Part 4, case a, and the
 * strength case b1): the golden week at Wednesday 14 October 2026, 12:00, with Thursday's planned Legs
 * kept (5 exercises, 16 sets, 50 minutes). Every muscle id, number of sets, score, length and exercise
 * below is a literal copied from the document, never computed from the code under test. The document
 * works scores to 2 decimals, heat to 4 and sets to 2.
 *
 * Zee agreed the add is 3 sets of incline dumbbell press: upper chest scores 18.79 and side delts 11.85,
 * and the lateral raise does not fit the 60 minutes (KEY-396, "Follow the formula").
 */

const THURSDAY = 3;

const legs: PlanRoutineDay = (() => {
  const day = routine.days.find((each) => each.weekday === THURSDAY);
  if (day === undefined) {
    throw new Error("The golden routine has a Thursday");
  }
  return day;
})();

const planAdjustedOf = (suggestion: Suggestion): PlanAdjusted => {
  if (suggestion.kind !== "plan_adjusted") {
    throw new Error("Expected a plan adjusted");
  }
  return suggestion;
};

const roundedTo = (value: number, decimals: number): number =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;

const reason = (
  muscle_id: MuscleId,
  priority: number,
  weekly_sets: number,
  mav_low: number,
  heat: number,
  score: number,
) => ({ muscle_id, priority, weekly_sets, mav_low, heat, score });

const readable = (reasons: readonly SuggestionReason[]) =>
  reasons.map((each) => ({
    ...each,
    weekly_sets: roundedTo(each.weekly_sets, 2),
    heat: roundedTo(each.heat, 4),
    score: roundedTo(each.score, 2),
  }));

describe("the golden Legs day has the shape the document works from", () => {
  it("should hold the 5 planned exercises, 16 sets, of Thursday's Legs", () => {
    expect(legs.exercises.map((each) => each.exercise.name)).toStrictEqual([
      "Barbell Squat",
      "Romanian Deadlift",
      "Leg Press",
      "Seated Leg Curl",
      "Standing Calf Raises",
    ]);
    expect(legs.exercises.reduce((total, each) => total + each.target_sets, 0)).toBe(16);
  });
});

describe("the V-taper user, Wednesday 12:00, Thursday's Legs kept (document case a)", () => {
  const suggestion = planAdjustedOf(
    suggestSession(
      WEDNESDAY_STATE,
      V_TAPER_GOALS,
      GOLDEN_LIBRARY,
      { plannedDay: legs },
      SUGGEST_PARAMS_V1,
    ),
  );

  it("should keep all 5 planned exercises, in order, with their planned sets", () => {
    expect(suggestion.exercises.slice(0, 5)).toStrictEqual(
      legs.exercises.map((each) => ({
        origin: "plan",
        routine_exercise_id: each.id,
        exercise_id: each.exercise_id,
        sets: each.target_sets,
        target_rir: each.target_rir,
      })),
    );
  });

  it("should add 3 sets of incline dumbbell press, 8 to 10 reps at RIR 2, and nothing else", () => {
    expect(suggestion.exercises).toHaveLength(6);
    expect(suggestion.added).toBe(1);
    const added = suggestion.exercises[5];
    expect(added).toMatchObject({
      origin: "added",
      exercise_id: idOf("Incline Dumbbell Press"),
      sets: 3,
      rep_min: 8,
      rep_max: 10,
      target_rir: 2,
    });
  });

  it("should give the lead reason as upper chest: priority 3, 4.80 of 12 sets, heat 0.1300, score 18.79", () => {
    const added = suggestion.exercises[5];
    if (added?.origin !== "added") {
      throw new Error("Expected the added exercise");
    }
    expect(readable(added.reasons)).toStrictEqual([reason("chest_upper", 3, 4.8, 12, 0.13, 18.79)]);
  });

  it("should total 19 sets and read 60 minutes, from a plan of 16 sets and 50 minutes", () => {
    expect(suggestion.sets).toBe(19);
    expect(suggestion.minutes).toBe(60);
    expect(suggestion.planned).toStrictEqual({ sets: 16, minutes: 50 });
  });

  it("should list lats and biceps as skipped for heat", () => {
    expect(
      suggestion.skipped.map((each) => ({ ...each, heat: roundedTo(each.heat, 4) })),
    ).toStrictEqual([
      { muscle_id: "lats", heat: 0.6324 },
      { muscle_id: "biceps", heat: 0.5118 },
    ]);
  });

  it("should say the side lateral raise does not fit: 7 exercises and 22 sets read 70 minutes", () => {
    expect(
      suggestion.no_room && {
        ...suggestion.no_room,
        score: roundedTo(suggestion.no_room.score, 2),
      },
    ).toStrictEqual({ muscle_id: "delt_side", score: 11.85, minutes_if_added: 70 });
    expect(
      suggestion.exercises.some((each) => each.exercise_id === idOf("Side Lateral Raise")),
    ).toBe(false);
  });

  it("should not choose an exercise with lats or biceps as a primary muscle", () => {
    const chosen = new Set(suggestion.exercises.map((exercise) => exercise.exercise_id));
    for (const name of [
      "Pullups",
      "Bent Over Barbell Row",
      "Wide-Grip Lat Pulldown",
      "Barbell Curl",
    ]) {
      expect(chosen.has(idOf(name))).toBe(false);
    }
  });

  it("should add side delts as well, with 75 minutes, and stop at the cap of 2 added", () => {
    // Incline press (6 exercises, 19 sets, 59.5) and the lateral raise (7, 22: 14 + 55 = 69, shown 70).
    const roomy = planAdjustedOf(
      suggestSession(
        WEDNESDAY_STATE,
        V_TAPER_GOALS,
        GOLDEN_LIBRARY,
        { plannedDay: legs, minutes: 75 },
        SUGGEST_PARAMS_V1,
      ),
    );
    expect(roomy.exercises.slice(5).map((each) => each.exercise_id)).toStrictEqual([
      idOf("Incline Dumbbell Press"),
      idOf("Side Lateral Raise"),
    ]);
    expect(roomy.sets).toBe(22);
    expect(roomy.minutes).toBe(70);
    expect(roomy.no_room).toBeNull();
  });

  it("should give the side lateral raise reasons that include the sets of the incline press before it", () => {
    // The press works delt_front at 0.5 and chest_lower at 0.5, but the raise's own primary is delt_side
    // at 5.50 sets, which the press does not touch.
    const roomy = planAdjustedOf(
      suggestSession(
        WEDNESDAY_STATE,
        V_TAPER_GOALS,
        GOLDEN_LIBRARY,
        { plannedDay: legs, minutes: 75 },
        SUGGEST_PARAMS_V1,
      ),
    );
    const raise = roomy.exercises[6];
    if (raise?.origin !== "added") {
      throw new Error("Expected the added raise");
    }
    expect(readable(raise.reasons)).toStrictEqual([reason("delt_side", 3, 5.5, 10, 0.1221, 11.85)]);
  });
});

describe("the V-taper user with 45 minute sessions (document case d, no room)", () => {
  it("should offer nothing, saying no room: the plan reads 50 and upper chest would read 60", () => {
    const result = suggestSession(
      WEDNESDAY_STATE,
      V_TAPER_GOALS,
      GOLDEN_LIBRARY,
      { plannedDay: legs, minutes: 45 },
      SUGGEST_PARAMS_V1,
    );
    expect(result).toMatchObject({
      kind: "nothing",
      why: "no_room",
      no_room: { muscle_id: "chest_upper", minutes_if_added: 60 },
    });
    expect(result.no_room && roundedTo(result.no_room.score, 2)).toBe(18.79);
  });
});

describe("a week whose priorities the plan already covers (document case d)", () => {
  it("should offer nothing, saying the priorities are covered, with the plan untouched", () => {
    // Every muscle exactly at its MAV low (12 for the medium muscles, 10 for the rest) at heat 0.2.
    const medium = new Set<MuscleId>([
      "chest_upper",
      "chest_lower",
      "lats",
      "traps_upper",
      "traps_mid",
      "glute_med",
      "adductors",
    ]);
    const covered = recordOfMuscles((muscle) => ({
      weeklySets: medium.has(muscle) ? 12 : 10,
      heat: 0.2,
    }));
    expect(
      suggestSession(
        covered,
        V_TAPER_GOALS,
        GOLDEN_LIBRARY,
        { plannedDay: legs },
        SUGGEST_PARAMS_V1,
      ),
    ).toStrictEqual({ kind: "nothing", why: "priorities_covered", skipped: [], no_room: null });
  });
});

describe("the strength user, Thursday's Legs kept plus one main lift (document case b1)", () => {
  const suggestion = planAdjustedOf(
    suggestSession(
      WEDNESDAY_STATE,
      STRENGTH_GOALS,
      GOLDEN_LIBRARY,
      { plannedDay: legs },
      SUGGEST_PARAMS_V1,
    ),
  );

  it("should keep the Legs and add 3 sets of barbell deadlift, 3 to 5 reps at RIR 2", () => {
    expect(suggestion.exercises.slice(0, 5).every((each) => each.origin === "plan")).toBe(true);
    expect(suggestion.exercises).toHaveLength(6);
    expect(suggestion.exercises[5]).toMatchObject({
      origin: "added",
      exercise_id: idOf("Barbell Deadlift"),
      sets: 3,
      rep_min: 3,
      rep_max: 5,
      target_rir: 2,
    });
  });

  it("should lead with lower back: priority 3, 2.10 of 10 sets, heat 0, score 23.70", () => {
    const added = suggestion.exercises[5];
    if (added?.origin !== "added") {
      throw new Error("Expected the added exercise");
    }
    expect(readable(added.reasons)[0]).toStrictEqual(reason("lower_back", 3, 2.1, 10, 0, 23.7));
  });

  it("should read 60 minutes and say the bench press would read 70", () => {
    expect(suggestion.minutes).toBe(60);
    expect(suggestion.no_room).toMatchObject({ muscle_id: "chest_lower", minutes_if_added: 70 });
    expect(suggestion.no_room && roundedTo(suggestion.no_room.score, 2)).toBe(19.76);
  });
});
