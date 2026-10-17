import { createContext } from "react";

/**
 * Whether the contents are inside the kit's sheet. The library lifts a sheet above the keyboard only for an
 * input that tells the sheet it has focus, which is the library's own `BottomSheetTextInput`, so a field
 * inside a sheet draws that and anywhere else draws the plain input.
 */
export const IsInsideSheetContext = createContext(false);
