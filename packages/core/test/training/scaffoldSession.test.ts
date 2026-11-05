import { describe, expect, it } from "vitest";

import { acceptedExercise, curlSuggestion } from "./acceptedSuggestions";
import { rowId } from "./historyRows";
import { curl, curlMuscles } from "./plans";
import { goldenLegsDay, goldenPushDay } from "./routines";
import { goldenLegsSets } from "./sessionRows";
import {
  planProgress,
  scaffoldSession,
  scaffoldSessionWithAdditions,
  sessionExercises,
} from "../../src/training";

import type { StoredRoutineDay, StoredRoutineExercise } from "./routines";
import type { SessionSet } from "./sessionRows";

const requireFirstExercise = (day: StoredRoutineDay): StoredRoutineExercise => {
  const [first] = day.exercises;
  if (first === undefined) {
    throw new Error("The golden day has no exercises");
  }
  return first;
};

describe("scaffoldSession", () => {
  it("should carry the routine day's id, the link a session started from the day keeps", () => {
    expect(scaffoldSession(goldenLegsDay).routine_day_id).toBe(
      "00000003-0000-4000-8000-000000000003",
    );
  });

  it("should list the 5 exercises of Legs in position order with 3, 3, 3, 3 and 4 slots", () => {
    const { exercises } = scaffoldSession(goldenLegsDay);

    expect(exercises.map((exercise) => exercise.exercise_id)).toStrictEqual([
      "00000001-0000-4000-8000-000000000011",
      "00000001-0000-4000-8000-000000000012",
      "00000001-0000-4000-8000-000000000013",
      "00000001-0000-4000-8000-000000000014",
      "00000001-0000-4000-8000-000000000015",
    ]);
    expect(exercises.map((exercise) => exercise.slots)).toStrictEqual([3, 3, 3, 3, 4]);
  });

  it("should give each exercise its rep range and target RIR", () => {
    expect(scaffoldSession(goldenLegsDay).exercises).toStrictEqual([
      {
        exercise_id: "00000001-0000-4000-8000-000000000011",
        slots: 3,
        rep_min: 5,
        rep_max: 8,
        target_rir: 2,
      },
      {
        exercise_id: "00000001-0000-4000-8000-000000000012",
        slots: 3,
        rep_min: 8,
        rep_max: 10,
        target_rir: 2,
      },
      {
        exercise_id: "00000001-0000-4000-8000-000000000013",
        slots: 3,
        rep_min: 10,
        rep_max: 12,
        target_rir: 1,
      },
      {
        exercise_id: "00000001-0000-4000-8000-000000000014",
        slots: 3,
        rep_min: 10,
        rep_max: 12,
        target_rir: 1,
      },
      {
        exercise_id: "00000001-0000-4000-8000-000000000015",
        slots: 4,
        rep_min: 10,
        rep_max: 15,
        target_rir: 1,
      },
    ]);
  });

  it("should order the exercises by position and not by the order they arrive in", () => {
    const shuffled = {
      ...goldenLegsDay,
      exercises: [...goldenLegsDay.exercises].reverse(),
    };

    expect(scaffoldSession(shuffled)).toStrictEqual(scaffoldSession(goldenLegsDay));
  });

  it("should keep a null target RIR as null", () => {
    const day = {
      id: goldenPushDay.id,
      exercises: [{ ...requireFirstExercise(goldenPushDay), target_rir: null }],
    };

    expect(scaffoldSession(day).exercises[0]?.target_rir).toBeNull();
  });

  it("should keep an exercise that the day plans twice as two entries", () => {
    const first = requireFirstExercise(goldenLegsDay);
    const day = {
      id: goldenLegsDay.id,
      exercises: [first, { ...first, position: 1 }],
    };

    expect(scaffoldSession(day).exercises.map((exercise) => exercise.exercise_id)).toStrictEqual([
      first.exercise_id,
      first.exercise_id,
    ]);
  });

  it("should give a day with no exercises an empty plan", () => {
    expect(scaffoldSession({ id: goldenLegsDay.id, exercises: [] })).toStrictEqual({
      routine_day_id: goldenLegsDay.id,
      exercises: [],
    });
  });

  it("should not change the day it is given", () => {
    const day = { ...goldenLegsDay, exercises: [...goldenLegsDay.exercises].reverse() };
    const before = day.exercises.map((exercise) => exercise.id);

    scaffoldSession(day);

    expect(day.exercises.map((exercise) => exercise.id)).toStrictEqual(before);
  });
});

const LEGS_DATE = "2026-10-22";
const legsSession = { local_date: LEGS_DATE, routine_day_id: goldenLegsDay.id };
const freeSession = { local_date: LEGS_DATE, routine_day_id: null };
const curlOnLegs = curlSuggestion(LEGS_DATE, goldenLegsDay.id);
const curlStandalone = curlSuggestion(LEGS_DATE, null);
const legsSetCount = 16;

/** A working set of the exercise, taken from the golden Legs session so it has every field a set holds. */
const loggedSetOf = (exerciseId: string, minute: number): SessionSet => {
  const [template] = goldenLegsSets;
  if (template === undefined) {
    throw new Error("The golden Legs session holds sets");
  }
  return {
    ...template,
    id: rowId(5, 5000 + minute),
    exercise_id: exerciseId,
    position: 100 + minute,
    set_type: "working",
    performed_at: `2026-10-22T20:${String(minute).padStart(2, "0")}:00Z`,
  };
};

describe("scaffoldSessionWithAdditions", () => {
  it("should give the day's own scaffold and no additions when nothing is accepted", () => {
    expect(scaffoldSessionWithAdditions(legsSession, goldenLegsDay, [])).toStrictEqual({
      scaffold: scaffoldSession(goldenLegsDay),
      additions: [],
    });
  });

  it("should plan the accepted exercise after the day's own with its sets, range and RIR", () => {
    const { scaffold, additions } = scaffoldSessionWithAdditions(legsSession, goldenLegsDay, [
      {
        ...curlOnLegs,
        exercises: [{ ...acceptedExercise(curl, curlMuscles, 3, 2, 0), rep_min: 8, rep_max: 10 }],
      },
    ]);

    expect(scaffold?.exercises.at(-1)).toStrictEqual({
      exercise_id: curl.id,
      slots: 3,
      rep_min: 8,
      rep_max: 10,
      target_rir: 2,
    });
    expect(scaffold?.exercises).toHaveLength(6);
    expect(scaffold?.routine_day_id).toBe(goldenLegsDay.id);
    expect(additions.map((addition) => addition.exercise.name)).toStrictEqual([curl.name]);
  });

  it("should count the added sets once in what the session plans", () => {
    const { scaffold } = scaffoldSessionWithAdditions(legsSession, goldenLegsDay, [curlOnLegs]);

    expect(planProgress(scaffold, []).planned).toBe(legsSetCount + 3);
  });

  it("should draw the accepted exercise as a card of its own with 3 sets to do, after the day's exercises", () => {
    const { scaffold } = scaffoldSessionWithAdditions(legsSession, goldenLegsDay, [curlOnLegs]);

    const cards = sessionExercises(scaffold, []);

    expect(cards).toHaveLength(6);
    expect(cards.at(-1)).toMatchObject({ exerciseId: curl.id });
    expect(cards.at(-1)?.rows.map((row) => row.state)).toStrictEqual(["todo", "todo", "todo"]);
  });

  it("should keep a range the older row did not store as null and still plan the sets", () => {
    const { scaffold } = scaffoldSessionWithAdditions(legsSession, goldenLegsDay, [curlOnLegs]);

    expect(scaffold?.exercises.at(-1)).toMatchObject({ slots: 3, rep_min: null, rep_max: null });
  });

  it("should order the additions by position and not by the order they are stored in", () => {
    const second = acceptedExercise(
      { ...curl, id: rowId(1, 77), name: "Cable curl" },
      curlMuscles,
      2,
      1,
      1,
    );
    const first = acceptedExercise(curl, curlMuscles, 3, 2, 0);

    const { additions } = scaffoldSessionWithAdditions(legsSession, goldenLegsDay, [
      { ...curlOnLegs, exercises: [second, first] },
    ]);

    expect(additions.map((addition) => addition.exercise_id)).toStrictEqual([
      first.exercise_id,
      second.exercise_id,
    ]);
  });

  it("should leave a session of another date alone", () => {
    const { scaffold, additions } = scaffoldSessionWithAdditions(
      { ...legsSession, local_date: "2026-10-23" },
      goldenLegsDay,
      [curlOnLegs],
    );

    expect(scaffold).toStrictEqual(scaffoldSession(goldenLegsDay));
    expect(additions).toStrictEqual([]);
  });

  it("should leave a session started today from another routine day alone", () => {
    const { scaffold, additions } = scaffoldSessionWithAdditions(
      { local_date: LEGS_DATE, routine_day_id: goldenPushDay.id },
      goldenPushDay,
      [curlOnLegs],
    );

    expect(scaffold).toStrictEqual(scaffoldSession(goldenPushDay));
    expect(additions).toStrictEqual([]);
  });

  it("should leave a free session alone when the suggestion was folded into a routine day", () => {
    const { scaffold, additions } = scaffoldSessionWithAdditions(freeSession, null, [curlOnLegs]);

    expect(scaffold).toBeNull();
    expect(additions).toStrictEqual([]);
  });

  it("should leave a routine day's session alone when the suggestion stands alone", () => {
    const { scaffold } = scaffoldSessionWithAdditions(legsSession, goldenLegsDay, [curlStandalone]);

    expect(scaffold).toStrictEqual(scaffoldSession(goldenLegsDay));
  });

  it("should plan a free session as the accepted exercises alone, linked to no routine day", () => {
    const { scaffold } = scaffoldSessionWithAdditions(freeSession, null, [curlStandalone]);

    expect(scaffold).toStrictEqual({
      routine_day_id: null,
      exercises: [{ exercise_id: curl.id, slots: 3, rep_min: null, rep_max: null, target_rir: 2 }],
    });
  });

  it("should leave a free session with no plan when nothing is accepted", () => {
    expect(scaffoldSessionWithAdditions(freeSession, null, [])).toStrictEqual({
      scaffold: null,
      additions: [],
    });
  });

  it("should give a routine day's session no plan at all when the day cannot be had", () => {
    expect(scaffoldSessionWithAdditions(legsSession, null, [curlOnLegs])).toStrictEqual({
      scaffold: null,
      additions: [],
    });
  });

  it("should give no plan when the day it is given is not the one the session follows", () => {
    const { scaffold } = scaffoldSessionWithAdditions(legsSession, goldenPushDay, [curlOnLegs]);

    expect(scaffold).toBeNull();
  });

  it("should keep an exercise the day already plans as one entry whose sets are both counted", () => {
    const [first] = goldenLegsDay.exercises;
    if (first === undefined) {
      throw new Error("The golden day has exercises");
    }
    const alreadyOnTheDay = acceptedExercise(
      { ...curl, id: first.exercise_id },
      curlMuscles,
      2,
      2,
      0,
    );

    const { scaffold } = scaffoldSessionWithAdditions(legsSession, goldenLegsDay, [
      { ...curlOnLegs, exercises: [alreadyOnTheDay] },
    ]);
    const progress = planProgress(scaffold, []);

    expect(progress.exercises).toHaveLength(5);
    expect(progress.exercises[0]).toMatchObject({ exerciseId: first.exercise_id, planned: 5 });
    expect(progress.planned).toBe(legsSetCount + 2);
    expect(sessionExercises(scaffold, [])).toHaveLength(5);
  });

  it("should count an added set already logged against the plan and not as one beyond it", () => {
    const { scaffold } = scaffoldSessionWithAdditions(legsSession, goldenLegsDay, [curlOnLegs]);
    const logged = [loggedSetOf(curl.id, 1)];

    const progress = planProgress(scaffold, logged);

    expect(progress.logged).toBe(1);
    expect(progress.extra).toBe(0);
    expect(progress.exercises.find((entry) => entry.exerciseId === curl.id)).toMatchObject({
      planned: 3,
      logged: 1,
      remaining: 2,
    });
    expect(
      sessionExercises(scaffold, logged)
        .find((card) => card.exerciseId === curl.id)
        ?.rows.map((row) => row.state),
    ).toStrictEqual(["done", "todo", "todo"]);
  });

  it("should keep an added exercise's logged sets, as sets beyond the plan, once the suggestion is undone", () => {
    const { scaffold } = scaffoldSessionWithAdditions(legsSession, goldenLegsDay, []);
    const logged = [loggedSetOf(curl.id, 1)];

    const progress = planProgress(scaffold, logged);

    expect(progress.planned).toBe(legsSetCount);
    expect(progress.extra).toBe(1);
    expect(sessionExercises(scaffold, logged).at(-1)).toMatchObject({ exerciseId: curl.id });
  });

  it("should not change the suggestion or the day it is given", () => {
    const accepted = [curlOnLegs];
    const before = JSON.stringify([accepted, goldenLegsDay]);

    scaffoldSessionWithAdditions(legsSession, goldenLegsDay, accepted);

    expect(JSON.stringify([accepted, goldenLegsDay])).toBe(before);
  });
});
