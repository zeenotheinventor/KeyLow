import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  equipmentSchema,
  exerciseMechanicSchema,
  exerciseMuscleEntrySchema,
} from "../../src/schemas";
import {
  deriveMusclePriority,
  GOAL_PRESETS_V1,
  goalTargetedMuscles,
  MUSCLE_IDS,
  targetedMuscles,
} from "../../src/training";
import goldenWeek from "../fixtures/training/goldenWeek.json";

import type { GoalAnswers, MuscleId, PlanRoutine } from "../../src/training";

/*
 * The goal side of "targeted" (KEY-356): a muscle is targeted when the routine trains it or the goal ranks
 * it above 0. The routine is the golden Push Pull Legs week of KEY-353, which trains 15 muscles and never
 * trains the other seven.
 */

const fixtureSchema = z.object({
  exercises: z.array(
    z.object({
      sourceRef: z.string(),
      id: z.guid(),
      name: z.string(),
      equipment: equipmentSchema,
      mechanic: exerciseMechanicSchema,
      muscles: z.array(exerciseMuscleEntrySchema),
    }),
  ),
  routine: z.object({
    days: z.array(
      z.object({
        id: z.guid(),
        position: z.number(),
        weekday: z.number().nullable(),
        exercises: z.array(
          z.object({
            id: z.guid(),
            position: z.number(),
            exercise: z.string(),
            targetSets: z.number(),
            targetRir: z.number().nullable(),
          }),
        ),
      }),
    ),
  }),
});

const fixture = fixtureSchema.parse(goldenWeek);

const requireExercise = (sourceRef: string) => {
  const exercise = fixture.exercises.find((candidate) => candidate.sourceRef === sourceRef);
  if (exercise === undefined) {
    throw new Error("The fixture names an exercise it does not hold");
  }
  return exercise;
};

const goldenRoutine: PlanRoutine = {
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

// The seven muscles the golden routine never trains (KEY-356 changed their 21 cells).
const UNTRAINED_BY_THE_ROUTINE: readonly MuscleId[] = [
  "traps_upper",
  "abs",
  "obliques",
  "glute_med",
  "adductors",
  "tibialis",
  "neck",
];

const TRAINED_BY_THE_ROUTINE: readonly MuscleId[] = MUSCLE_IDS.filter(
  (muscle) => !UNTRAINED_BY_THE_ROUTINE.includes(muscle),
);

const answersFor = (goal: GoalAnswers["goal"], focus: GoalAnswers["focus"]): GoalAnswers => ({
  goal,
  focus,
  days_per_week: 4,
  session_minutes: 60,
  equipment: ["barbell", "dumbbell"],
  experience: "intermediate",
});

describe("goalTargetedMuscles", () => {
  it("should be the muscles the aesthetic V-taper priority ranks above 0, the 15 the routine trains", () => {
    const priority = deriveMusclePriority(answersFor("aesthetic", ["v_taper"]), GOAL_PRESETS_V1);

    expect(goalTargetedMuscles(priority)).toStrictEqual(new Set(TRAINED_BY_THE_ROUTINE));
  });

  it("should leave out every muscle at 0", () => {
    expect(goalTargetedMuscles({ chest_upper: 3, abs: 0, lats: 1 })).toStrictEqual(
      new Set(["chest_upper", "lats"]),
    );
  });

  it("should be empty when no muscle is ranked", () => {
    expect(goalTargetedMuscles({})).toStrictEqual(new Set());
  });
});

describe("targetedMuscles with the golden routine and a goal priority", () => {
  it("should read the seven untrained muscles as not targeted for the aesthetic V-taper user", () => {
    const priority = deriveMusclePriority(answersFor("aesthetic", ["v_taper"]), GOAL_PRESETS_V1);

    const targeted = targetedMuscles({ routine: goldenRoutine, priority });

    expect(targeted).toStrictEqual(new Set(TRAINED_BY_THE_ROUTINE));
    for (const muscle of UNTRAINED_BY_THE_ROUTINE) {
      expect(targeted.has(muscle)).toBe(false);
    }
  });

  it("should keep abs and obliques not targeted whatever the goal and focus, until a routine ranks them", () => {
    const focuses = [["overall"], ["v_taper", "chest", "arms", "glutes", "legs"]] as const;
    for (const goal of ["aesthetic", "strength", "hybrid"] as const) {
      for (const focus of focuses) {
        const priority = deriveMusclePriority(answersFor(goal, [...focus]), GOAL_PRESETS_V1);

        const targeted = targetedMuscles({ routine: goldenRoutine, priority });

        expect(targeted.has("abs")).toBe(false);
        expect(targeted.has("obliques")).toBe(false);
      }
    }
  });

  it("should add the muscle a goal ranks that the routine does not train (strength ranks upper traps)", () => {
    const priority = deriveMusclePriority(answersFor("strength", []), GOAL_PRESETS_V1);

    const targeted = targetedMuscles({ routine: goldenRoutine, priority });

    expect(targeted.has("traps_upper")).toBe(true);
    expect(MUSCLE_IDS.filter((muscle) => !targeted.has(muscle))).toStrictEqual([
      "abs",
      "obliques",
      "glute_med",
      "adductors",
      "tibialis",
      "neck",
    ]);
  });
});
