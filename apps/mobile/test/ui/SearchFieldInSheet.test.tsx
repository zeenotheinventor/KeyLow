import { render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BottomSheet, SearchField } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// The library lifts a sheet above the keyboard only for an input that reports its focus to the sheet,
// which is its own `BottomSheetTextInput`. This stands in for the library, so a test can see which input
// the kit's search field draws inside a sheet. What the library does with it is on the device.
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

const field = (
  <SearchField
    label="Search exercises"
    placeholder="Search exercises"
    placement="inline"
    value="raise"
    onChangeText={() => undefined}
  />
);

describe("SearchField and the sheet's keyboard", () => {
  it("should be the library's own input inside a bottom sheet, which is how the sheet is lifted above the keyboard", async () => {
    await render(
      <SafeAreaProvider initialMetrics={{ frame, insets }}>
        <ThemeProvider fixedPreference="dark">
          <BottomSheet open title="Add exercise" onClose={() => undefined}>
            {field}
          </BottomSheet>
        </ThemeProvider>
      </SafeAreaProvider>,
    );

    expect(screen.getByTestId("sheet-text-input")).toBe(
      screen.getByRole("searchbox", { name: "Search exercises" }),
    );
  });

  it("should be a plain input outside a sheet", async () => {
    await render(<ThemeProvider fixedPreference="dark">{field}</ThemeProvider>);

    expect(screen.queryByTestId("sheet-text-input")).not.toBeOnTheScreen();
    expect(screen.getByRole("searchbox", { name: "Search exercises" })).toHaveDisplayValue("raise");
  });
});
