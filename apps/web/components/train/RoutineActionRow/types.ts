import type * as React from "react";

export type RoutineActionRowProps = {
  title: string;
  subtitle: string;
  /** Opens the routine's editor. The row's words are plain text without it. */
  onOpen?: (() => void) | undefined;
  /** The button's visible words: Make active or Restore. */
  actionLabel: string;
  /** The button's accessible name. It starts with the visible words, so a person who speaks the label reaches it. */
  actionName: string;
  /** Runs the action, with the button that was pressed. The button is not drawn without it. */
  onAction?: ((button: HTMLButtonElement) => void) | undefined;
  /** Dims the button, as while there is no connection. Say why with `actionDescribedBy`. */
  isActionDisabled: boolean;
  /** The id of the line that says why the button is off. */
  actionDescribedBy?: string | undefined;
  /** The action button, for a screen that hands focus to the next row's once this one is gone. */
  actionRef?: React.Ref<HTMLButtonElement> | undefined;
};
