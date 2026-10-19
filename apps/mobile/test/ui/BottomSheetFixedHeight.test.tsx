import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BottomSheet } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";

import type { BottomSheetProps } from "../../components/ui";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// This stands in for the library's sheet, so a test can see which sizing props the kit gives it. How the
// library sizes a sheet from them is in its own tests and on the device.
const mockSheet: { props: Record<string, unknown> } = { props: {} };

jest.mock("@gorhom/bottom-sheet", () => {
  const { forwardRef } = jest.requireActual<typeof import("react")>("react");
  const FakeSheet = forwardRef<unknown, { children: React.ReactNode }>(
    function FakeSheet(props, _ref) {
      mockSheet.props = props;
      return props.children;
    },
  );
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

function renderSheet(props: Partial<BottomSheetProps> = {}) {
  return render(
    <SafeAreaProvider initialMetrics={{ frame, insets }}>
      <ThemeProvider fixedPreference="dark">
        <BottomSheet open title="Add exercise" onClose={() => undefined} {...props}>
          <Text>Contents</Text>
        </BottomSheet>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe("BottomSheet with snap points", () => {
  it("should be as tall as its snap point and not size itself to its contents", async () => {
    await renderSheet({ snapPoints: ["94%"] });

    expect(mockSheet.props["snapPoints"]).toStrictEqual(["94%"]);
    expect(mockSheet.props["enableDynamicSizing"]).toBe(false);
    expect(screen.getByText("Contents")).toBeOnTheScreen();
  });

  it("should still size itself to its contents when it has none", async () => {
    await renderSheet();

    expect(mockSheet.props["snapPoints"]).toBeUndefined();
    expect(mockSheet.props["enableDynamicSizing"]).toBe(true);
  });
});
