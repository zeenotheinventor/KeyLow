import { RECIPE_PROBLEMS, RECIPE_TOASTS, UNDO_LABEL } from "@keylow/core/copy";
import {
  MAX_RECIPE_STEPS,
  addStep,
  editStep,
  isStepTooLong,
  moveStepDown,
  moveStepUp,
  removeStep,
} from "@keylow/core/recipes";
import { CircleAlert, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { StepEdit } from "../RecipeStepsCard";
import type { RecipeDraft } from "@keylow/core/recipes";
import type { Dispatch, RefObject, SetStateAction } from "react";

import { useToast } from "@/components/ui/Toast";
import { useKeyboardUndo } from "@/lib/keyboardUndo";

/**
 * The step as Done keeps it: trimmed, a new one at the end and an edited one in its place. A blank one
 * changes nothing, so no step is ever empty and the list is not touched.
 */
function applyEdit(steps: readonly string[], edit: StepEdit): string[] {
  const text = edit.text.trim();
  if (text === "") {
    return [...steps];
  }
  if (edit.kind === "add") {
    return steps.length >= MAX_RECIPE_STEPS ? [...steps] : addStep(steps, text);
  }

  return edit.position < steps.length ? editStep(steps, edit.position, text) : [...steps];
}

/**
 * What the Instructions card can do to the recipe's draft: write a step in the open field and keep it,
 * move a step a place up or down, remove one with an Undo that puts it back where it was. Nothing here is
 * saved: the draft is the editor's until Save. The lists are core's.
 *
 * The page does not stop at an open field the way a sheet does, so anything that would change the list
 * (another step opened, a move, a removal, Save) first keeps the open step as Done would. One that is too
 * long to keep stops the press and brings the cursor back to it. The open step is held by its place, taken
 * when it opened, so no later change to the list can send its text to another step. The Undo that a
 * removal offers is taken down when a field opens or a step moves, since the places it counts from would
 * be gone. A step is text with no identity of its own, so the Undo puts back the text that was removed,
 * in the place it had.
 */
export function useStepEdits(
  steps: readonly string[],
  setDraft: Dispatch<SetStateAction<RecipeDraft>>,
  textAreaRef: RefObject<HTMLTextAreaElement | null>,
) {
  const toast = useToast();
  const keyboardUndo = useKeyboardUndo();
  const [edit, setEdit] = useState<StepEdit | null>(null);
  // An Undo is pressed long after the removal, so it reads the list as it is by then.
  const latestSteps = useRef(steps);

  useEffect(() => {
    latestSteps.current = steps;
  }, [steps]);

  function change(edits: (current: readonly string[]) => string[]) {
    setDraft((current) => ({ ...current, steps: edits(current.steps) }));
  }

  function restore(position: number, removed: string) {
    if (latestSteps.current.length >= MAX_RECIPE_STEPS) {
      toast.show({ message: RECIPE_PROBLEMS.stepLimit, tone: "danger", icon: CircleAlert });
      return;
    }
    change((current) =>
      current.length >= MAX_RECIPE_STEPS
        ? [...current]
        : addStep(current, removed, Math.min(position, current.length)),
    );
  }

  /**
   * Keeps the open step, if there is one, and gives the list that results, which is the draft's own when
   * nothing is open. Null when the open step is too long to keep: it stays open and has the cursor.
   */
  function settle(): readonly string[] | null {
    if (edit === null) {
      return steps;
    }
    if (isStepTooLong(edit.text)) {
      textAreaRef.current?.focus();
      return null;
    }
    change((current) => applyEdit(current, edit));
    setEdit(null);

    return applyEdit(steps, edit);
  }

  function move(position: number, direction: "up" | "down"): number | null {
    const settled = settle();
    if (settled === null) {
      return null;
    }
    // The first step cannot move up and the last cannot move down, and the buttons are off there.
    const target = direction === "up" ? position - 1 : position + 1;
    if (position >= settled.length || target < 0 || target >= settled.length) {
      return null;
    }
    toast.dismiss();
    change((current) => {
      if (position >= current.length) {
        return [...current];
      }
      return direction === "up" ? moveStepUp(current, position) : moveStepDown(current, position);
    });

    return settled.length;
  }

  return {
    edit,
    /** The steps with the open one in them, for what counts as a change. */
    stepsWithEdit: edit === null ? steps : applyEdit(steps, edit),
    settle,
    openEdit: (position: number) => {
      const settled = settle();
      const text = settled?.[position];
      if (text !== undefined) {
        toast.dismiss();
        setEdit({ kind: "edit", position, text });
      }
    },
    openAdd: () => {
      const settled = settle();
      if (settled !== null && settled.length < MAX_RECIPE_STEPS) {
        toast.dismiss();
        setEdit({ kind: "add", text: "" });
      }
    },
    changeText: (text: string) => {
      setEdit((current) => (current === null ? null : { ...current, text }));
    },
    done: () => {
      settle();
    },
    cancel: () => {
      setEdit(null);
    },
    moveUp: (position: number) => move(position, "up"),
    moveDown: (position: number) => move(position, "down"),
    remove: (position: number, from: HTMLElement) => {
      const removed = settle()?.[position];
      if (removed === undefined) {
        return;
      }
      // Asked before the row goes, while focus is still on its button.
      const keyboardRoute = keyboardUndo.afterRemovingRow({ from });
      change((current) =>
        position < current.length ? removeStep(current, position) : [...current],
      );
      toast.show({
        message: RECIPE_TOASTS.stepRemoved,
        icon: Trash2,
        actionLabel: UNDO_LABEL,
        onAction: () => {
          restore(position, removed);
        },
        ...keyboardRoute,
      });
    },
  };
}
