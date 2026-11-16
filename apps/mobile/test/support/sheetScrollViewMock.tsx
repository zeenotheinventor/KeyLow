import { forwardRef, useImperativeHandle } from "react";
import { ScrollView } from "react-native";

import type { ScrollViewProps } from "react-native";

/**
 * The library's bottom sheet with its scroll view swapped for the plain one. Jest does not turn the library's
 * scroll handlers into worklets, so its own scroll view cannot render here. How the library drags a sheet with
 * it is on the device. A test mocks the module with
 * `jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("../support/sheetScrollViewMock").mockBottomSheet())`.
 * A test that checks where the thread scrolls passes `onScrollToEnd`, which the scroll view's ref then calls for `scrollToEnd`,
 * and may pass `onScrollViewProps` to see the props the scroll view was last rendered with.
 */
export function mockBottomSheet(
  onScrollToEnd?: () => void,
  onScrollViewProps?: (props: ScrollViewProps) => void,
) {
  const actual = jest.requireActual<typeof import("@gorhom/bottom-sheet")>("@gorhom/bottom-sheet");

  return {
    __esModule: true,
    default: actual.default,
    BottomSheetView: actual.BottomSheetView,
    BottomSheetTextInput: actual.BottomSheetTextInput,
    BottomSheetBackdrop: actual.BottomSheetBackdrop,
    BottomSheetScrollView:
      onScrollToEnd === undefined
        ? forwardRef<never, object>(function PlainSheetScrollView(props, ref) {
            return <ScrollView ref={ref} {...props} />;
          })
        : forwardRef<{ scrollToEnd: () => void }, ScrollViewProps>(
            function WatchedSheetScrollView(props, ref) {
              useImperativeHandle(ref, () => ({ scrollToEnd: onScrollToEnd }), []);
              onScrollViewProps?.(props);
              return <ScrollView {...props} />;
            },
          ),
  };
}
