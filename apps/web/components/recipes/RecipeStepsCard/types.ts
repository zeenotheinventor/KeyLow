import type { RefObject } from "react";

/**
 * The step that is open for writing: one of the method's, held by the place it had when it was opened (an
 * edit changes no place, and anything else that would settles it first), or a new one for the end.
 */
export type StepEdit =
  { kind: "edit"; position: number; text: string } | { kind: "add"; text: string };

export type RecipeStepsCardProps = {
  /** The method as the draft holds it, step 1 first. */
  steps: readonly string[];
  /** The step that is open for writing, if one is. */
  edit: StepEdit | null;
  /** The field of the open step, so the editor can bring the cursor back to it. */
  textAreaRef: RefObject<HTMLTextAreaElement | null>;
  /** The recipe is being saved, so the steps are not changed under it. */
  isLocked: boolean;
  onOpenEdit: (position: number) => void;
  onOpenAdd: () => void;
  onChangeText: (text: string) => void;
  onDone: () => void;
  onCancel: () => void;
  /**
   * Moves the step at `position` up and gives how many steps there are by then, since keeping an open new
   * step first can add one. Null when nothing moved: a step that is open and too long holds everything still.
   */
  onMoveUp: (position: number) => number | null;
  onMoveDown: (position: number) => number | null;
  /** Remove on the step at `position`, with the button. */
  onRemove: (position: number, opener: HTMLElement) => void;
};
