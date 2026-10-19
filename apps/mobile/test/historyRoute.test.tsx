import { KeyLowProvider } from "@keylow/api-client";
import { TRAIN_START_FAILED } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import HistoryRoute from "../app/(tabs)/train/history";
import TrainRoute from "../app/(tabs)/train/index";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import {
  goldenHistoryWeek,
  historyBackend,
  historyClient,
  resetHistoryBackend,
} from "./support/historyBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { trainBackend } from "./support/trainBackend";
import { goldenRoutine, mondayPush, tuesdayPull } from "./support/trainGoldenWeek";
import { resetTrainWrites, trainWrites } from "./support/trainWritesBackend";

import type { QueryClient } from "@tanstack/react-query";
import type { ReactElement } from "react";

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
// 11:20 in London on Thursday 15 October 2026, in the golden week.
jest.mock("../lib/useNow", () => {
  const mockNow = new Date("2026-10-15T10:20:00Z");

  return { useNow: () => mockNow };
});

setUpTests();

let queryClient: QueryClient;

async function renderRoute(route: ReactElement) {
  queryClient = createDiaryQueryClient();
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={historyClient} queryClient={queryClient}>
        <ToastProvider>{route}</ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return user;
}

describe("the history in the Train tab", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/TrainScreen",
      "components/TodayCard",
      "components/HistoryScreen",
      "components/SessionRow",
      "app",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetHistoryBackend();
    resetTrainWrites();
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("the History link on the Train home", () => {
    it("should open the history list when it is pressed", async () => {
      trainBackend.routine = goldenRoutine;
      const user = await renderRoute(<TrainRoute />);

      await user.press(await screen.findByRole("button", { name: "History" }));

      expect(routerMock.push).toHaveBeenCalledWith("/train/history");
    });

    it("should push the session's detail from a logged day of the week strip", async () => {
      trainBackend.routine = goldenRoutine;
      trainBackend.weekSessions = [mondayPush, tuesdayPull];
      const user = await renderRoute(<TrainRoute />);

      await user.press(
        await screen.findByRole("button", { name: /^Tuesday 13 October.*open session$/ }),
      );

      expect(routerMock.push).toHaveBeenCalledWith(
        `/train/history/${String(tuesdayPull["id"])}?from=train`,
      );
    });

    it("should be there for a user who has logged nothing too", async () => {
      await renderRoute(<TrainRoute />);

      expect(await screen.findByRole("button", { name: "History" })).toBeOnTheScreen();
    });
  });

  describe("the history route", () => {
    it("should list the weeks and go back to the previous screen from Back to Train", async () => {
      historyBackend.sessions = goldenHistoryWeek;
      const user = await renderRoute(<HistoryRoute />);

      expect(await screen.findByLabelText("This week · Mon 12 to Sun 18 Oct")).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Back to Train" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should push the session's detail from a row", async () => {
      historyBackend.sessions = goldenHistoryWeek;
      const user = await renderRoute(<HistoryRoute />);

      await user.press(await screen.findByRole("button", { name: /^Pull, Tue 13 October/ }));

      expect(routerMock.push).toHaveBeenCalledWith(
        `/train/history/${String(goldenHistoryWeek[1]?.["id"])}`,
      );
    });

    it("should go to the Train home when there is nothing to go back to", async () => {
      routerMock.canGoBack.mockReturnValue(false);
      historyBackend.sessions = goldenHistoryWeek;
      const user = await renderRoute(<HistoryRoute />);

      await user.press(await screen.findByRole("button", { name: "Back to Train" }));

      expect(routerMock.back).not.toHaveBeenCalled();
      expect(routerMock.replace).toHaveBeenCalledWith("/train");
    });

    it("should start a free session and open the session screen from Start a session", async () => {
      const user = await renderRoute(<HistoryRoute />);

      await user.press(await screen.findByRole("button", { name: "Start a session" }));

      await waitFor(() => {
        expect(routerMock.push).toHaveBeenCalledWith("/session");
      });
      expect(trainWrites.inserted).toHaveLength(1);
      expect(trainWrites.inserted[0]).toMatchObject({ routine_day_id: null, tz: "Europe/London" });
    });

    it("should show the start failed toast, open nothing and leave Start a session pressable when the start fails", async () => {
      trainWrites.failInserts = true;
      const user = await renderRoute(<HistoryRoute />);

      await user.press(await screen.findByRole("button", { name: "Start a session" }));

      expect(await screen.findByRole("status", { name: TRAIN_START_FAILED })).toBeOnTheScreen();
      expect(routerMock.push).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Start a session" })).toBeEnabled();
      });
    });

    it("should not start anything while offline", async () => {
      const user = await renderRoute(<HistoryRoute />);
      await screen.findByRole("button", { name: "Start a session" });

      await act(() => {
        onlineManager.setOnline(false);
      });
      await user.press(screen.getByRole("button", { name: "Start a session" }));

      expect(trainWrites.inserted).toHaveLength(0);
      expect(routerMock.push).not.toHaveBeenCalled();
    });
  });
});
