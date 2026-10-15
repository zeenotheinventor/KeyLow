import { useEffect } from "react";

import type { ToastFocusAction } from "@/components/ui/Toast";

/** What a screen spreads into a toast's options: the keyboard route, or nothing for a pointer. */
export type KeyboardUndoOptions = { focusAction?: ToastFocusAction };

export type KeyboardUndo = {
  /**
   * For a delete: call it when the press arrives, while focus is still on the row's button. Focus goes to
   * Undo, and on close to the next row's first control, or the one before the row when it was the last.
   */
  afterRemovingRow: () => KeyboardUndoOptions;
  /** For an action that leaves its button in place, such as a copy: focus comes back to that button. */
  afterPressingButton: () => KeyboardUndoOptions;
};

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const ROW = '[role="row"], li, tr';

// The page has one keyboard-or-pointer fact, however many screens ask, so the listeners are shared.
let lastInputWasKeyboard = false;
let screensListening = 0;

const noteKeyboard = () => {
  lastInputWasKeyboard = true;
};
const notePointer = () => {
  lastInputWasKeyboard = false;
};

function listenToInputDevice() {
  if (screensListening === 0) {
    document.addEventListener("keydown", noteKeyboard, true);
    document.addEventListener("pointerdown", notePointer, true);
  }
  screensListening += 1;

  return () => {
    screensListening -= 1;
    if (screensListening === 0) {
      document.removeEventListener("keydown", noteKeyboard, true);
      document.removeEventListener("pointerdown", notePointer, true);
    }
  };
}

// A control hidden by CSS cannot take focus. Browsers can say so; jsdom cannot, and shows everything.
const isShown = (element: HTMLElement): boolean =>
  typeof element.checkVisibility !== "function" || element.checkVisibility();

function focusedElement(): HTMLElement | null {
  const { activeElement } = document;

  return activeElement instanceof HTMLElement && activeElement !== document.body
    ? activeElement
    : null;
}

/** The control to focus once `row` is gone: the first one after it, else the last one before it. */
function controlBeside(row: Element): HTMLElement | null {
  const controls = Array.from(document.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (control) => !row.contains(control) && isShown(control),
  );
  const isAfterRow = (control: HTMLElement) =>
    (row.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

  return (
    controls.find(isAfterRow) ?? controls.filter((control) => !isAfterRow(control)).at(-1) ?? null
  );
}

/**
 * The keyboard route to Undo (KEY-218). The toast sits after the page, so a keyboard user could not reach
 * its Undo within the wait. When the last thing the person did was press a key, these give the toast's
 * options a `focusAction`; after a pointer press they give nothing, and the toast leaves focus alone.
 */
export function useKeyboardUndo(): KeyboardUndo {
  useEffect(listenToInputDevice, []);

  return {
    afterRemovingRow: () => {
      if (!lastInputWasKeyboard) {
        return {};
      }
      const pressed = focusedElement();
      const row = pressed?.closest(ROW) ?? pressed;

      return { focusAction: { returnTo: row === null ? null : controlBeside(row) } };
    },
    afterPressingButton: () =>
      lastInputWasKeyboard ? { focusAction: { returnTo: focusedElement() } } : {},
  };
}
