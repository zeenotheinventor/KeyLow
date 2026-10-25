import { useEffect, useRef, useState } from "react";

import type { TextInput } from "react-native";

/**
 * Moves the cursor into the amount field, with its whole value selected, each time a unit chip is pressed, so
 * the next keystroke replaces the number. The chip may have changed the amount in the same press (it starts at
 * its own), so the selection waits for the render that shows the new value. Opening the picker, or a refresh
 * that reselects the unit, is not a press and leaves focus where it is. Give `amountRef` to the amount's
 * `NumericInput` as `inputRef` and `onChipPress` to the unit's `ChipGroup`.
 */
export function useSelectAmountOnChipPress(amount: string) {
  const amountRef = useRef<TextInput>(null);
  const [pressCount, setPressCount] = useState(0);
  const handledPressCount = useRef(0);

  useEffect(() => {
    if (pressCount === handledPressCount.current) {
      return;
    }
    handledPressCount.current = pressCount;
    amountRef.current?.focus();
    amountRef.current?.setSelection(0, amount.length);
  }, [pressCount, amount]);

  return {
    amountRef,
    onChipPress: () => {
      setPressCount((count) => count + 1);
    },
  };
}
