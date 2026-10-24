import { KeyLowProvider } from "@keylow/api-client";
import { skeletonDelay } from "@keylow/tokens";
import { act, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { ProgramScreen } from "../components/ProgramScreen";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient, diaryBackend, resetDiaryBackend } from "./support/diaryBackend";
import { resetRouterMock } from "./support/expoRouterMock";
import { programClient, resetProgramBackend } from "./support/programBackend";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

setUpTests();

// A skeleton is hidden from screen readers, so its drawing is found by id, and a query has to ask for hidden elements.
const hidden = { includeHiddenElements: true };

describe("the Programme screen while it loads (program: loading)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    resetRouterMock();
    resetDiaryBackend();
    resetProgramBackend();
    diaryBackend.hungTables.add("programs");
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function renderProgramScreen() {
    await render(
      <ThemeProvider fixedPreference="dark">
        <KeyLowProvider client={programClient} queryClient={createDiaryQueryClient()}>
          <ProgramScreen />
        </KeyLowProvider>
      </ThemeProvider>,
    );
  }

  it("should say what is loading in a status named Loading your programme", async () => {
    await renderProgramScreen();

    expect(screen.getByRole("status", { name: "Loading your programme" })).toBeOnTheScreen();
  });

  it("should draw the skeleton in the cards' shapes for nothing until 200 ms have passed", async () => {
    await renderProgramScreen();

    await act(() => {
      jest.advanceTimersByTime(skeletonDelay - 1);
    });

    expect(getAnimatedStyle(screen.getByTestId("skeleton", hidden)).opacity).toBe(0);
    expect(screen.getByTestId("skeleton-program", hidden)).toBeOnTheScreen();
  });

  it("should fade the skeleton in once 200 ms have passed", async () => {
    await renderProgramScreen();

    await act(() => {
      jest.advanceTimersByTime(skeletonDelay + 500);
    });

    expect(getAnimatedStyle(screen.getByTestId("skeleton", hidden)).opacity).toBe(1);
  });

  it("should keep the header with Back while it loads", async () => {
    await renderProgramScreen();

    expect(screen.getByRole("button", { name: "Back to More" })).toBeOnTheScreen();
  });
});
