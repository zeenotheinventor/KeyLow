import { useRef } from "react";

import type { FocusEvent, MouseEvent } from "react";

/**
 * Selects the whole number of the amount field whenever it gets focus, by click, by Tab or by a dialog
 * focusing it as it opens, so the next keystroke replaces it. Chrome and Safari put the caret down on the
 * mouseup that ends a click which gave the field focus, which would wipe a selection made on focus, so that
 * one mouseup is stopped. A second click on the field, which already has focus, places the caret as usual.
 * Spread the handlers onto the field.
 */
export function useSelectAmountOnFocus() {
  const pressGaveFocus = useRef(false);

  return {
    onMouseDown: (event: MouseEvent<HTMLInputElement>) => {
      pressGaveFocus.current = document.activeElement !== event.currentTarget;
    },
    onFocus: (event: FocusEvent<HTMLInputElement>) => {
      event.currentTarget.select();
    },
    onMouseUp: (event: MouseEvent<HTMLInputElement>) => {
      if (pressGaveFocus.current) {
        event.preventDefault();
        pressGaveFocus.current = false;
      }
    },
    onBlur: () => {
      pressGaveFocus.current = false;
    },
  };
}
