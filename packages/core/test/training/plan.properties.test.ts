import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { asLogged, dayId, exerciseId, id, session } from "./plans";
import { addCalendarDays, instantAtLocalTime } from "../../src/dates";
import {
  COMPARE_PARAMS_V1,
  compareWeek,
  expandPlan,
  MUSCLE_IDS,
  MUSCLE_ROLES,
  projectWeek,
} from "../../src/training";

import type { ExerciseMuscleEntry } from "../../src/schemas";
import type { LoggedSession, LoggedSet, PlanExercise, PlanRoutine } from "../../src/training";

const params = COMPARE_PARAMS_V1;

/** Weeks with and without a clock change in the zones below. */
const WEEKS = ["2026-03-23", "2026-09-21", "2026-10-19", "2026-10-26", "2026-12-28"];
const ZONES = ["Europe/London", "America/Los_Angeles", "Pacific/Auckland", "Asia/Kolkata", "UTC"];

const muscleMap: fc.Arbitrary<ExerciseMuscleEntry[]> = fc
  .uniqueArray(fc.constantFrom(...MUSCLE_IDS), { minLength: 1, maxLength: 4 })
  .chain((muscles) =>
    fc.tuple(
      ...muscles.map((muscle_id, index) =>
        fc.record({
          muscle_id: fc.constant(muscle_id),
          // The first muscle is primary, so every map has one.
          role: index === 0 ? fc.constant("primary" as const) : fc.constantFrom(...MUSCLE_ROLES),
          weight: fc.double({ min: 0.05, max: 1, noNaN: true }),
        }),
      ),
    ),
  );

const routineExercises = (dayNumber: number): fc.Arbitrary<PlanExercise[]> =>
  fc
    .array(
      fc.record({
        targetSets: fc.integer({ min: 1, max: 20 }),
        targetRir: fc.option(fc.integer({ min: 0, max: 10 })),
        muscles: muscleMap,
      }),
      { minLength: 1, maxLength: 4 },
    )
    .map((exercises) =>
      exercises.map(({ targetSets, targetRir, muscles }, position) => {
        const n = dayNumber * 10 + position;
        return {
          id: id(5, n),
          position,
          exercise_id: exerciseId(n),
          target_sets: targetSets,
          target_rir: targetRir,
          exercise: {
            id: exerciseId(n),
            name: "Generated exercise",
            equipment: "dumbbell",
            mechanic: "isolation",
          },
          muscles,
        };
      }),
    );

/** A routine of up to seven days, each on its own weekday or on none. */
const planRoutine: fc.Arbitrary<PlanRoutine> = fc
  .uniqueArray(fc.option(fc.integer({ min: 0, max: 6 }), { nil: null }), {
    minLength: 1,
    maxLength: 7,
    // Null weekdays may repeat; a weekday may not.
    comparator: (first, second) => first !== null && first === second,
  })
  .chain((weekdays) =>
    fc.tuple(
      ...weekdays.map((weekday, position) =>
        routineExercises(position).map((exercises) => ({
          id: dayId(position + 1),
          position,
          weekday,
          exercises,
        })),
      ),
    ),
  )
  .map((days) => ({ days }));

describe("projected against actual, properties", () => {
  it("should give a gap of 0 for every muscle when every planned day is logged as planned", () => {
    fc.assert(
      fc.property(
        planRoutine,
        fc.constantFrom(...WEEKS),
        fc.constantFrom(...ZONES),
        fc.integer({ min: 0, max: 23 }),
        (routine, weekStart, tz, hour) => {
          const { planned } = projectWeek(
            routine,
            weekStart,
            tz,
            { sessions: [], sets: [] },
            params,
          );
          const sessions: LoggedSession[] = [];
          const sets: LoggedSet[] = [];
          for (const [index, localDate] of [
            ...new Set(planned.map((set) => set.local_date)),
          ].entries()) {
            const day = planned.filter((set) => set.local_date === localDate);
            const logged = session(index + 1, localDate, day[0]?.routine_day_id ?? null);
            // Logged at any hour of the planned day, not at the planned time.
            const performedAt = instantAtLocalTime(localDate, hour, 0, tz).toISOString();
            sessions.push(logged);
            sets.push(...asLogged(day, logged, performedAt));
          }

          const week = projectWeek(routine, weekStart, tz, { sessions, sets }, params);
          const againstProjection = compareWeek(week.actual, week.projected, params);
          const againstPlan = compareWeek(week.actual, week.planned, params);

          for (const muscle of MUSCLE_IDS) {
            expect(againstProjection[muscle].gap).toBe(0);
            expect(againstProjection[muscle].status).toBe("on_plan");
            expect(againstPlan[muscle].gap).toBe(0);
          }
        },
      ),
    );
  });

  it("should project exactly the plan, never ahead, when nothing is logged", () => {
    fc.assert(
      fc.property(
        planRoutine,
        fc.constantFrom(...WEEKS),
        fc.constantFrom(...ZONES),
        (routine, weekStart, tz) => {
          const week = projectWeek(routine, weekStart, tz, { sessions: [], sets: [] }, params);
          const comparison = compareWeek(week.actual, week.projected, params);

          expect(week.projected).toEqual(week.planned);
          for (const muscle of MUSCLE_IDS) {
            expect(comparison[muscle].gap).toBeLessThanOrEqual(0);
            expect(comparison[muscle].actualWeeklySets).toBe(0);
          }
        },
      ),
    );
  });

  it("should plan, project and compare as it does with no active date when it is active on or before the week's Monday", () => {
    fc.assert(
      fc.property(
        planRoutine,
        fc.constantFrom(...WEEKS),
        fc.constantFrom(...ZONES),
        fc.integer({ min: 0, max: 400 }),
        (routine, weekStart, tz, daysBefore) => {
          const activeFrom = addCalendarDays(weekStart, -daysBefore);
          const dated = { ...routine, activeFrom };
          const noLogs = { sessions: [], sets: [] };

          expect(expandPlan(dated, weekStart, tz, params)).toStrictEqual(
            expandPlan(routine, weekStart, tz, params),
          );
          const withDate = projectWeek(dated, weekStart, tz, noLogs, params);
          const withoutDate = projectWeek(routine, weekStart, tz, noLogs, params);
          expect(withDate).toStrictEqual(withoutDate);
          expect(compareWeek(withDate.actual, withDate.projected, params)).toStrictEqual(
            compareWeek(withoutDate.actual, withoutDate.projected, params),
          );
        },
      ),
    );
  });
});
