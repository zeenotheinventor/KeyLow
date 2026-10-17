import { RECIPE_PROBLEMS, RECIPE_TOASTS, UNDO_LABEL } from "@keylow/core/copy";
import {
  MAX_RECIPE_STEPS,
  addStep,
  editStep,
  moveStepDown,
  moveStepUp,
  removeStep,
} from "@keylow/core/recipes";
import { useEffect, useRef } from "react";

import { useToast } from "../ui";

import type { RecipeDraft } from "@keylow/core/recipes";
import type { Dispatch, SetStateAction } from "react";

/**
 * What the Instructions section can do to the recipe's draft: add a step at the end, replace one in place,
 * move one a place up or down, remove one with an Undo that puts it back where it was. Nothing here is
 * saved: the draft is the editor's until Save. The lists are core's. A full list has no room for an Undo
 * that follows an add, so that Undo says why instead of failing. A step is text with no identity of its
 * own, so the Undo puts back the text that was removed, in the place it had.
 */
export function useStepEdits(
  steps: readonly string[],
  setDraft: Dispatch<SetStateAction<RecipeDraft>>,
) {
  const toast = useToast();
  // An Undo is pressed long after the removal, so it reads the list as it is by then.
  const latestSteps = useRef(steps);

  useEffect(() => {
    latestSteps.current = steps;
  }, [steps]);

  function change(edit: (current: readonly string[]) => string[]) {
    setDraft((current) => ({ ...current, steps: edit(current.steps) }));
  }

  function restore(position: number, removed: string) {
    if (latestSteps.current.length >= MAX_RECIPE_STEPS) {
      toast.show({ message: RECIPE_PROBLEMS.stepLimit, tone: "danger", icon: "CircleAlert" });
      return;
    }
    change((current) =>
      current.length >= MAX_RECIPE_STEPS
        ? [...current]
        : addStep(current, removed, Math.min(position, current.length)),
    );
  }

  return {
    // A full list has no room, and the Add step row is off then, so this only guards a late press.
    add: (text: string) => {
      change((current) =>
        current.length >= MAX_RECIPE_STEPS ? [...current] : addStep(current, text),
      );
    },
    replace: (position: number, text: string) => {
      change((current) =>
        position < current.length ? editStep(current, position, text) : [...current],
      );
    },
    // The first step cannot move up and the last cannot move down, and the buttons are off there.
    moveUp: (position: number) => {
      change((current) =>
        position > 0 && position < current.length ? moveStepUp(current, position) : [...current],
      );
    },
    moveDown: (position: number) => {
      change((current) =>
        position >= 0 && position < current.length - 1
          ? moveStepDown(current, position)
          : [...current],
      );
    },
    remove: (position: number) => {
      const removed = latestSteps.current[position];
      if (removed === undefined) {
        return;
      }
      change((current) =>
        position < current.length ? removeStep(current, position) : [...current],
      );
      toast.show({
        message: RECIPE_TOASTS.stepRemoved,
        icon: "Trash2",
        actionLabel: UNDO_LABEL,
        onAction: () => {
          restore(position, removed);
        },
      });
    },
  };
}
