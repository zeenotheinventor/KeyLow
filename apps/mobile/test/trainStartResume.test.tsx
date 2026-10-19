import { KeyLowProvider } from "@keylow/api-client";
import { TRAIN_FIRST_TIME, TRAIN_NO_ROUTINE, TRAIN_START_FAILED } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import TrainRoute from "../app/(tabs)/train";
import { SessionScreen } from "../components/SessionScreen";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { goldenLegsOpen, legsRoutine } from "./support/sessionGoldenLegs";
import { resetTrainBackend, trainBackend, loggedSession } from "./support/trainBackend";
import {
  goldenRoutine,
  LEGS_ID,
  mondayPush,
  thursdayLegsActive,
  thursdayLegsInTheWeek,
  tuesdayPull,
} from "./support/trainGoldenWeek";
import {
  resetTrainWrites,
  STARTED_SESSION_ID,
  trainWrites,
  trainWritesClient,
} from "./support/trainWritesBackend";

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

// The clock the screen reads. The golden Thursday at 17:55 in London, before Legs.
let mockNow = new Date("2026-10-15T16:55:00Z");
jest.mock("../lib/useNow", () => ({ useNow: () => mockNow }));

setUpTests();

let queryClient: QueryClient;

async function renderRoute() {
  queryClient = createDiaryQueryClient();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={trainWritesClient} queryClient={queryClient}>
        <ToastProvider>
          <TrainRoute />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

// Moves the date a start reads at the press to the golden Thursday and leaves every timer running.
const ONLY_THE_DATE = [
  "hrtime",
  "nextTick",
  "performance",
  "queueMicrotask",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "requestIdleCallback",
  "cancelIdleCallback",
  "setImmediate",
  "clearImmediate",
  "setInterval",
  "clearInterval",
  "setTimeout",
  "clearTimeout",
] as const;

const goOffline = () =>
  act(() => {
    onlineManager.setOnline(false);
  });

describe("starting, resuming and logging a session from the Train tab", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/TrainScreen",
      "components/TodayCard",
      "app",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetTrainBackend();
    resetTrainWrites();
    mockNow = new Date("2026-10-15T16:55:00Z");
    jest.useFakeTimers({ now: mockNow, doNotFake: [...ONLY_THE_DATE] });
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("on the golden Thursday before Legs", () => {
    beforeEach(() => {
      trainBackend.routine = goldenRoutine;
      trainBackend.weekSessions = [mondayPush, tuesdayPull];
    });

    it("should start a session on the Legs day for today in the profile's zone and open the session screen", async () => {
      const user = userEvent.setup();
      await renderRoute();

      await user.press(await screen.findByRole("button", { name: "Start Legs" }));

      await waitFor(() => {
        expect(routerMock.push).toHaveBeenCalledWith("/session");
      });
      expect(trainWrites.inserted).toHaveLength(1);
      expect(trainWrites.inserted[0]).toMatchObject({
        routine_day_id: LEGS_ID,
        local_date: "2026-10-15",
        tz: "Europe/London",
      });
    });

    it("should make one start, not two, when Start is pressed twice", async () => {
      let release: () => void = () => undefined;
      trainWrites.holdInserts = new Promise((resolve) => {
        release = resolve;
      });
      const user = userEvent.setup();
      await renderRoute();
      const start = await screen.findByRole("button", { name: "Start Legs" });

      await user.press(start);
      await act(() => {
        jest.setSystemTime(new Date("2026-10-15T16:55:01Z"));
      });
      await user.press(start);
      await act(() => {
        release();
      });

      await waitFor(() => {
        expect(routerMock.push).toHaveBeenCalledTimes(1);
      });
      expect(trainWrites.inserted).toHaveLength(1);
      expect(trainBackend.activeSession).toMatchObject({ id: STARTED_SESSION_ID });
      // Only this count tells a second start: it would find the first one's session and resolve to it, so the
      // insert and the push look the same either way.
      expect(queryClient.getMutationCache().getAll()).toHaveLength(1);
    });

    it("should show an error toast that states the rule, open nothing and let Start be pressed again when the start fails", async () => {
      trainWrites.failInserts = true;
      const user = userEvent.setup();
      await renderRoute();

      await user.press(await screen.findByRole("button", { name: "Start Legs" }));

      expect(await screen.findByRole("status", { name: TRAIN_START_FAILED })).toBeOnTheScreen();
      expect(routerMock.push).not.toHaveBeenCalled();

      trainWrites.failInserts = false;
      await user.press(screen.getByRole("button", { name: "Start Legs" }));
      await waitFor(() => {
        expect(routerMock.push).toHaveBeenCalledTimes(1);
      });
    });

    it("should show Start as busy and stop it responding while the start is under way", async () => {
      let release: () => void = () => undefined;
      trainWrites.holdInserts = new Promise((resolve) => {
        release = resolve;
      });
      const user = userEvent.setup();
      await renderRoute();

      await user.press(await screen.findByRole("button", { name: "Start Legs" }));

      expect(
        await screen.findByRole("button", { name: /Start Legs/, busy: true }),
      ).toBeOnTheScreen();
      await act(() => {
        release();
      });
      await waitFor(() => {
        expect(routerMock.push).toHaveBeenCalledTimes(1);
      });
      expect(
        screen.queryByRole("button", { name: /Start Legs/, busy: true }),
      ).not.toBeOnTheScreen();
    });

    it("should not start anything, and dim Start, while offline", async () => {
      const user = userEvent.setup();
      await renderRoute();
      await screen.findByRole("button", { name: "Start Legs" });

      await goOffline();
      await user.press(screen.getByRole("button", { name: "Start Legs" }));

      expect(screen.getByRole("button", { name: "Start Legs" })).toBeDisabled();
      expect(trainWrites.inserted).toHaveLength(0);
      expect(routerMock.push).not.toHaveBeenCalled();
    });
  });

  describe("on the golden Thursday with Legs open", () => {
    beforeEach(() => {
      mockNow = new Date("2026-10-15T18:00:00Z");
      trainBackend.routine = goldenRoutine;
      trainBackend.weekSessions = [mondayPush, tuesdayPull, thursdayLegsInTheWeek(null)];
      trainBackend.activeSession = thursdayLegsActive;
    });

    it("should open the session in progress and start no new one when Resume is pressed", async () => {
      const user = userEvent.setup();
      await renderRoute();
      const resume = await screen.findByRole("button", { name: "Resume Legs" });
      const readsBefore = trainBackend.requests.length;

      await user.press(resume);

      expect(routerMock.push).toHaveBeenCalledWith("/session");
      // Resume only opens the screen: it asks the database for nothing, and so starts nothing.
      expect(trainBackend.requests).toHaveLength(readsBefore);
      expect(trainWrites.inserted).toHaveLength(0);
      expect(trainBackend.activeSession).toBe(thursdayLegsActive);
    });

    it("should open the session screen once when Resume is pressed twice", async () => {
      const user = userEvent.setup();
      await renderRoute();
      const resume = await screen.findByRole("button", { name: "Resume Legs" });

      await user.press(resume);
      await user.press(resume);

      expect(routerMock.push).toHaveBeenCalledTimes(1);
    });
  });

  describe("on the golden Thursday with Legs open, discarded from the session screen", () => {
    it("should take the Train card from Resume Legs back to Start Legs", async () => {
      mockNow = new Date("2026-10-15T18:00:00Z");
      // The session screen's own Legs fixtures, since both screens read the one database.
      trainBackend.routine = legsRoutine;
      trainBackend.weekSessions = [goldenLegsOpen()];
      trainBackend.activeSession = goldenLegsOpen();
      queryClient = createDiaryQueryClient();
      const user = userEvent.setup();
      await render(
        <ThemeProvider fixedPreference="dark">
          <KeyLowProvider client={trainWritesClient} queryClient={queryClient}>
            <ToastProvider>
              <TrainRoute />
              <SessionScreen onDiscarded={jest.fn()} onFinished={jest.fn()} onHide={jest.fn()} />
            </ToastProvider>
          </KeyLowProvider>
        </ThemeProvider>,
      );
      await screen.findByRole("button", { name: "Resume Legs" });

      await user.press(await screen.findByRole("button", { name: "More" }));
      await user.press(await screen.findByRole("button", { name: "Discard session" }));
      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: "Discard session" })).toHaveLength(1);
      });
      await user.press(screen.getByRole("button", { name: "Discard session" }));

      expect(await screen.findByRole("button", { name: "Start Legs" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Resume Legs" })).not.toBeOnTheScreen();
    });
  });

  describe("with no routine", () => {
    it("should start a free session with no routine day from Log a session on the first visit", async () => {
      const user = userEvent.setup();
      await renderRoute();

      await user.press(await screen.findByRole("button", { name: TRAIN_FIRST_TIME.logAction }));

      await waitFor(() => {
        expect(routerMock.push).toHaveBeenCalledWith("/session");
      });
      expect(trainWrites.inserted).toHaveLength(1);
      expect(trainWrites.inserted[0]).toMatchObject({
        routine_day_id: null,
        local_date: "2026-10-15",
        tz: "Europe/London",
      });
    });

    it("should start a free session from Log a session anyway once a session has been logged", async () => {
      trainBackend.sessions = [loggedSession];
      const user = userEvent.setup();
      await renderRoute();

      await user.press(await screen.findByRole("button", { name: TRAIN_NO_ROUTINE.logAction }));

      await waitFor(() => {
        expect(routerMock.push).toHaveBeenCalledWith("/session");
      });
      expect(trainWrites.inserted[0]).toMatchObject({ routine_day_id: null });
    });

    it("should dim Log a session and start nothing while offline", async () => {
      const user = userEvent.setup();
      await renderRoute();
      await screen.findByRole("button", { name: TRAIN_FIRST_TIME.logAction });

      await goOffline();
      await user.press(screen.getByRole("button", { name: TRAIN_FIRST_TIME.logAction }));

      expect(screen.getByRole("button", { name: TRAIN_FIRST_TIME.logAction })).toBeDisabled();
      expect(trainWrites.inserted).toHaveLength(0);
      expect(routerMock.push).not.toHaveBeenCalled();
    });

    it("should show the error toast when the free session does not start", async () => {
      trainWrites.failInserts = true;
      const user = userEvent.setup();
      await renderRoute();

      await user.press(await screen.findByRole("button", { name: TRAIN_FIRST_TIME.logAction }));

      expect(await screen.findByRole("status", { name: TRAIN_START_FAILED })).toBeOnTheScreen();
      expect(routerMock.push).not.toHaveBeenCalled();
    });
  });
});
