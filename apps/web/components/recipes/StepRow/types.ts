import type { RefObject } from "react";

/** What the recipe editor's row can do to its step. The recipe view's row has none of it. */
export type StepRowControls = {
  /** False for the first step, which core refuses to move up. */
  canMoveUp: boolean;
  /** False for the last step, which core refuses to move down. */
  canMoveDown: boolean;
  /** The recipe is being saved, so the step is not changed under it. */
  isLocked: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  /** Called with the Remove button, which the keyboard route to Undo starts from. */
  onRemove: (opener: HTMLElement) => void;
};

/** The field that replaces the step's text and buttons while it is edited, or while a new step is written. */
export type StepRowEditor = {
  /** What is in the field now. */
  text: string;
  /** A step that is not in the method yet, so the button that keeps it says Add step and not Done. */
  isNew: boolean;
  /** The field, so the editor can bring the cursor back to it. */
  textAreaRef: RefObject<HTMLTextAreaElement | null>;
  onChangeText: (text: string) => void;
  onDone: () => void;
  onCancel: () => void;
};

export type StepRowProps = {
  /** The step's place in the method, from 1. */
  number: number;
  /** The whole step. It wraps, and is never cut short. */
  text: string;
  /** Without `controls` or `editor` the row is read only, as the recipe view draws it. */
  controls?: StepRowControls | undefined;
  /** Replaces the text and the buttons with a field. */
  editor?: StepRowEditor | undefined;
  /** Tints the row, as a step that has just moved is for a moment. */
  isHighlighted?: boolean | undefined;
};

export type StepTextEditorProps = {
  /** The place the step has, from 1, which names the field. */
  number: number;
  editor: StepRowEditor;
};
