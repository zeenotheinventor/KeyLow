import { goalAnswersSchema, validateRoutineDraft, validateSetDraft } from "@keylow/core/training";
import { describe, expect, it } from "vitest";

import {
  ACTIVE_ROUTINE,
  ARCHIVED_ROUTINE,
  CURRENT_GOAL,
  CUSTOM_EXERCISE,
  EARLIER_GOAL,
  LIBRARY_EXERCISE_KEYS,
  TRAINING_WEEK_COUNT,
  sessionMoments,
  setsOfSession,
  trainingDateOf,
  trainingSessions,
} from "../fixtures/training.ts";

import type { RoutinePlan } from "../fixtures/training.ts";

const sessions = trainingSessions();

describe("the synthetic training history", () => {
  it("should hold three sessions a week for six weeks, the oldest first", () => {
    expect(sessions).toHaveLength(TRAINING_WEEK_COUNT * 3);
    expect(sessions.map(({ daysBefore }) => daysBefore)).toEqual(
      [...sessions.map(({ daysBefore }) => daysBefore)].sort((first, second) => second - first),
    );
  });

  it("should end yesterday and start within 42 days of the anchor", () => {
    expect(sessions.at(-1)?.daysBefore).toBe(1);
    expect(Math.max(...sessions.map(({ daysBefore }) => daysBefore))).toBeLessThanOrEqual(42);
  });

  it("should have no two sessions on one day", () => {
    const days = sessions.map(({ daysBefore }) => daysBefore);

    expect(new Set(days).size).toBe(days.length);
  });

  it("should carry exactly one session note", () => {
    expect(sessions.filter(({ note }) => note !== null)).toHaveLength(1);
  });

  it("should name only exercises it can resolve", () => {
    const known = new Set<string>([...LIBRARY_EXERCISE_KEYS, "facePull"]);
    const named = [
      ...sessions.flatMap(({ exercises }) => exercises),
      ...[ACTIVE_ROUTINE, ARCHIVED_ROUTINE].flatMap(({ days }) =>
        days.flatMap(({ exercises }) => exercises),
      ),
    ].map(({ exercise }) => exercise);

    expect(named.length).toBeGreaterThan(0);
    expect(named.filter((exercise) => !known.has(exercise))).toEqual([]);
  });

  it("should log every set as the app's own set rules accept it", () => {
    const problems = sessions.flatMap((session) =>
      setsOfSession(session).flatMap((set) => {
        const checked = validateSetDraft(
          {
            setType: set.setType,
            load: String(set.loadKg),
            reps: String(set.reps),
            rir: set.rir === null ? "" : String(set.rir),
            rpe: "",
          },
          { unit: "kg", effortMode: "rir" },
        );
        return checked.ok ? [] : [checked.issues];
      }),
    );

    expect(problems).toEqual([]);
  });

  it("should keep a warm-up lighter than the working sets after it", () => {
    for (const session of sessions) {
      for (const { sets } of session.exercises) {
        const warmUps = sets.filter(({ setType }) => setType === "warmup");
        const working = sets.filter(({ setType }) => setType === "working");
        for (const warmUp of warmUps) {
          expect(warmUp.loadKg).toBeLessThan(working[0]?.loadKg ?? 0);
        }
      }
    }
  });

  it("should time every set after the start and the end after every set", () => {
    for (const session of sessions) {
      const { startedAt, setTimes, endedAt } = sessionMoments("2030-06-15", session);

      expect(setTimes).toHaveLength(setsOfSession(session).length);
      expect(setTimes.every((time) => time > startedAt && time < endedAt)).toBe(true);
    }
  });

  it("should keep every session inside one UTC day", () => {
    for (const session of sessions) {
      const { localDate, startedAt, endedAt } = sessionMoments("2030-06-15", session);

      expect(startedAt.toISOString().slice(0, 10)).toBe(localDate);
      expect(endedAt.toISOString().slice(0, 10)).toBe(localDate);
    }
  });
});

describe("the dates of the history", () => {
  it("should count back from the anchor, so yesterday is 1 day before", () => {
    expect(trainingDateOf("2030-03-01", 1)).toBe("2030-02-28");
    expect(trainingDateOf("2030-03-01", 42)).toBe("2030-01-18");
  });

  it("should move with the anchor and hold no date of its own", () => {
    const first = sessions.map((session) => sessionMoments("2030-06-15", session).localDate);
    const later = sessions.map((session) => sessionMoments("2030-06-22", session).localDate);

    expect(later.map((date) => Date.parse(date) - 7 * 86_400_000)).toEqual(
      first.map((date) => Date.parse(date)),
    );
  });
});

describe("the routines, the goals and the custom exercise", () => {
  const fakeId = "00000000-0000-4000-8000-000000000000";
  const draftOf = ({ name, days }: RoutinePlan) => ({
    name,
    days: days.map((day) => ({
      id: null,
      weekday: day.weekday,
      name: day.name,
      exercises: day.exercises.map(({ sets, repMin, repMax, rir }) => ({
        exercise_id: fakeId,
        target_sets: sets,
        rep_min: repMin,
        rep_max: repMax,
        target_rir: rir,
      })),
    })),
  });

  it.each([ACTIVE_ROUTINE, ARCHIVED_ROUTINE])(
    "should be a routine the app saves: $name",
    (plan) => {
      expect(validateRoutineDraft(draftOf(plan)).ok).toBe(true);
    },
  );

  it("should have two routines with different names", () => {
    expect(ACTIVE_ROUTINE.name).not.toBe(ARCHIVED_ROUTINE.name);
  });

  it.each([EARLIER_GOAL, CURRENT_GOAL])(
    "should be answers the questionnaire accepts",
    (answers) => {
      expect(goalAnswersSchema.safeParse(answers).success).toBe(true);
    },
  );

  it("should have an earlier goal that differs from the current one", () => {
    expect(EARLIER_GOAL).not.toEqual(CURRENT_GOAL);
  });

  it("should name a custom exercise with a primary muscle", () => {
    expect(CUSTOM_EXERCISE.muscles.some(({ role }) => role === "primary")).toBe(true);
  });
});
