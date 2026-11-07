import {
  getActiveRoutine,
  getActiveSession,
  getCurrentTrainingGoals,
  listRoutines,
  listSetsFrom,
  listSuggestionLibrary,
  listTrainingGoalsHistory,
  listTrendSets,
  searchExercises,
} from "@keylow/api-client";
import { addCalendarDays, daysSinceMonday } from "@keylow/core/dates";
import {
  MUSCLE_IDS,
  TRAINING_PARAMS_V2,
  TREND_RANGE_WEEKS,
  currentMuscleState,
  exerciseWeeklyTrend,
  nextSessionSuggestion,
} from "@keylow/core/training";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import {
  ACTIVE_ROUTINE,
  ARCHIVED_ROUTINE,
  CURRENT_GOAL,
  CUSTOM_EXERCISE,
  EARLIER_GOAL,
  LIBRARY_EXERCISES,
  LIBRARY_EXERCISE_KEYS,
  trainingSessions,
} from "../../fixtures/training.ts";
import {
  expectedMuscleState,
  expectedSets,
  expectedSuggestion,
  expectedTrend,
  referenceNow,
} from "../../fixtures/trainingTotals.ts";
import { writeTrainingHistory } from "../../fixtures/trainingWrites.ts";
import { createFixtureUser } from "../../src/fixtureUser.ts";

import type { FixtureUser } from "../../src/fixtureUser.ts";

// These need the local stack with its migrations (the exercise library arrives by one). The user is new for the
// run, named under key887-<run id> at keylow.test, and afterAll removes it. Every read is of this user's own
// rows, so rows another session left on the shared stack cannot change a result, and nothing counts a whole table.
const RUN_ID = crypto.randomUUID().slice(0, 8);

// The repos read the heat window from the day before its first day (`HEAT_LOOKBACK_DAYS` in the api-client's
// `trainingReads`, which the package does not export), so the same number is worked out from core's window here.
const HEAT_LOOKBACK_DAYS = TRAINING_PARAMS_V2.heatWindowDays + 1;

let user: FixtureUser;
let now: string;

// Eighteen sessions of about forty sets are written one request at a time, which is slower than the hook default.
const WRITING_TIMEOUT_MS = 180_000;

beforeAll(async () => {
  user = await createFixtureUser(inject("stack"), { namePrefix: `key887-${RUN_ID}` });
  now = referenceNow(user.anchorDate);
  await writeTrainingHistory(user);
}, WRITING_TIMEOUT_MS);

afterAll(async () => {
  await user.remove();
});

const countOf = async (table: "workout_sessions" | "workout_sets" | "food_log_entries") => {
  const { count, error } = await user.client
    .from(table)
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null);
  if (error) {
    throw new Error(`Could not count ${table} (${error.code})`);
  }
  return count;
};

describe("the training history written as the eval user", () => {
  it("should write every planned session and set, and leave no session in progress", async () => {
    expect(await countOf("workout_sessions")).toBe(trainingSessions().length);
    expect(await countOf("workout_sets")).toBe(expectedSets(user.anchorDate).length);
    expect(await getActiveSession(user.client)).toBeNull();
  });

  it("should write the one session note", async () => {
    const { data } = await user.client
      .from("workout_sessions")
      .select("note")
      .not("note", "is", null);

    expect(data).toHaveLength(1);
    expect(data?.[0]?.note).toBe(trainingSessions().find(({ note }) => note !== null)?.note);
  });

  it("should end yesterday, the day before the anchor", async () => {
    const { data } = await user.client
      .from("workout_sessions")
      .select("local_date")
      .order("local_date", { ascending: false })
      .limit(1);

    expect(data?.[0]?.local_date).toBe(addCalendarDays(user.anchorDate, -1));
  });
});

describe("the numbers core works out from what the repos read back", () => {
  const idOfLibraryExercise = async (sourceRef: string) => {
    const { data } = await user.client
      .from("exercises")
      .select("id")
      .eq("source", "free_exercise_db")
      .eq("source_ref", sourceRef)
      .single();
    if (data === null) {
      throw new Error(`The library exercise ${sourceRef} is missing`);
    }
    return data.id;
  };

  it.each(LIBRARY_EXERCISE_KEYS)(
    "should give the weekly trend of %s that the planned sets give",
    async (key) => {
      const id = await idOfLibraryExercise(LIBRARY_EXERCISES[key]);
      const range = "3m";
      const fromWeek = addCalendarDays(
        addCalendarDays(user.anchorDate, -daysSinceMonday(user.anchorDate)),
        -(TREND_RANGE_WEEKS[range] - 1) * 7,
      );

      const rows = await listTrendSets(user.client, [id], {
        fromWeek,
        throughDay: user.anchorDate,
      });

      expect(
        exerciseWeeklyTrend(rows.sets, { range, now, timeZone: "UTC", earlier: rows.earlier }),
      ).toEqual(expectedTrend(user.anchorDate, key, { range, now }));
    },
  );

  it("should give the muscle state that the planned sets give", async () => {
    const sets = await listSetsFrom(
      user.client,
      addCalendarDays(user.anchorDate, -HEAT_LOOKBACK_DAYS),
      user.anchorDate,
    );

    const read = currentMuscleState(sets, now);
    const expected = expectedMuscleState(user.anchorDate, now);

    for (const muscle of MUSCLE_IDS) {
      expect(read[muscle].volumeStatus).toBe(expected[muscle].volumeStatus);
      expect(read[muscle].heat).toBeCloseTo(expected[muscle].heat, 9);
      expect(read[muscle].weeklySets).toBeCloseTo(expected[muscle].weeklySets, 9);
      // The ready time is rounded up to the millisecond, which a last digit of floating point can move by one.
      expect(
        Math.abs(Date.parse(read[muscle].readyAt) - Date.parse(expected[muscle].readyAt)),
      ).toBeLessThanOrEqual(1);
    }
    expect(read.quads.heat).toBeGreaterThanOrEqual(0.5);
  });
});

describe("the next session suggested from what the repos read back", () => {
  it("should be the suggestion the planned sets give", async () => {
    const goal = await getCurrentTrainingGoals(user.client);
    const activeRoutine = await getActiveRoutine(user.client);
    const library = await listSuggestionLibrary(user.client, { equipment: goal?.equipment ?? [] });
    const sets = await listSetsFrom(
      user.client,
      addCalendarDays(user.anchorDate, -HEAT_LOOKBACK_DAYS),
      user.anchorDate,
    );
    const inputs = { now, day: user.anchorDate, goal, library, activeRoutine, timeZone: "UTC" };

    const read = nextSessionSuggestion({ ...inputs, sets });

    expect(read.kind).not.toBeNull();
    expect(read).toEqual(expectedSuggestion(user.anchorDate, inputs));
  });
});

describe("the routines, the goals and the custom exercise", () => {
  it("should have one active routine and one archived routine", async () => {
    const routines = await listRoutines(user.client, { archived: true });

    expect(routines.map(({ name }) => name).sort()).toEqual(
      [ACTIVE_ROUTINE.name, ARCHIVED_ROUTINE.name].sort(),
    );
    expect(routines.find(({ name }) => name === ACTIVE_ROUTINE.name)).toMatchObject({
      is_active: true,
      is_archived: false,
    });
    expect(routines.find(({ name }) => name === ARCHIVED_ROUTINE.name)).toMatchObject({
      is_active: false,
      is_archived: true,
    });
  });

  it("should have the current goal, and the earlier one closed before it", async () => {
    const current = await getCurrentTrainingGoals(user.client);
    const history = await listTrainingGoalsHistory(user.client);

    expect(current).toMatchObject({ goal: CURRENT_GOAL.goal, session_minutes: 75 });
    expect(history.map(({ goal }) => goal)).toEqual([CURRENT_GOAL.goal, EARLIER_GOAL.goal]);
    expect(history[1]?.effective_to).not.toBeNull();
  });

  it("should have the one custom exercise, in the user's own name", async () => {
    const found = await searchExercises(user.client, CUSTOM_EXERCISE.name);

    expect(found.filter(({ source }) => source === "user").map(({ name }) => name)).toEqual([
      CUSTOM_EXERCISE.name,
    ]);
  });
});

describe("writing the history a second time", () => {
  it("should add no session, set, routine, goal or exercise, and change no food entry", async () => {
    const before = {
      sessions: await countOf("workout_sessions"),
      sets: await countOf("workout_sets"),
      food: await countOf("food_log_entries"),
      routines: (await listRoutines(user.client, { archived: true })).length,
      goals: (await listTrainingGoalsHistory(user.client)).length,
      exercises: (await searchExercises(user.client, CUSTOM_EXERCISE.name)).length,
    };

    await writeTrainingHistory(user);

    expect({
      sessions: await countOf("workout_sessions"),
      sets: await countOf("workout_sets"),
      food: await countOf("food_log_entries"),
      routines: (await listRoutines(user.client, { archived: true })).length,
      goals: (await listTrainingGoalsHistory(user.client)).length,
      exercises: (await searchExercises(user.client, CUSTOM_EXERCISE.name)).length,
    }).toEqual(before);
  });
});
