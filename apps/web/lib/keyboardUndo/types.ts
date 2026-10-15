import type { ToastFocusAction } from "@/components/ui/Toast";

/** What a screen spreads into a toast's options: the keyboard route, or nothing for a pointer. */
export type KeyboardUndoOptions = { focusAction?: ToastFocusAction };

export type KeyboardUndo = {
  /**
   * For a delete: call it when the press arrives, while focus is still on the row's button. Focus goes to
   * Undo, and on close to the next row's first control, or the one before the row when it was the last.
   */
  afterRemovingRow: () => KeyboardUndoOptions;
  /**
   * For an action that leaves its button in place and finishes later, such as a copy: call it when the
   * press arrives, and call what it returns when the action finishes. The route is given only if focus
   * is still on the button or has been lost to the page, so a person who has moved on is left there.
   * Focus then comes back to the button.
   */
  afterPressingButton: () => () => KeyboardUndoOptions;
};
