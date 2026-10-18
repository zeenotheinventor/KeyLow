import goldenWeek from "../fixtures/training/goldenWeek.json";

import type { RoutineDraft } from "../../src/training";

/** A routine exercise as its row reads, with the targets the planner and the editor use. */
export type StoredRoutineExercise = {
  id: string;
  position: number;
  exercise_id: string;
  target_sets: number;
  rep_min: number;
  rep_max: number;
  target_rir: number | null;
};

export type StoredRoutineDay = {
  id: string;
  position: number;
  weekday: number | null;
  name: string;
  exercises: StoredRoutineExercise[];
};

const exerciseIdOf = (sourceRef: string): string => {
  const exercise = goldenWeek.exercises.find((candidate) => candidate.sourceRef === sourceRef);
  if (exercise === undefined) {
    throw new Error("The golden fixture names an exercise it does not hold");
  }
  return exercise.id;
};

export const goldenRoutineName: string = goldenWeek.routine.name;

/**
 * The golden routine of KEY-353 (Push Pull Legs: Push on Monday, Pull on Tuesday, Legs on Thursday and
 * Push on Saturday) as its rows read, in position order. Push is 5 exercises and 16 sets, Pull 5 and 15,
 * Legs 5 and 16, and the second Push 5 and 16, so 63 sets a week.
 */
export const goldenRoutineDays: StoredRoutineDay[] = goldenWeek.routine.days.map((day) => ({
  id: day.id,
  position: day.position,
  weekday: day.weekday,
  name: day.name,
  exercises: day.exercises.map((routineExercise) => ({
    id: routineExercise.id,
    position: routineExercise.position,
    exercise_id: exerciseIdOf(routineExercise.exercise),
    target_sets: routineExercise.targetSets,
    rep_min: routineExercise.targetRepsMin,
    rep_max: routineExercise.targetRepsMax,
    target_rir: routineExercise.targetRir,
  })),
}));

const requireDay = (name: string): StoredRoutineDay => {
  const day = goldenRoutineDays.find((candidate) => candidate.name === name);
  if (day === undefined) {
    throw new Error("The golden routine has no day of that name");
  }
  return day;
};

export const goldenPushDay: StoredRoutineDay = requireDay("Push");
export const goldenPullDay: StoredRoutineDay = requireDay("Pull");
export const goldenLegsDay: StoredRoutineDay = requireDay("Legs");

/** The golden routine as the editor holds it: every day keeps its id, so a save updates it in place. */
export const goldenRoutineDraft: RoutineDraft = {
  name: goldenRoutineName,
  days: goldenRoutineDays.map((day) => ({
    id: day.id,
    weekday: day.weekday,
    name: day.name,
    exercises: day.exercises.map((routineExercise) => ({
      exercise_id: routineExercise.exercise_id,
      target_sets: routineExercise.target_sets,
      rep_min: routineExercise.rep_min,
      rep_max: routineExercise.rep_max,
      target_rir: routineExercise.target_rir,
    })),
  })),
};
