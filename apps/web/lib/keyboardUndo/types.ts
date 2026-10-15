import type { ToastFocusAction } from "@/components/ui/Toast";

/** What a screen spreads into a toast's options: the keyboard route, or nothing for a pointer. */
export type KeyboardUndoOptions = { focusAction?: ToastFocusAction };

export type KeyboardUndo = {
  /**
   * For a delete: call it when the press arrives, while focus is still on the row's button. Focus goes to
   * Undo, and on close to the next row's first control, or the one before the row when it was the last.
   * From inside a dialog, give `from`: the diary control the dialog was opened from, which sits in the row.
   * The controls inside the modal dialog are never the place to go back to.
   */
  afterRemovingRow: (options?: { from?: Element | null | undefined }) => KeyboardUndoOptions;
  /**
   * For an action that finishes later, such as a copy: call it when the press arrives, and call what it
   * returns when the action finishes. The route is given only if focus is still on the button or has been
   * lost to the page, so a person who has moved on is left there. Focus then comes back to the button.
   * When the action takes the button away (the copy fills the day, so the empty day's card goes), give
   * `returnTo`: it is asked for the place to go back to when the toast closes, by which time the page has
   * drawn what the action made, and it must give something that is on the page.
   */
  afterPressingButton: (options?: {
    returnTo?: (() => HTMLElement | null) | undefined;
  }) => () => KeyboardUndoOptions;
};
