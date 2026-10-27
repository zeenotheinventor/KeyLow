import { describe, expect, it } from "vitest";

import {
  FULL_GYM,
  GOLDEN_LIBRARY,
  idOf,
  STRENGTH_GOALS,
  V_TAPER_GOALS,
  WEDNESDAY_STATE,
} from "./suggestGolden";
import { suggestSession, SUGGEST_PARAMS_V2 } from "../../src/training";

import type { MuscleId, SuggestedSession, Suggestion } from "../../src/training";

/*
 * The golden suggestions of Zee's agreed document on KEY-396 (Part 4), on the golden week at Wednesday 14
 * October 2026, 12:00, with no routine for the day (the fresh suggestions (b2) and (c)). Every muscle id,
 * priority, number of sets, score, length and exercise below is a literal copied from the document, never
 * computed from the code under test. The document works scores to 2 decimals, heat to 4 and sets to 2, so
 * the numbers are compared at that precision. A change to one of them is a new params version (ADR 0002).
 *
 * Under `keylow-training-v2` (KEY-727) a muscle is scored against where Productive starts, 10 sets, in place
 * of the low end of its MAV (10 for a small or large muscle, 12 for a medium one). The scores, orders and
 * lists below that moved were worked again by hand from the document's rule with the target of 10, and each
 * is noted where it changed.
 */

const sessionOf = (suggestion: Suggestion): SuggestedSession => {
  if (suggestion.kind !== "session") {
    throw new Error("Expected a session");
  }
  return suggestion;
};

const roundedTo = (value: number, decimals: number): number =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;

// One reason as the document gives it: muscle, priority, sets, MAV low, heat, score.
const reason = (
  muscle_id: MuscleId,
  priority: number,
  weekly_sets: number,
  mav_low: number,
  heat: number,
  score: number,
  logged_sets: number,
) => ({ muscle_id, priority, weekly_sets, logged_sets, mav_low, heat, score });

const readable = (session: SuggestedSession) =>
  session.exercises.map((exercise) => ({
    exercise_id: exercise.exercise_id,
    sets: exercise.sets,
    rep_min: exercise.rep_min,
    rep_max: exercise.rep_max,
    target_rir: exercise.target_rir,
    origin: exercise.origin,
    reasons: exercise.reasons.map((each) => ({
      muscle_id: each.muscle_id,
      priority: each.priority,
      weekly_sets: roundedTo(each.weekly_sets, 2),
      logged_sets: roundedTo(each.logged_sets, 2),
      mav_low: each.mav_low,
      heat: roundedTo(each.heat, 4),
      score: roundedTo(each.score, 2),
    })),
  }));

// Skipped muscles and the muscle that did not fit, at the precision of the document.
const skippedReadable = (skipped: SuggestedSession["skipped"]) =>
  skipped.map((each) => ({ muscle_id: each.muscle_id, heat: roundedTo(each.heat, 4) }));

const noRoomReadable = (noRoom: SuggestedSession["no_room"]) =>
  noRoom === null ? null : { ...noRoom, score: roundedTo(noRoom.score, 2) };

const suggestFresh = (goals: typeof V_TAPER_GOALS) =>
  suggestSession(WEDNESDAY_STATE, goals, GOLDEN_LIBRARY, {}, SUGGEST_PARAMS_V2);

describe("the V-taper user with no routine for the day (document case c)", () => {
  const session = sessionOf(suggestFresh(V_TAPER_GOALS));

  it("should suggest the six exercises of the document, in order, with their sets, reps and RIR", () => {
    expect(
      readable(session).map(({ exercise_id, sets, rep_min, rep_max, target_rir, origin }) => ({
        exercise_id,
        sets,
        rep_min,
        rep_max,
        target_rir,
        origin,
      })),
    ).toStrictEqual([
      {
        exercise_id: idOf("Barbell Deadlift"),
        sets: 3,
        rep_min: 8,
        rep_max: 10,
        target_rir: 2,
        origin: "added",
      },
      {
        exercise_id: idOf("Barbell Squat"),
        sets: 3,
        rep_min: 8,
        rep_max: 10,
        target_rir: 2,
        origin: "added",
      },
      {
        exercise_id: idOf("Incline Dumbbell Press"),
        sets: 3,
        rep_min: 8,
        rep_max: 10,
        target_rir: 2,
        origin: "added",
      },
      {
        exercise_id: idOf("Side Lateral Raise"),
        sets: 3,
        rep_min: 12,
        rep_max: 15,
        target_rir: 1,
        origin: "added",
      },
      {
        exercise_id: idOf("Romanian Deadlift"),
        sets: 3,
        rep_min: 8,
        rep_max: 10,
        target_rir: 2,
        origin: "added",
      },
      {
        exercise_id: idOf("Standing Calf Raises"),
        sets: 3,
        rep_min: 12,
        rep_max: 15,
        target_rir: 1,
        origin: "added",
      },
    ]);
  });

  it("should give the numbers behind each pick as its reasons, the leading muscle first", () => {
    expect(readable(session).map((exercise) => exercise.reasons)).toStrictEqual([
      // glute_max, quads and hamstrings tie at 20.00, and list position puts glute_max first.
      [
        reason("glute_max", 2, 0, 10, 0, 20, 0),
        reason("lower_back", 1, 0, 10, 0, 10, 0),
        reason("hamstrings", 2, 0, 10, 0, 20, 0),
      ],
      // Upper chest is 3 × (10 − 4.8) × (1 − 0.13) = 13.57, below the squat's 17.00 (it was 18.79 of 12).
      [reason("quads", 2, 1.5, 10, 0, 17, 0)],
      [reason("chest_upper", 3, 4.8, 10, 0.13, 13.57, 4.8)],
      [reason("delt_side", 3, 5.5, 10, 0.1221, 11.85, 5.5)],
      [reason("hamstrings", 2, 4.5, 10, 0, 11, 0)],
      // Lower chest at 6 sets would score 7.03, so the calves' 8.20 (priority 1, 1.8 sets) is picked instead.
      [reason("calves", 1, 1.8, 10, 0, 8.2, 0)],
    ]);
  });

  it("should total 18 sets and read 55 minutes, inside the 60 of the goal", () => {
    expect(session.sets).toBe(18);
    expect(session.minutes).toBe(55);
  });

  // Lats are at 11 sets, already Productive, so they score 0 and are no longer a muscle the suggestion
  // wants, hot or not. Biceps are at 8.5 sets and hot, so they are still skipped for heat.
  it("should list biceps as skipped for heat, and not lats, which are already productive", () => {
    expect(skippedReadable(session.skipped)).toStrictEqual([{ muscle_id: "biceps", heat: 0.5118 }]);
  });

  it("should say lower chest would not fit: 7 exercises and 21 sets read 65 minutes", () => {
    expect(noRoomReadable(session.no_room)).toStrictEqual({
      muscle_id: "chest_lower",
      score: 7.03,
      minutes_if_added: 65,
    });
  });

  it("should not choose an exercise with lats or biceps as a primary muscle", () => {
    const chosen = new Set(session.exercises.map((exercise) => exercise.exercise_id));
    for (const name of [
      "Pullups",
      "Bent Over Barbell Row",
      "Wide-Grip Lat Pulldown",
      "Barbell Curl",
    ]) {
      expect(chosen.has(idOf(name))).toBe(false);
    }
  });
});

describe("the strength user with no routine for the day (document case b2, the main-lift session)", () => {
  const session = sessionOf(suggestFresh(STRENGTH_GOALS));

  it("should suggest the five main lifts and a face pull, in the order the rule gives under v2", () => {
    expect(session.exercises.map((exercise) => exercise.exercise_id)).toStrictEqual([
      idOf("Barbell Deadlift"),
      idOf("Barbell Squat"),
      idOf("Romanian Deadlift"),
      idOf("Barbell Bench Press - Medium Grip"),
      idOf("Seated Barbell Military Press"),
      idOf("Face Pull"),
    ]);
  });

  it("should give every exercise 3 sets of 3 to 5 reps at RIR 2, the compound target of strength", () => {
    for (const exercise of session.exercises) {
      expect([
        exercise.sets,
        exercise.rep_min,
        exercise.rep_max,
        exercise.target_rir,
      ]).toStrictEqual([3, 3, 5, 2]);
    }
  });

  it("should give the numbers behind each pick as its reasons, the leading muscle first", () => {
    expect(readable(session).map((exercise) => exercise.reasons)).toStrictEqual([
      // lower_back, glute_max, quads and hamstrings all score 30.00 at priority 3, and list position puts
      // lower_back first.
      [
        reason("lower_back", 3, 0, 10, 0, 30, 0),
        reason("glute_max", 3, 0, 10, 0, 30, 0),
        reason("hamstrings", 3, 0, 10, 0, 30, 0),
      ],
      [reason("quads", 3, 1.5, 10, 0, 25.5, 0)],
      [reason("hamstrings", 3, 4.5, 10, 0, 16.5, 0)],
      [reason("chest_lower", 3, 4.5, 10, 0.1217, 14.49, 4.5)],
      [reason("delt_front", 3, 7.5, 10, 0.1319, 6.51, 6)],
      [reason("delt_rear", 1, 5.5, 10, 0.3309, 3.01, 5.5)],
    ]);
  });

  it("should total 18 sets and read 55 minutes", () => {
    expect(session.sets).toBe(18);
    expect(session.minutes).toBe(55);
  });

  it("should list biceps as skipped for heat, and not lats, which are already productive", () => {
    expect(session.skipped.map((skipped) => skipped.muscle_id)).toStrictEqual(["biceps"]);
  });

  it("should say upper chest would not fit: 7 exercises and 21 sets read 65 minutes", () => {
    expect(noRoomReadable(session.no_room)).toStrictEqual({
      muscle_id: "chest_upper",
      score: 2.96,
      minutes_if_added: 65,
    });
  });
});

describe("the V-taper user on a shorter or narrower session (worked by hand from the same rules)", () => {
  it("should stop at 3 exercises in 30 minutes, and say side delts would read 40", () => {
    // Deadlift (1 exercise, 3 sets), Squat (2, 6), Incline press (3, 9): 6 + 22.5 = 28.5, shown 30.
    // Side lateral raise would be 4 exercises and 12 sets: 8 + 30 = 38, shown 40.
    const session = sessionOf(
      suggestSession(
        WEDNESDAY_STATE,
        V_TAPER_GOALS,
        GOLDEN_LIBRARY,
        { minutes: 30 },
        SUGGEST_PARAMS_V2,
      ),
    );
    expect(session.exercises.map((exercise) => exercise.exercise_id)).toStrictEqual([
      idOf("Barbell Deadlift"),
      idOf("Barbell Squat"),
      idOf("Incline Dumbbell Press"),
    ]);
    expect(session.minutes).toBe(30);
    expect(noRoomReadable(session.no_room)).toStrictEqual({
      muscle_id: "delt_side",
      score: 11.85,
      minutes_if_added: 40,
    });
  });

  it("should suggest only the incline press and the lateral raise to a user with only dumbbells", () => {
    // Glute, quad and hamstring exercises are all barbell or machine, so upper chest and side delts lead.
    // 2 exercises and 6 sets: 4 + 15 = 19, shown 20.
    const session = sessionOf(
      suggestSession(
        WEDNESDAY_STATE,
        V_TAPER_GOALS,
        GOLDEN_LIBRARY,
        { equipment: ["dumbbell"] },
        SUGGEST_PARAMS_V2,
      ),
    );
    expect(session.exercises.map((exercise) => exercise.exercise_id)).toStrictEqual([
      idOf("Incline Dumbbell Press"),
      idOf("Side Lateral Raise"),
    ]);
    expect(session.minutes).toBe(20);
    expect(session.no_room).toBeNull();
  });

  it("should offer nothing to a user with nothing but bands, for lack of exercises", () => {
    const result = suggestSession(
      WEDNESDAY_STATE,
      V_TAPER_GOALS,
      GOLDEN_LIBRARY,
      { equipment: ["band"] },
      SUGGEST_PARAMS_V2,
    );
    expect(result.kind).toBe("nothing");
    expect(result.no_room).toBeNull();
    expect(result).toMatchObject({ why: "no_exercise" });
    expect(skippedReadable(result.skipped)).toStrictEqual([{ muscle_id: "biceps", heat: 0.5118 }]);
  });

  it("should use the full gym of the goal when the constraints name nothing", () => {
    expect(FULL_GYM).toContain("barbell");
    expect(suggestFresh(V_TAPER_GOALS)).toStrictEqual(
      suggestSession(
        WEDNESDAY_STATE,
        V_TAPER_GOALS,
        GOLDEN_LIBRARY,
        { minutes: 60, equipment: FULL_GYM },
        SUGGEST_PARAMS_V2,
      ),
    );
  });
});
