import { createContext } from "react";

/**
 * What the dim behind the sheet needs from the sheet, which gorhom draws it from outside: how to ask the
 * screen to close the sheet, and whether the sheet is still open, because the dim stays mounted while the
 * sheet exits and must not take a press then.
 */
export type SheetBackdropContextValue = {
  requestClose: () => void;
  isOpen: boolean;
};

export const SheetBackdropContext = createContext<SheetBackdropContextValue>({
  requestClose: () => undefined,
  isOpen: true,
});
