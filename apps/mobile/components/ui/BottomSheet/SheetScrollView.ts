import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { cssInterop } from "nativewind";

// The library's scroll view is its own component, so its classes are mapped to styles as the plain scroll
// view's are. A list inside a sheet scrolls in this one, so the sheet's drag and the list's scroll do not fight.
cssInterop(BottomSheetScrollView, {
  className: "style",
  contentContainerClassName: "contentContainerStyle",
});

export { BottomSheetScrollView as SheetScrollView };
