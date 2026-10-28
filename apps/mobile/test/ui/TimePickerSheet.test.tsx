import { render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { TimePicker } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// Stands in for gorhom so a test can see how the picker opens its sheet. Jest cannot play two gestures
// competing for a drag, so this pins the sheet's setting, and the wheels scrolling on a device is Zee's check.
const mockSheet: { canDragFromContent: boolean | undefined } = { canDragFromContent: undefined };

jest.mock("@gorhom/bottom-sheet", () => {
  const { forwardRef, useImperativeHandle } = jest.requireActual<typeof import("react")>("react");
  const FakeSheet = forwardRef<
    unknown,
    { children: React.ReactNode; enableContentPanningGesture: boolean }
  >(function FakeSheet({ children, enableContentPanningGesture }, ref) {
    mockSheet.canDragFromContent = enableContentPanningGesture;
    useImperativeHandle(ref, () => ({ close: () => undefined, snapToIndex: () => undefined }));
    return children;
  });
  return {
    __esModule: true,
    default: FakeSheet,
    BottomSheetView: ({ children }: never) => children,
    BottomSheetTextInput: () => null,
    BottomSheetScrollView: ({ children }: never) => children,
  };
});

const frame = { x: 0, y: 0, width: 390, height: 844 };
const insets = { top: 47, right: 0, bottom: 34, left: 0 };

describe("TimePicker sheet", () => {
  it("should leave drags on the wheels to the wheels by opening its sheet without content dragging", async () => {
    await render(
      <SafeAreaProvider initialMetrics={{ frame, insets }}>
        <ThemeProvider fixedPreference="dark">
          <TimePicker open value="12:40" onChange={() => undefined} onClose={() => undefined} />
        </ThemeProvider>
      </SafeAreaProvider>,
    );

    expect(mockSheet.canDragFromContent).toBe(false);
  });
});
