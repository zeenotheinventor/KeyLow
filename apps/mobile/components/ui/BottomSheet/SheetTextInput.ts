import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { cssInterop } from "nativewind";

// The library's input is its own component, so its classes are mapped to a style as the plain input's are.
// This is the one place it is done, for every field that draws the library's input inside a sheet.
cssInterop(BottomSheetTextInput, { className: "style" });

export { BottomSheetTextInput as SheetTextInput };
