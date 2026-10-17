import { render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BottomSheet, TextArea } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// The library lifts a sheet above the keyboard only for an input that reports its focus to the sheet,
// which is its own `BottomSheetTextInput`. This stands in for the library, so a test can see which input
// the kit's text area draws inside a sheet, and which props the kit gives the sheet for the keyboard.
// What the library does with them on a device is in its own tests and on the device.
const mockSheet: { props: Record<string, unknown> } = { props: {} };

jest.mock("@gorhom/bottom-sheet", () => {
  const { forwardRef } = jest.requireActual<typeof import("react")>("react");
  const { TextInput } = jest.requireActual<typeof import("react-native")>("react-native");
  const FakeSheet = forwardRef<unknown, { children: React.ReactNode }>(
    function FakeSheet(props, _ref) {
      mockSheet.props = props;
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
  };
});

const frame = { x: 0, y: 0, width: 390, height: 844 };
const insets = { top: 47, right: 0, bottom: 34, left: 0 };

function area() {
  return <TextArea label="Step 3 text" value="" onChangeText={() => undefined} />;
}

describe("TextArea and the sheet's keyboard", () => {
  it("should be the library's own input inside a bottom sheet, which is how the sheet is lifted above the keyboard", async () => {
    await render(
      <SafeAreaProvider initialMetrics={{ frame, insets }}>
        <ThemeProvider fixedPreference="dark">
          <BottomSheet open title="Step 3" onClose={() => undefined}>
            {area()}
          </BottomSheet>
        </ThemeProvider>
      </SafeAreaProvider>,
    );

    expect(screen.getByTestId("sheet-text-input")).toBe(screen.getByLabelText("Step 3 text"));
  });

  it("should be a plain input outside a sheet", async () => {
    await render(<ThemeProvider fixedPreference="dark">{area()}</ThemeProvider>);

    expect(screen.queryByTestId("sheet-text-input")).not.toBeOnTheScreen();
    expect(screen.getByLabelText("Step 3 text")).toBeOnTheScreen();
  });

  it("should still be a multi-line field named by its label inside a sheet", async () => {
    await render(
      <SafeAreaProvider initialMetrics={{ frame, insets }}>
        <ThemeProvider fixedPreference="dark">
          <BottomSheet open title="Step 3" onClose={() => undefined}>
            {area()}
          </BottomSheet>
        </ThemeProvider>
      </SafeAreaProvider>,
    );

    expect(screen.getByLabelText("Step 3 text")).toHaveProp("multiline", true);
  });

  it("should give the library's sheet the keyboard behaviour it needs: lifted with the keyboard, put back after it, and panned on Android", async () => {
    await render(
      <SafeAreaProvider initialMetrics={{ frame, insets }}>
        <ThemeProvider fixedPreference="dark">
          <BottomSheet open title="Step 3" onClose={() => undefined}>
            {area()}
          </BottomSheet>
        </ThemeProvider>
      </SafeAreaProvider>,
    );

    expect(mockSheet.props).toMatchObject({
      keyboardBehavior: "interactive",
      keyboardBlurBehavior: "restore",
      android_keyboardInputMode: "adjustPan",
    });
  });
});
