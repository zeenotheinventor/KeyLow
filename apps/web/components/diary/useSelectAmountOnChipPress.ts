import { useCallback, useLayoutEffect, useRef, useState } from "react";

import type { Ref } from "react";

/** Hands the element to a ref of either kind, returning the cleanup a callback ref may give. */
function assignRef(ref: Ref<HTMLInputElement> | undefined, element: HTMLInputElement | null) {
  if (typeof ref === "function") {
    return ref(element);
  }
  if (ref) {
    ref.current = element;
  }
}

/**
 * Puts the cursor in the amount field with its whole number selected when a unit chip is pressed, so the next
 * keystroke replaces it. The focus waits for the press counter's render, so the selection covers the starting
 * amount the new unit set and not the old number. Give `amountRef` (the dialog's own) and `amountFieldRef` to
 * the field, and `onChipPress` to the chips; a key that only walks the chips never reaches `onChipPress`.
 */
export function useSelectAmountOnChipPress(amountRef: Ref<HTMLInputElement> | undefined) {
  const amountField = useRef<HTMLInputElement | null>(null);
  const [chipPresses, setChipPresses] = useState(0);

  useLayoutEffect(() => {
    if (chipPresses > 0) {
      amountField.current?.focus();
      amountField.current?.select();
    }
  }, [chipPresses]);

  const amountFieldRef = useCallback(
    (element: HTMLInputElement | null) => {
      amountField.current = element;
      return assignRef(amountRef, element);
    },
    [amountRef],
  );

  const onChipPress = useCallback(() => {
    setChipPresses((presses) => presses + 1);
  }, []);

  return { amountFieldRef, onChipPress };
}
