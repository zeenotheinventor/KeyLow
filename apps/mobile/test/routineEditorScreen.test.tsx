import "react-native-gesture-handler/jestSetup";

import { KeyLowProvider } from "@keylow/api-client";
import {
  GENERIC_ERROR,
  RETRY_LABEL,
  ROUTINE_EDITOR,
  ROUTINE_EDITOR_LOADING_LABEL,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { RoutineEditorScreen } from "../components/RoutineEditorScreen";
import { ToastProvider } from "../components/ui";
import { routinesPath } from "../lib/routineRoutes";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient, resetDiaryBackend } from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  resetRoutineDetailBackend,
  routineDetailBackend,
  routineDetailClient,
} from "./support/routineDetailBackend";
import { pushPullLegsDraft } from "./support/routineEditorFixtures";

import type { QueryClient } from "@tanstack/react-query";

// The edit routine screen, with the real hook over a fake database: what it shows once the routine has
// loaded, and what it does for a routine that is not there or cannot be read.

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

async function showScreen(id: string) {
  queryClient = createDiaryQueryClient();
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={routineDetailClient} queryClient={queryClient}>
        <ToastProvider>
          <RoutineEditorScreen id={id} />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return user;
}

describe("the edit routine screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RoutineEditorScreen",
      "components/RoutineEditor",
      "components/RoutineDayCard",
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

  it("should open the routine it was given, with its days and the sets of the week", async () => {
    routineDetailBackend.routines.set(ROUTINE_ID, pushPullLegsDraft);
    await showScreen(ROUTINE_ID);

    expect(await screen.findByLabelText(ROUTINE_EDITOR.nameLabel)).toHaveDisplayValue(
      "Push Pull Legs",
    );
    expect(screen.getByRole("heading", { name: ROUTINE_EDITOR.title })).toBeOnTheScreen();
    expect(screen.getByText("Pull")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Weekday for Legs: Thursday" })).toBeOnTheScreen();
    expect(screen.getByText("4 of 7 · 63 sets a week")).toBeOnTheScreen();
    expect(routineDetailBackend.reads).toStrictEqual([ROUTINE_ID]);
  });

  it("should show Cancel editing and a loading status while the routine loads", async () => {
    routineDetailBackend.routines.set(ROUTINE_ID, pushPullLegsDraft);
    await showScreen(ROUTINE_ID);

    expect(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelLabel })).toBeOnTheScreen();
    expect(screen.getByRole("status", { name: ROUTINE_EDITOR_LOADING_LABEL })).toBeOnTheScreen();
    expect(screen.queryByLabelText(ROUTINE_EDITOR.nameLabel)).not.toBeOnTheScreen();
    expect(screen.queryByText(GENERIC_ERROR)).not.toBeOnTheScreen();
    await screen.findByLabelText(ROUTINE_EDITOR.nameLabel);
    expect(
      screen.queryByRole("status", { name: ROUTINE_EDITOR_LOADING_LABEL }),
    ).not.toBeOnTheScreen();
  });

  it("should go to the routines list when there is no such routine", async () => {
    await showScreen(ROUTINE_ID);

    await waitFor(() => {
      expect(routerMock.dismissTo).toHaveBeenCalledWith(routinesPath());
    });
    expect(screen.queryByLabelText(ROUTINE_EDITOR.nameLabel)).not.toBeOnTheScreen();
  });

  it("should go to the routines list for an address that is not a routine's id, asking nothing", async () => {
    await showScreen("archived-routines");

    await waitFor(() => {
      expect(routerMock.dismissTo).toHaveBeenCalledWith(routinesPath());
    });
    expect(routineDetailBackend.reads).toStrictEqual([]);
  });

  it("should say it could not load the routine, and try again", async () => {
    routineDetailBackend.routines.set(ROUTINE_ID, pushPullLegsDraft);
    routineDetailBackend.fails = true;
    const user = await showScreen(ROUTINE_ID);
    expect(await screen.findByText(GENERIC_ERROR)).toBeOnTheScreen();
    expect(routerMock.dismissTo).not.toHaveBeenCalled();

    routineDetailBackend.fails = false;
    await user.press(screen.getByRole("button", { name: RETRY_LABEL }));

    expect(await screen.findByLabelText(ROUTINE_EDITOR.nameLabel)).toHaveDisplayValue(
      "Push Pull Legs",
    );
  });

  it("should go back from the error with Cancel editing", async () => {
    routineDetailBackend.fails = true;
    const user = await showScreen(ROUTINE_ID);
    await screen.findByText(GENERIC_ERROR);

    await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelLabel }));

    expect(routerMock.back).toHaveBeenCalledTimes(1);
  });
});
