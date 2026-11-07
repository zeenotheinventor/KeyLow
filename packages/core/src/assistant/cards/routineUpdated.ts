import {
  OPEN_IN_ROUTINE_EDITOR,
  describeAddedDayRow,
  describeAddedExerciseRow,
  describeChangedTargetsRow,
  describeMovedDayRow,
  describeRemovedExerciseRow,
  describeRenamedDayRow,
  describeReorderedDayRow,
  describeRoutineChangeCount,
  describeRoutineDayChangeCount,
  describeRoutineUpdatedSubForDay,
  describeRoutineUpdatedTitle,
  describeRoutineUpdatedUndone,
  describeSwappedExerciseRow,
} from "../../copy/assistantTrainingCards";

import type { AssistantCardDraft } from "./entryCardEntry";
import type { RoutineTargetWords } from "../../copy/assistantTrainingCards";
import type { AssistantCardRow } from "../card";

/**
 * One change `edit_routine` applied, worded by the tool from the routine before the call and the numbers it
 * resolved. An exercise change names its day. `now` and `was` are null when the exercise's numbers are not
 * known, and then the row says the day only.
 */
export type RoutineUpdatedChange =
  | { op: "add"; dayName: string; exerciseName: string; targets: RoutineTargetWords }
  | {
      op: "swap";
      dayName: string;
      oldExerciseName: string;
      newExerciseName: string;
      targets: RoutineTargetWords | null;
    }
  | { op: "remove"; dayName: string; exerciseName: string }
  | {
      op: "set_targets";
      dayName: string;
      exerciseName: string;
      now: RoutineTargetWords | null;
      was: RoutineTargetWords | null;
    }
  | { op: "add_day"; dayName: string; weekday: number | null; exerciseCount: number }
  | { op: "rename_day"; oldName: string; newName: string; weekday: number | null }
  | { op: "move_day_weekday"; dayName: string; weekday: number | null; was: number | null }
  | { op: "reorder_day"; dayName: string; place: number };

type Words = { name: string; detail: string };

const wordsOf = (change: RoutineUpdatedChange): Words => {
  switch (change.op) {
    case "add":
      return describeAddedExerciseRow(change.exerciseName, change.dayName, change.targets);
    case "swap":
      return describeSwappedExerciseRow(
        change.oldExerciseName,
        change.newExerciseName,
        change.dayName,
        change.targets,
      );
    case "remove":
      return describeRemovedExerciseRow(change.exerciseName, change.dayName);
    case "set_targets":
      return describeChangedTargetsRow(change.exerciseName, change.dayName, change.now, change.was);
    case "add_day":
      return describeAddedDayRow(change.dayName, change.weekday, change.exerciseCount);
    case "rename_day":
      return describeRenamedDayRow(change.oldName, change.newName, change.weekday);
    case "move_day_weekday":
      return describeMovedDayRow(change.dayName, change.weekday, change.was);
    case "reorder_day":
      return describeReorderedDayRow(change.dayName, change.place);
  }
};

const rowOf = (change: RoutineUpdatedChange): AssistantCardRow => {
  const { name, detail } = wordsOf(change);
  return {
    name,
    amountText: detail,
    time: null,
    kcalText: null,
    match: null,
    matchedFood: null,
    estimate: false,
  };
};

const isDayChange = (change: RoutineUpdatedChange): boolean =>
  change.op === "add_day" ||
  change.op === "rename_day" ||
  change.op === "move_day_weekday" ||
  change.op === "reorder_day";

// The day an exercise change is in, or null for a change to a day itself.
const dayOfExerciseChange = (change: RoutineUpdatedChange): string | null =>
  isDayChange(change) ? null : "dayName" in change ? change.dayName : null;

const subOf = (changes: readonly RoutineUpdatedChange[]): string => {
  if (changes.every(isDayChange)) {
    return describeRoutineDayChangeCount(changes.length);
  }
  const days = new Set(changes.map(dayOfExerciseChange));
  const [onlyDay] = days;
  return days.size === 1 && onlyDay !== null && onlyDay !== undefined
    ? describeRoutineUpdatedSubForDay(onlyDay, changes.length)
    : describeRoutineChangeCount(changes.length);
};

/**
 * The card after an `edit_routine`: "Updated routine Push Pull Legs", one row for each change, a link to the
 * routine editor and Undo. The sub says the day when every change is to one day's exercises, and says
 * "changes to days" when only days changed (`assistant-card · routine-updated`).
 */
export function buildRoutineUpdatedCard({
  routineId,
  routineName,
  changes,
}: {
  routineId: string;
  routineName: string;
  changes: readonly RoutineUpdatedChange[];
}): AssistantCardDraft {
  return {
    kind: "routine_updated",
    title: describeRoutineUpdatedTitle(routineName),
    sub: subOf(changes),
    rows: changes.map(rowOf),
    changeDetail: describeRoutineChangeCount(changes.length),
    totalText: null,
    note: null,
    link: {
      label: OPEN_IN_ROUTINE_EDITOR,
      target: { screen: "routine_editor", routineId },
    },
    undo: "available",
    undoneSub: describeRoutineUpdatedUndone(routineName),
  };
}
