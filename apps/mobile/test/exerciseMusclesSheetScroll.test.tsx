import { KeyLowProvider } from "@keylow/api-client";
import { EXERCISE_MUSCLES } from "@keylow/core/copy";
import { cleanup, render, screen, within } from "@testing-library/react-native";
import { ScrollView } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { ExerciseMusclesSheet } from "../components/ExerciseMusclesSheet";
import { BottomSheet } from "../components/ui";
import { resetBodyFigureForTests } from "../lib/bodyFigure/testing";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { formMediaClient, resetFormMediaBackend } from "./support/formMediaBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resetTrainBackend } from "./support/trainBackend";

import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
// An iPhone SE: 20 points of status bar and no home indicator.
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }),
}));

// Stands in for gorhom so a test can read what the sheet asks of it, and see what is in its scroll view.
const mockSheet: { topInset: number | undefined; enableDynamicSizing: boolean | undefined } = {
  topInset: undefined,
  enableDynamicSizing: undefined,
};
jest.mock("@gorhom/bottom-sheet", () => {
  const { forwardRef, useImperativeHandle } = jest.requireActual<typeof import("react")>("react");
  const FakeSheet = forwardRef<
    unknown,
    { children: React.ReactNode; topInset: number; enableDynamicSizing: boolean }
  >(function FakeSheet({ children, topInset, enableDynamicSizing }, ref) {
    mockSheet.topInset = topInset;
    mockSheet.enableDynamicSizing = enableDynamicSizing;
    useImperativeHandle(ref, () => ({ close: () => undefined, snapToIndex: () => undefined }));
    return children;
  });
  const { ScrollView: PlainScrollView } =
    jest.requireActual<typeof import("react-native")>("react-native");
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  return {
    __esModule: true,
    default: FakeSheet,
    BottomSheetView: ({ children }: never) => children,
    BottomSheetTextInput: () => null,
    BottomSheetScrollView: ({ children }: { children: React.ReactNode }) =>
      createElement(PlainScrollView, { "aria-label": "Sheet scroll view" }, children),
  };
});

setUpTests();

const SQUAT_ID = "00000000-0000-4000-8000-000000000b01";
const squat = {
  id: SQUAT_ID,
  name: "Barbell back squat",
  muscles: [{ muscle_id: "quads", role: "primary", weight: 1 }],
} as const;

let queryClient: QueryClient;

const scrollView = () => screen.getByLabelText("Sheet scroll view");

describe("a sheet taller than the screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/ExerciseMusclesSheet"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetTrainBackend();
    resetFormMediaBackend();
    resetBodyFigureForTests();
    queryClient = createDiaryQueryClient();
    mockSheet.topInset = undefined;
    mockSheet.enableDynamicSizing = undefined;
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
  });

  describe("the Muscles it works sheet", () => {
    beforeEach(async () => {
      await render(
        <ThemeProvider fixedPreference="dark">
          <KeyLowProvider client={formMediaClient} queryClient={queryClient}>
            <ExerciseMusclesSheet exercise={squat} onClose={jest.fn()} />
          </KeyLowProvider>
        </ThemeProvider>,
      );
    });

    it("should hold its contents in a scroll view, so the rows below the cut can be reached", () => {
      expect(
        within(scrollView()).getByRole("heading", { name: "Barbell back squat" }),
      ).toBeOnTheScreen();
      expect(within(scrollView()).getByText(EXERCISE_MUSCLES.explanation)).toBeOnTheScreen();
    });

    it("should stop below the status bar", () => {
      expect(mockSheet.topInset).toBe(20);
    });

    it("should still size itself to its contents when they fit", () => {
      expect(mockSheet.enableDynamicSizing).toBe(true);
    });
  });

  describe("a sheet that is not scrollable", () => {
    it("should keep its contents out of a scroll view and take no top inset", async () => {
      await render(
        <ThemeProvider fixedPreference="dark">
          <BottomSheet label="Plain" open onClose={jest.fn()}>
            <ScrollView aria-label="Its own list" />
          </BottomSheet>
        </ThemeProvider>,
      );

      expect(screen.queryByLabelText("Sheet scroll view")).not.toBeOnTheScreen();
      expect(mockSheet.topInset).toBe(0);
    });
  });
});
