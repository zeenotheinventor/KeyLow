import { describeNewDayName } from "@keylow/core/copy";
import { MAX_DAYS_PER_ROUTINE } from "@keylow/core/training";

import type { EditorAction, EditorDay, EditorState } from "./types";
import type { RoutineDraft } from "@keylow/core/training";

/** The editor's state for a routine, every day closed. */
export const startingStateOf = (draft: RoutineDraft): EditorState => ({
  name: draft.name,
  days: draft.days.map((day, key) => ({ ...day, key, isOpen: false })),
  nextKey: draft.days.length,
});

/** The draft core's rules and summary read: the state without the editor's own keys and open flags. */
export const draftOfState = (state: EditorState): RoutineDraft => ({
  name: state.name,
  days: state.days.map(({ id, weekday, name, exercises }) => ({ id, weekday, name, exercises })),
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

const changeDay = (
  state: EditorState,
  key: number,
  change: (day: EditorDay) => EditorDay,
): EditorState => ({
  ...state,
  days: state.days.map((day) => (day.key === key ? change(day) : day)),
});

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
  }
}
