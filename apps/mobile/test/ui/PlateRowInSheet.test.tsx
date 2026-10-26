import { render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BottomSheet, PlateRow } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// The library lifts a sheet above the keyboard only for an input that reports its focus to the sheet,
// which is its own `BottomSheetTextInput`. This stands in for the library, so a test can see which input
// the kit's field draws inside a sheet. What the library does with it is in its own tests and on the device.
jest.mock("@gorhom/bottom-sheet", () => {
  const { forwardRef } = jest.requireActual<typeof import("react")>("react");
  const { TextInput } = jest.requireActual<typeof import("react-native")>("react-native");
  const FakeSheet = forwardRef<unknown, { children: React.ReactNode }>(
    function FakeSheet(props, _ref) {
      return props.children;
    },
  );
  const FakeSheetInput = forwardRef<never, object>(function FakeSheetInput(props, ref) {
    return <TextInput ref={ref} testID="sheet-text-input" {...props} />;
  });
  return {
    __esModule: true,
    default: FakeSheet,
    BottomSheetView: ({ children }: never) => children,
    BottomSheetTextInput: FakeSheetInput,
    BottomSheetScrollView: ({ children }: never) => children,
  };
});

const frame = { x: 0, y: 0, width: 390, height: 844 };
const insets = { top: 47, right: 0, bottom: 34, left: 0 };

describe("PlateRow in a bottom sheet", () => {
  it("should draw its amount as the sheet's own input, so the keyboard lifts the sheet", async () => {
    await render(
      <SafeAreaProvider initialMetrics={{ frame, insets }}>
        <ThemeProvider fixedPreference="dark">
          <BottomSheet open title="Your plate" onClose={() => undefined}>
            <PlateRow
              amountText="200"
              energy="92"
              macros={{ protein: "6.8", carbs: "9.6", fat: "3.2", description: "" }}
              name="Semi-skimmed milk"
              unitsWord="ml"
              unitWord="ml"
              onAmountChange={() => undefined}
              onOpen={() => undefined}
              onRemove={() => undefined}
            />
          </BottomSheet>
        </ThemeProvider>
      </SafeAreaProvider>,
    );

    const field = screen.getByLabelText("Amount of Semi-skimmed milk, ml");
    expect(field).toBe(screen.getByTestId("sheet-text-input"));
    expect(field).toHaveProp("selectTextOnFocus", true);
  });
});
