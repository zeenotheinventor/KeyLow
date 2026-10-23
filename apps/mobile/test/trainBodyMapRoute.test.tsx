import { KeyLowProvider } from "@keylow/api-client";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import TrainRoute from "../app/(tabs)/train/index";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resetTrainBackend, trainBackend, trainClient } from "./support/trainBackend";
import { goldenRoutine, mondayPush, tuesdayPull } from "./support/trainGoldenWeek";

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

describe("the body map card on the Train route", () => {
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
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetTrainBackend();
    trainBackend.routine = goldenRoutine;
    trainBackend.weekSessions = [mondayPush, tuesdayPull];
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  it("should push the body map with the Train home as its origin, so its Back reads Back to Train", async () => {
    queryClient = createDiaryQueryClient();
    const user = userEvent.setup();
    await render(
      <ThemeProvider fixedPreference="dark">
        <KeyLowProvider client={trainClient} queryClient={queryClient}>
          <ToastProvider>
            <TrainRoute />
          </ToastProvider>
        </KeyLowProvider>
      </ThemeProvider>,
    );

    await user.press(await screen.findByRole("button", { name: "Open body map" }));

    expect(routerMock.push).toHaveBeenCalledWith("/body-map?from=train");
  });
});
