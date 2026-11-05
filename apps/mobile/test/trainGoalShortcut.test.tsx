import { KeyLowProvider, keys } from "@keylow/api-client";
import { TRAIN_FIRST_TIME } from "@keylow/core/copy";
import { cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import TrainRoute from "../app/(tabs)/train/index";
import { ToastProvider } from "../components/ui";
import { goalPath, goalQuestionPath } from "../lib/goalRoutes";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient, diaryBackend } from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resetTrainBackend, trainClient } from "./support/trainBackend";
import { storedGoalRow } from "./support/trainingGoalsRead";
import { installVirtualClock } from "./support/virtualClock";

import type { QueryClient } from "@tanstack/react-query";

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
// 17:55 in London on Thursday 15 October 2026, in the golden week.
jest.mock("../lib/useNow", () => {
  const mockNow = new Date("2026-10-15T16:55:00Z");

  return { useNow: () => mockNow };
});

setUpTests();

let queryClient: QueryClient;

async function openFirstTimeCard() {
  queryClient = createDiaryQueryClient();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={trainClient} queryClient={queryClient}>
        <ToastProvider>
          <TrainRoute />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return screen.findByRole("button", { name: TRAIN_FIRST_TIME.goalAction });
}

describe("the Set your goal button on the Train first-time card", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/TrainScreen",
      "components/TodayCard",
      "components/PlanWeekStrip",
      "components/DashboardScreen",
      "components/ViewLabel",
      "app",
    ]);
  });

  beforeEach(() => {
    installVirtualClock();
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetTrainBackend();
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
    jest.useRealTimers();
  });

  it("should open the questionnaire at its first question when there is no goal yet", async () => {
    const button = await openFirstTimeCard();

    await userEvent.setup().press(button);

    expect(routerMock.push).toHaveBeenCalledTimes(1);
    expect(routerMock.push).toHaveBeenCalledWith(goalQuestionPath(1));
  });

  it("should open the Goal screen when a goal exists", async () => {
    diaryBackend.trainingGoals = [storedGoalRow];
    const button = await openFirstTimeCard();
    await waitFor(() => {
      expect(queryClient.getQueryData(keys.training.goals)).toEqual(storedGoalRow);
    });

    await userEvent.setup().press(button);

    expect(routerMock.push).toHaveBeenCalledTimes(1);
    expect(routerMock.push).toHaveBeenCalledWith(goalPath());
  });

  it("should open only once when it is pressed twice", async () => {
    const button = await openFirstTimeCard();
    const user = userEvent.setup();

    await user.press(button);
    await user.press(button);

    expect(routerMock.push).toHaveBeenCalledTimes(1);
  });
});
