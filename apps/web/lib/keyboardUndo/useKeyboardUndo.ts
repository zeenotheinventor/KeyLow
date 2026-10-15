import { useEffect } from "react";

import type { KeyboardUndo } from "./types";

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
// A mouse or touch click has a detail of 1 or more. A click with none is made by the keyboard, or by a
// screen reader's virtual cursor, which sends no key and no pointer event, and needs the route as much.
const noteClick = (event: MouseEvent) => {
  lastInputWasKeyboard = event.detail === 0;
};

function listenToInputDevice() {
  if (screensListening === 0) {
    document.addEventListener("keydown", noteKeyboard, true);
    document.addEventListener("pointerdown", notePointer, true);
    document.addEventListener("click", noteClick, true);
  }
  screensListening += 1;

  return () => {
    screensListening -= 1;
    if (screensListening === 0) {
      document.removeEventListener("keydown", noteKeyboard, true);
      document.removeEventListener("pointerdown", notePointer, true);
      document.removeEventListener("click", noteClick, true);
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

// A control inside an open modal dialog is not a place to go back to: the dialog is closing with the row.
const isInsideModal = (control: Element): boolean =>
  control.closest('[aria-modal="true"]') !== null;

/** The control to focus once `row` is gone: the first one after it, else the last one before it. */
function controlBeside(row: Element): HTMLElement | null {
  const controls = Array.from(document.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (control) => !row.contains(control) && !isInsideModal(control) && isShown(control),
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
    afterRemovingRow: ({ from } = {}) => {
      if (!lastInputWasKeyboard) {
        return {};
      }
      const pressed = from ?? focusedElement();
      const row = pressed?.closest(ROW) ?? pressed;

      return { focusAction: { returnTo: row === null ? null : controlBeside(row) } };
    },
    afterPressingButton: () => {
      const pressedByKeyboard = lastInputWasKeyboard;
      const pressed = focusedElement();

      return () => {
        const focused = focusedElement();
        // Focus on nothing is focus lost to the page, as when the button is disabled while the action runs.
        const isFocusStillThere = focused === null || focused === pressed;

        return pressedByKeyboard && isFocusStillThere ? { focusAction: { returnTo: pressed } } : {};
      };
    },
  };
}
