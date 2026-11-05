import { ADD_EXERCISE } from "@keylow/core/copy";

import { BottomSheet } from "../ui";
import { AddExerciseSteps } from "./AddExerciseSteps";

import type { AddExerciseSheetProps } from "./types";

// The `session · add-exercise` board's sheet starts 52 of 844 points from the top, which is 94 percent of it.
const SNAP_POINTS = ["94%"];

/**
 * The Add exercise sheet: search your exercises and the library and pick one, or make one of your own from
 * the `Create "…"` row. In `session` mode the exercise goes to the session screen, which draws a card for it.
 * In `routine` mode it goes back to the editor and no session is touched. The sheet closes once an exercise
 * is picked or made.
 */
export function AddExerciseSheet(props: AddExerciseSheetProps) {
  const { open, onClose } = props;
  const choose = props.mode === "session" ? props.onAddToSession : props.onChoose;
  const destination =
    props.mode === "session"
      ? ({ kind: "session", dayName: props.dayName } as const)
      : ({ kind: "routine" } as const);

  return (
    <BottomSheet label={ADD_EXERCISE.title} open={open} snapPoints={SNAP_POINTS} onClose={onClose}>
      <AddExerciseSteps destination={destination} onChoose={choose} onClose={onClose} />
    </BottomSheet>
  );
}
