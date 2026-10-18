import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { bench, dayId } from "./plans";
import { MUSCLE_IDS, MUSCLE_ROLES, targetedMuscles } from "../../src/training";

import type { ExerciseMuscleEntry } from "../../src/schemas";
import type { MuscleId, PlanExercise, PlanRoutineDay } from "../../src/training";

const muscleEntries: fc.Arbitrary<ExerciseMuscleEntry[]> = fc.uniqueArray(
  fc.record({
    muscle_id: fc.constantFrom(...MUSCLE_IDS),
    role: fc.constantFrom(...MUSCLE_ROLES),
    weight: fc.double({ min: 0.05, max: 1, noNaN: true }),
  }),
  { selector: (entry) => entry.muscle_id, minLength: 1, maxLength: 4 },
);

const planExercises: fc.Arbitrary<PlanExercise[]> = fc.array(
  fc.record({ muscles: muscleEntries, position: fc.nat(20) }).map(({ muscles, position }) => ({
    id: dayId(position),
    position,
    exercise_id: bench.id,
    target_sets: 3,
    target_rir: 2,
    exercise: bench,
    muscles,
  })),
  { maxLength: 5 },
);

type GeneratedDay = Omit<PlanRoutineDay, "exercises"> & { exercises: PlanExercise[] };

const days: fc.Arbitrary<GeneratedDay[]> = fc
  .array(
    fc.record({
      exercises: planExercises,
      weekday: fc.option(fc.integer({ min: 0, max: 6 }), { nil: null }),
    }),
    { maxLength: 5 },
  )
  .map((generated) =>
    generated.map(({ exercises, weekday }, index) => ({
      id: dayId(index),
      position: index,
      weekday,
      exercises,
    })),
  );

/** The routine's days and exercises, in one order and in another. */
const routineInTwoOrders = days.chain((original) =>
  fc
    .tuple(
      fc.shuffledSubarray(original, { minLength: original.length, maxLength: original.length }),
      fc.tuple(
        ...original.map((day) =>
          fc.shuffledSubarray(day.exercises, {
            minLength: day.exercises.length,
            maxLength: day.exercises.length,
          }),
        ),
      ),
    )
    .map(([shuffledDays, shuffledExercises]) => ({
      original,
      shuffled: shuffledDays.map((day) => ({
        ...day,
        exercises: shuffledExercises[original.indexOf(day)] ?? [],
      })),
    })),
);

describe("targetedMuscles properties", () => {
  it("should give the same set whatever order the days and exercises come in", () => {
    fc.assert(
      fc.property(routineInTwoOrders, ({ original, shuffled }) => {
        expect(targetedMuscles({ routine: { days: shuffled } })).toEqual(
          targetedMuscles({ routine: { days: original } }),
        );
      }),
    );
  });

  it("should target exactly the muscles the exercises hold, or every muscle when they hold none", () => {
    fc.assert(
      fc.property(days, (routineDays) => {
        const held = new Set<MuscleId>(
          routineDays.flatMap((day) =>
            day.exercises.flatMap((exercise) => exercise.muscles.map((entry) => entry.muscle_id)),
          ),
        );

        expect(targetedMuscles({ routine: { days: routineDays } })).toEqual(
          held.size === 0 ? new Set(MUSCLE_IDS) : held,
        );
      }),
    );
  });
});
