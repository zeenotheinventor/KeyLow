"use client";

import { ADD_EXERCISE } from "@keylow/core/copy";

import { AddExercisePicker } from "./AddExercisePicker";

import type { AddExerciseDialogProps } from "./types";

import { Dialog } from "@/components/ui/Dialog";

// The dialog keeps one height through its states, so it does not jump as results arrive. Below 700 px the
// dialog is already the whole screen.
const PANEL_CLASSES = "min-[700px]:h-[min(720px,calc(100%-theme(spacing.12)))]";

/**
 * The Add exercise dialog: search your exercises and the library and pick one, as the `session · add-exercise`
 * board draws it in a web `Dialog`, since the web has no bottom sheet. In `session` mode the exercise goes to
 * the session page, which draws a card for it. In `routine` mode it goes back to the editor and no session is
 * touched. The dialog closes once an exercise is picked.
 */
export function AddExerciseDialog(props: AddExerciseDialogProps) {
  const { open, onClose, onCreate } = props;
  const choose = props.mode === "session" ? props.onAddToSession : props.onChoose;

  return (
    <Dialog open={open} title={ADD_EXERCISE.title} onClose={onClose} className={PANEL_CLASSES}>
      <AddExercisePicker
        onChoose={(exercise) => {
          choose(exercise);
          onClose();
        }}
        onCreate={onCreate}
      />
    </Dialog>
  );
}
