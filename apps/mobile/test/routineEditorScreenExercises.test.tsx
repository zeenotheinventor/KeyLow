import "react-native-gesture-handler/jestSetup";

import { KeyLowProvider } from "@keylow/api-client";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { RoutineEditorScreen } from "../components/RoutineEditorScreen";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient, resetDiaryBackend } from "./support/diaryBackend";
import { resetRouterMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  resetRoutineDetailBackend,
  routineDetailBackend,
  routineDetailClient,
} from "./support/routineDetailBackend";
import { pushPullLegsDraft } from "./support/routineEditorFixtures";

import type { QueryClient } from "@tanstack/react-query";

// The stored routine's exercise names reach the editor's rows: the draft holds ids, the read holds names.

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
jest.mock("expo-router/react-navigation", () => ({ usePreventRemove: () => undefined }));

setUpTests();

const ROUTINE_ID = "55555555-5555-4555-8555-555555555555";

let queryClient: QueryClient;

describe("the edit routine screen's exercises", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RoutineEditorScreen",
      "components/RoutineEditor",
      "components/RoutineDayCard",
      "components/RoutineDayExercises",
      "components/RoutineExerciseRow",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetDiaryBackend();
    resetRoutineDetailBackend();
    resetRouterMock();
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  it("should name each exercise's row and fields after the exercise the read joined to it", async () => {
    routineDetailBackend.routines.set(ROUTINE_ID, pushPullLegsDraft);
    queryClient = createDiaryQueryClient();
    const user = userEvent.setup();
    await render(
      <ThemeProvider fixedPreference="dark">
        <KeyLowProvider client={routineDetailClient} queryClient={queryClient}>
          <RoutineEditorScreen id={ROUTINE_ID} />
        </KeyLowProvider>
      </ThemeProvider>,
    );

    const [showPull] = await screen.findAllByRole("button", { name: "Show Pull exercises" });
    if (showPull === undefined) {
      throw new Error("There is no Show button for Pull");
    }
    await user.press(showPull);

    expect(screen.getAllByText("An exercise")).toHaveLength(5);
    expect(screen.getAllByLabelText("Sets for An exercise")).toHaveLength(5);
    expect(screen.getAllByRole("button", { name: "Remove An exercise" })).toHaveLength(5);
  });
});
