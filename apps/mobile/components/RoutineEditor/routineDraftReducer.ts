import { describeNewDayName } from "@keylow/core/copy";
import {
  MAX_DAYS_PER_ROUTINE,
  MAX_EXERCISES_PER_ROUTINE_DAY,
  summariseRoutine,
} from "@keylow/core/training";

import {
  NEW_EXERCISE_TARGETS,
  draftExerciseOf,
  editorExerciseOf,
  withFieldText,
} from "./editorExercise";

import type { EditorExercise, ExerciseNames } from "./editorExercise";
import type { EditorAction, EditorDay, EditorState, MoveDirection } from "./types";
import type { RoutineDraft } from "@keylow/core/training";

/** The editor's state for a routine, every day closed. `exerciseNames` gives each exercise's name by its id. */
export const startingStateOf = (
  draft: RoutineDraft,
  exerciseNames: ExerciseNames = {},
): EditorState => {
  let nextExerciseKey = 0;
  const days = draft.days.map((day, key) => ({
    ...day,
    key,
    isOpen: false,
    exercises: day.exercises.map((exercise) =>
      editorExerciseOf(exercise, nextExerciseKey++, exerciseNames[exercise.exercise_id] ?? ""),
    ),
  }));
  return { name: draft.name, days, nextKey: draft.days.length, nextExerciseKey };
};

/** The draft core's rules read: the state without the editor's own keys, open flags, names and text. */
export const draftOfState = (state: EditorState): RoutineDraft => ({
  name: state.name,
  days: state.days.map(({ id, weekday, name, exercises }) => ({
    id,
    weekday,
    name,
    exercises: exercises.map(draftExerciseOf),
  })),
});

/**
 * What the days and the routine show as counts. A field that cannot be read as sets (an emptied one) counts
 * as none, so the counts are always numbers.
 */
export const summaryOf = (state: EditorState) =>
  summariseRoutine({
    days: state.days.map(({ weekday, exercises }) => ({
      weekday,
      exercises: exercises.map(({ target_sets }) => ({
        target_sets: Number.isSafeInteger(target_sets) ? target_sets : 0,
      })),
    })),
  });

/** The name for a day added at the end: "Day 5" for the fifth day, stepping up while a day already has the name, so a removal never leads to two days of one name. */
function newDayName(days: readonly EditorDay[]): string {
  const taken = new Set(days.map((day) => day.name));
  for (let position = days.length + 1; ; position += 1) {
    const name = describeNewDayName(position);
    if (!taken.has(name)) {
      return name;
    }
  }
}

/** The list with the item at `index` swapped with its neighbour in the direction, or the list itself when there is no neighbour. */
function moved<Item>(items: readonly Item[], index: number, by: MoveDirection): readonly Item[] {
  const target = by === "up" ? index - 1 : index + 1;
  const item = items[index];
  const neighbour = items[target];
  if (item === undefined || neighbour === undefined) {
    return items;
  }
  return items.map((existing, position) =>
    position === index ? neighbour : position === target ? item : existing,
  );
}

const changeDay = (
  state: EditorState,
  key: number,
  change: (day: EditorDay) => EditorDay,
): EditorState => ({
  ...state,
  days: state.days.map((day) => (day.key === key ? change(day) : day)),
});

const changeExercises = (
  state: EditorState,
  dayKey: number,
  change: (exercises: readonly EditorExercise[]) => readonly EditorExercise[],
): EditorState => changeDay(state, dayKey, (day) => ({ ...day, exercises: change(day.exercises) }));

export function routineDraftReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "renameRoutine":
      return { ...state, name: action.name };
    case "addDay":
      if (state.days.length >= MAX_DAYS_PER_ROUTINE) {
        return state;
      }
      return {
        ...state,
        days: [
          ...state.days,
          {
            key: state.nextKey,
            id: null,
            name: newDayName(state.days),
            weekday: null,
            exercises: [],
            isOpen: true,
          },
        ],
        nextKey: state.nextKey + 1,
      };
    case "renameDay":
      return changeDay(state, action.key, (day) => ({ ...day, name: action.name }));
    case "setWeekday":
      return changeDay(state, action.key, (day) => ({ ...day, weekday: action.weekday }));
    case "removeDay":
      return { ...state, days: state.days.filter((day) => day.key !== action.key) };
    case "toggleDay":
      return changeDay(state, action.key, (day) => ({ ...day, isOpen: !day.isOpen }));
    case "addExercise": {
      const day = state.days.find(({ key }) => key === action.dayKey);
      if (day === undefined || day.exercises.length >= MAX_EXERCISES_PER_ROUTINE_DAY) {
        return state;
      }
      const added = editorExerciseOf(
        { exercise_id: action.exercise.id, ...NEW_EXERCISE_TARGETS },
        state.nextExerciseKey,
        action.exercise.name,
      );
      return {
        ...changeDay(state, action.dayKey, (target) => ({
          ...target,
          exercises: [...target.exercises, added],
        })),
        nextExerciseKey: state.nextExerciseKey + 1,
      };
    }
    case "editExercise":
      return changeExercises(state, action.dayKey, (exercises) =>
        exercises.map((exercise) =>
          exercise.key === action.key
            ? withFieldText(exercise, action.field, action.text)
            : exercise,
        ),
      );
    case "removeExercise":
      return changeExercises(state, action.dayKey, (exercises) =>
        exercises.filter((exercise) => exercise.key !== action.key),
      );
    case "moveDay": {
      const days = moved(
        state.days,
        state.days.findIndex((day) => day.key === action.key),
        action.by,
      );
      return days === state.days ? state : { ...state, days };
    }
    case "moveExercise": {
      const day = state.days.find(({ key }) => key === action.dayKey);
      if (day === undefined) {
        return state;
      }
      const exercises = moved(
        day.exercises,
        day.exercises.findIndex((exercise) => exercise.key === action.key),
        action.by,
      );
      return exercises === day.exercises
        ? state
        : changeDay(state, action.dayKey, (target) => ({ ...target, exercises }));
    }
    case "openDays":
      return {
        ...state,
        days: state.days.map((day) =>
          action.keys.includes(day.key) ? { ...day, isOpen: true } : day,
        ),
      };
  }
}
