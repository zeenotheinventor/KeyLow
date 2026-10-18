import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  equipmentSchema,
  exerciseMechanicSchema,
  exerciseMuscleEntrySchema,
  muscleIdSchema,
  setTypeSchema,
} from "../../src/schemas";
import {
  buildSetSnapshot,
  COMPARE_PARAMS_V1,
  compareWeek,
  MUSCLE_IDS,
  muscleState,
  PLAN_STATUSES,
  projectWeek,
  VOLUME_STATUSES,
} from "../../src/training";
import goldenWeek from "../fixtures/training/goldenWeek.json";

import type { LoggedSet, PlanRoutine } from "../../src/training";

/*
 * The golden fixture week of KEY-353: a made-up Push Pull Legs week, Monday 12 to Sunday 18 October 2026
 * in Europe/London, with the heat, ready at, weekly sets, volume status and plan-week comparison that
 * Zee agreed on 2026-10-18. The agreed numbers were worked by hand from ADR 0005 and are copied into the
 * fixture as literals. They must never be computed from the code under test or from the params, and they
 * change only when Zee agrees a new table, which is a new params version (ADR 0002).
 *
 * Precision is the one the table was agreed to: heat to 4 decimal places, weekly sets and gaps to 2, and
 * ready at to the nearest minute.
 */

const timestampSchema = z.iso.datetime({ offset: true });

const exerciseFixtureSchema = z.object({
  sourceRef: z.string(),
  id: z.guid(),
  name: z.string(),
  equipment: equipmentSchema,
  mechanic: exerciseMechanicSchema,
  muscles: z.array(exerciseMuscleEntrySchema),
});

const routineExerciseFixtureSchema = z.object({
  id: z.guid(),
  position: z.number(),
  exercise: z.string(),
  targetSets: z.number(),
  targetRepsMin: z.number(),
  targetRepsMax: z.number(),
  targetRir: z.number().nullable(),
});

const routineDayFixtureSchema = z.object({
  id: z.guid(),
  name: z.string(),
  position: z.number(),
  weekday: z.number().nullable(),
  exercises: z.array(routineExerciseFixtureSchema),
});

const sessionFixtureSchema = z.object({
  id: z.guid(),
  localDate: z.iso.date(),
  routineDayId: z.guid(),
  startedAt: timestampSchema,
  endedAt: timestampSchema.nullable(),
});

const setFixtureSchema = z.object({
  sessionId: z.guid(),
  exercise: z.string(),
  setType: setTypeSchema,
  reps: z.number(),
  loadKg: z.number().nullable(),
  rir: z.number().nullable(),
  rpe: z.number().nullable(),
  performedAt: timestampSchema,
});

const expectedMuscleStateSchema = z.object({
  heat: z.number(),
  readyAt: z.union([z.literal("now"), timestampSchema]),
  weeklySets: z.number(),
  volumeStatus: z.enum(VOLUME_STATUSES),
});

const expectedComparisonSchema = z.object({
  actualWeeklySets: z.number(),
  projectedWeeklySets: z.number(),
  gap: z.number(),
  status: z.enum(PLAN_STATUSES),
});

const fixtureSchema = z.object({
  description: z.string(),
  timeZone: z.string(),
  weekStart: z.iso.date(),
  exercises: z.array(exerciseFixtureSchema),
  routine: z.object({ name: z.string(), days: z.array(routineDayFixtureSchema) }),
  sessions: z.array(sessionFixtureSchema),
  sets: z.array(setFixtureSchema),
  expected: z.object({
    // A record keyed by the muscle enum must hold every muscle id, so a fixture that skips one is refused.
    moments: z.array(
      z.object({
        label: z.string(),
        now: timestampSchema,
        muscles: z.record(muscleIdSchema, expectedMuscleStateSchema),
      }),
    ),
    planWeek: z.object({
      asOf: timestampSchema,
      muscles: z.record(muscleIdSchema, expectedComparisonSchema),
      totals: z.object({
        actualWeeklySets: z.number(),
        projectedWeeklySets: z.number(),
        gap: z.number(),
      }),
    }),
  }),
});

const fixture = fixtureSchema.parse(goldenWeek);
const params = COMPARE_PARAMS_V1;

const requireExercise = (sourceRef: string) => {
  const exercise = fixture.exercises.find((candidate) => candidate.sourceRef === sourceRef);
  if (exercise === undefined) {
    throw new Error(`The fixture names an exercise it does not hold: ${sourceRef}`);
  }
  return exercise;
};

const routine: PlanRoutine = {
  days: fixture.routine.days.map((day) => ({
    id: day.id,
    position: day.position,
    weekday: day.weekday,
    exercises: day.exercises.map((routineExercise) => {
      const { id, name, equipment, mechanic, muscles } = requireExercise(routineExercise.exercise);
      return {
        id: routineExercise.id,
        position: routineExercise.position,
        exercise_id: id,
        target_sets: routineExercise.targetSets,
        target_rir: routineExercise.targetRir,
        exercise: { id, name, equipment, mechanic },
        muscles,
      };
    }),
  })),
};

const sessions = fixture.sessions.map((session) => ({
  id: session.id,
  local_date: session.localDate,
  routine_day_id: session.routineDayId,
  deleted_at: null,
}));

const loggedSets: LoggedSet[] = fixture.sets.map((set) => {
  const { id, name, equipment, mechanic, muscles } = requireExercise(set.exercise);
  return {
    session_id: set.sessionId,
    set_type: set.setType,
    rir: set.rir,
    rpe: set.rpe,
    performed_at: set.performedAt,
    deleted_at: null,
    snapshot: buildSetSnapshot({ id, name, equipment, mechanic }, muscles),
  };
});

const MILLISECONDS_PER_MINUTE = 60_000;

const toMinute = (timestamp: string): string =>
  new Date(
    Math.round(Date.parse(timestamp) / MILLISECONDS_PER_MINUTE) * MILLISECONDS_PER_MINUTE,
  ).toISOString();

const instant = (timestamp: string): string => new Date(Date.parse(timestamp)).toISOString();

const FOUR_DECIMAL_PLACES = 4;
const TWO_DECIMAL_PLACES = 2;

describe("golden fixture week", () => {
  describe("the fixture", () => {
    it("should hold the 15 exercises of the routine, each with a primary muscle", () => {
      expect(fixture.exercises).toHaveLength(15);
      for (const exercise of fixture.exercises) {
        expect(exercise.muscles.some((muscle) => muscle.role === "primary")).toBe(true);
      }
    });

    it("should hold the four days of Push Pull Legs on Monday, Tuesday, Thursday and Saturday", () => {
      expect(fixture.routine.name).toBe("Push Pull Legs");
      expect(fixture.routine.days.map((day) => [day.name, day.weekday])).toStrictEqual([
        ["Push", 0],
        ["Pull", 1],
        ["Legs", 3],
        ["Push", 5],
      ]);
    });

    it("should log Monday, Tuesday and an unfinished Thursday, and nothing on Saturday", () => {
      expect(fixture.sessions.map((session) => [session.localDate, session.endedAt])).toStrictEqual(
        [
          ["2026-10-12", "2026-10-12T18:48:00+01:00"],
          ["2026-10-13", "2026-10-13T18:51:00+01:00"],
          ["2026-10-15", null],
        ],
      );
      expect(fixture.sets).toHaveLength(45);
    });

    it("should log every set three minutes after the one before it in its session", () => {
      for (const session of fixture.sessions) {
        const times = fixture.sets
          .filter((set) => set.sessionId === session.id)
          .map((set) => Date.parse(set.performedAt));
        expect(times[0]).toBe(Date.parse(session.startedAt));
        times.slice(1).forEach((time, index) => {
          expect(time - (times[index] ?? Number.NaN)).toBe(3 * MILLISECONDS_PER_MINUTE);
        });
      }
    });
  });

  describe("muscle state", () => {
    describe.each(fixture.expected.moments)("$label", ({ now, muscles }) => {
      // Every set of the week is passed at every moment, so sets after `now` must be left out.
      const state = muscleState(loggedSets, instant(now), params.training);

      it.each(MUSCLE_IDS)("should give %s its agreed heat", (muscle) => {
        expect(state[muscle].heat).toBeCloseTo(muscles[muscle].heat, FOUR_DECIMAL_PLACES);
      });

      it.each(MUSCLE_IDS)("should give %s its agreed ready at", (muscle) => {
        const { readyAt } = muscles[muscle];

        expect(readyAt === "now" ? state[muscle].readyAt : toMinute(state[muscle].readyAt)).toBe(
          instant(readyAt === "now" ? now : readyAt),
        );
      });

      it.each(MUSCLE_IDS)("should give %s its agreed weekly sets", (muscle) => {
        expect(state[muscle].weeklySets).toBeCloseTo(
          muscles[muscle].weeklySets,
          TWO_DECIMAL_PLACES,
        );
      });

      it.each(MUSCLE_IDS)("should give %s its agreed volume status", (muscle) => {
        expect(state[muscle].volumeStatus).toBe(muscles[muscle].volumeStatus);
      });
    });
  });

  describe("plan week as of Sunday 18 October 20:00", () => {
    const week = projectWeek(
      routine,
      fixture.weekStart,
      fixture.timeZone,
      { sessions, sets: loggedSets },
      params,
    );
    const comparison = compareWeek(week.actual, week.projected, params);
    const { muscles, totals } = fixture.expected.planWeek;

    it("should take the three logged days as actual and replace their planned days in the projection", () => {
      expect(week.actual).toHaveLength(45);
      // Saturday's Push is the only planned day left: 16 working sets, and 16 + 45 sets in all.
      expect(week.projected.filter((set) => "planned" in set)).toHaveLength(16);
      expect(week.projected).toHaveLength(45 + 16);
    });

    it.each(MUSCLE_IDS)("should give %s its agreed actual weekly sets", (muscle) => {
      expect(comparison[muscle].actualWeeklySets).toBeCloseTo(
        muscles[muscle].actualWeeklySets,
        TWO_DECIMAL_PLACES,
      );
    });

    it.each(MUSCLE_IDS)("should give %s its agreed projected weekly sets", (muscle) => {
      expect(comparison[muscle].projectedWeeklySets).toBeCloseTo(
        muscles[muscle].projectedWeeklySets,
        TWO_DECIMAL_PLACES,
      );
    });

    it.each(MUSCLE_IDS)("should give %s its agreed gap", (muscle) => {
      expect(comparison[muscle].gap).toBeCloseTo(muscles[muscle].gap, TWO_DECIMAL_PLACES);
    });

    it.each(MUSCLE_IDS)("should give %s its agreed status", (muscle) => {
      expect(comparison[muscle].status).toBe(muscles[muscle].status);
    });

    it("should total 80.75 actual, 109.05 projected and a gap of -28.30 over all muscles", () => {
      const sumOf = (valueOf: (muscle: (typeof MUSCLE_IDS)[number]) => number): number =>
        MUSCLE_IDS.reduce((total, muscle) => total + valueOf(muscle), 0);

      expect(sumOf((muscle) => comparison[muscle].actualWeeklySets)).toBeCloseTo(
        totals.actualWeeklySets,
        TWO_DECIMAL_PLACES,
      );
      expect(sumOf((muscle) => comparison[muscle].projectedWeeklySets)).toBeCloseTo(
        totals.projectedWeeklySets,
        TWO_DECIMAL_PLACES,
      );
      expect(sumOf((muscle) => comparison[muscle].gap)).toBeCloseTo(totals.gap, TWO_DECIMAL_PLACES);
    });
  });
});
