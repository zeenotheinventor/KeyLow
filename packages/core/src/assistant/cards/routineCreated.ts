import {
  OPEN_IN_ROUTINE_EDITOR,
  ROUTINE_CREATED_NOTE,
  describeBuiltDayName,
  describeBuiltDaySummary,
  describeBuiltExerciseDetail,
  describeBuiltWeekTotal,
  describeRoutineCreatedChange,
  describeRoutineCreatedSub,
  describeRoutineCreatedTitle,
  describeRoutineCreatedUndone,
} from "../../copy/assistantTrainingCards";

import type { AssistantCardDraft } from "./entryCardEntry";
import type { ExperienceLevel, TrainingGoal } from "../../training/enums";

export type RoutineCreatedCardInput = Readonly<{
  routineId: string;
  name: string;
  goal: TrainingGoal;
  experience: ExperienceLevel;
  /** One entry for each day, in order. The counts and minutes are `summariseBuiltRoutine`'s. */
  days: readonly Readonly<{
    name: string;
    weekday: number | null;
    exerciseCount: number;
    setCount: number;
    minutes: number;
    exercises: readonly Readonly<{
      name: string;
      sets: number;
      repMin: number;
      repMax: number;
      targetRir: number | null;
    }>[];
  }>[];
  /** `summariseBuiltRoutine`'s sets in a week. */
  setsPerWeek: number;
}>;

/**
 * The card after a `create_routine`: "Built routine Push Pull Legs, 3 days", a line for each day that opens
 * to its exercises, the week's total and a link into the routine editor. Undo archives the routine.
 */
export function buildRoutineCreatedCard(input: RoutineCreatedCardInput): AssistantCardDraft {
  const { name, days, setsPerWeek } = input;
  return {
    kind: "routine_created",
    title: describeRoutineCreatedTitle(name, days.length),
    sub: describeRoutineCreatedSub(input.goal, input.experience),
    rows: [],
    days: days.map((day) => ({
      name: describeBuiltDayName(day.name, day.weekday),
      summary: describeBuiltDaySummary(day.exerciseCount, day.setCount, day.minutes),
      exercises: day.exercises.map((exercise) => ({
        name: exercise.name,
        detail: describeBuiltExerciseDetail(exercise),
      })),
    })),
    changeDetail: describeRoutineCreatedChange(days.length, setsPerWeek),
    totalText: describeBuiltWeekTotal(setsPerWeek, days.length),
    note: ROUTINE_CREATED_NOTE,
    link: {
      label: OPEN_IN_ROUTINE_EDITOR,
      target: { screen: "routine_editor", routineId: input.routineId },
    },
    undo: "available",
    undoneSub: describeRoutineCreatedUndone(name),
  };
}
