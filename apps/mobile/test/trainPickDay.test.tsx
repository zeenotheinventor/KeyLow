import { KeyLowProvider } from "@keylow/api-client";
import { TRAIN_PICK_DAY, TRAIN_START_FAILED } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import TrainRoute from "../app/(tabs)/train";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { pressInTheSameMoment, pressTwiceInTheSameMoment } from "./support/sameTickPress";
import { resetTrainBackend, trainBackend } from "./support/trainBackend";
import {
  goldenRoutine,
  mondayPush,
  PULL_ID,
  thursdayLegsActive,
  thursdayLegsInTheWeek,
  tuesdayPull,
} from "./support/trainGoldenWeek";
import { resetTrainWrites, trainWrites, trainWritesClient } from "./support/trainWritesBackend";

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
// Jest does not turn the library's scroll handlers into worklets, so its scroll view cannot render here. The
// plain scroll view stands in for it, as the Add exercise sheet's own tests have it.
jest.mock("@gorhom/bottom-sheet", () => {
  const { forwardRef } = jest.requireActual<typeof import("react")>("react");
  const { ScrollView } = jest.requireActual<typeof import("react-native")>("react-native");
  const actual = jest.requireActual<typeof import("@gorhom/bottom-sheet")>("@gorhom/bottom-sheet");
  return {
    __esModule: true,
    default: actual.default,
    BottomSheetView: actual.BottomSheetView,
    BottomSheetTextInput: actual.BottomSheetTextInput,
    BottomSheetBackdrop: actual.BottomSheetBackdrop,
    BottomSheetScrollView: forwardRef<never, object>(function FakeSheetScrollView(props, ref) {
      return <ScrollView ref={ref} {...props} />;
    }),
  };
});

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

const PULL_ROW = "Pull, 1 exercise · 3 sets, Tuesday";
const LEGS_ROW = "Legs, 5 exercises · 16 sets, Thursday";

const goOffline = () =>
  act(() => {
    onlineManager.setOnline(false);
  });

describe("Pick day on the Train tab", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/TrainScreen",
      "components/TodayCard",
      "components/PickDaySheet",
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
    trainBackend.routine = goldenRoutine;
    trainBackend.weekSessions = [mondayPush, tuesdayPull];
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
    it("should draw Pick day with Start Legs, and open a sheet that lists every routine day in order", async () => {
      const user = userEvent.setup();
      await renderRoute();
      expect(await screen.findByRole("button", { name: "Start Legs" })).toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: TRAIN_PICK_DAY.action }));
      expect(
        await screen.findByRole("heading", { name: TRAIN_PICK_DAY.sheetTitle }),
      ).toBeOnTheScreen();
      const rows = screen.getAllByRole("button", { name: / · \d+ sets?, / });
      const names = [
        "Push, 1 exercise · 3 sets, Monday",
        PULL_ROW,
        LEGS_ROW,
        "Push, 1 exercise · 3 sets, Saturday",
      ];
      expect(rows).toHaveLength(names.length);
      for (const [index, name] of names.entries()) {
        expect(rows[index]).toHaveAccessibleName(name);
      }
    });

    it("should start a session for the picked day, not today's, and open the session screen", async () => {
      const user = userEvent.setup();
      await renderRoute();
      await user.press(await screen.findByRole("button", { name: TRAIN_PICK_DAY.action }));

      await user.press(await screen.findByRole("button", { name: PULL_ROW }));

      await waitFor(() => {
        expect(routerMock.push).toHaveBeenCalledWith("/session");
      });
      expect(trainWrites.inserted).toHaveLength(1);
      expect(trainWrites.inserted[0]).toMatchObject({
        routine_day_id: PULL_ID,
        local_date: "2026-10-15",
        tz: "Europe/London",
      });
    });

    it("should make one start, not two, when a day is pressed twice in the same moment", async () => {
      const user = userEvent.setup();
      await renderRoute();
      await user.press(await screen.findByRole("button", { name: TRAIN_PICK_DAY.action }));
      const pull = await screen.findByRole("button", { name: PULL_ROW });

      await pressTwiceInTheSameMoment(pull);

      await waitFor(() => {
        expect(routerMock.push).toHaveBeenCalledTimes(1);
      });
      expect(trainWrites.inserted).toHaveLength(1);
      expect(queryClient.getMutationCache().getAll()).toHaveLength(1);
    });

    it("should keep the start and the spinner on the first day when two different days are pressed in the same moment", async () => {
      let release: () => void = () => undefined;
      trainWrites.holdInserts = new Promise((resolve) => {
        release = resolve;
      });
      const user = userEvent.setup();
      await renderRoute();
      await user.press(await screen.findByRole("button", { name: TRAIN_PICK_DAY.action }));
      const pull = await screen.findByRole("button", { name: PULL_ROW });
      const legs = screen.getByRole("button", { name: LEGS_ROW });

      await pressInTheSameMoment(pull, legs);

      expect(await screen.findByRole("button", { name: PULL_ROW, busy: true })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: LEGS_ROW, busy: true })).not.toBeOnTheScreen();
      await act(() => {
        release();
      });
      await waitFor(() => {
        expect(routerMock.push).toHaveBeenCalledTimes(1);
      });
      expect(trainWrites.inserted).toHaveLength(1);
      expect(trainWrites.inserted[0]).toMatchObject({ routine_day_id: PULL_ID });
    });

    it("should show the tapped day as busy, and the others dimmed, while the start is under way", async () => {
      let release: () => void = () => undefined;
      trainWrites.holdInserts = new Promise((resolve) => {
        release = resolve;
      });
      const user = userEvent.setup();
      await renderRoute();
      await user.press(await screen.findByRole("button", { name: TRAIN_PICK_DAY.action }));

      await user.press(await screen.findByRole("button", { name: PULL_ROW }));

      expect(await screen.findByRole("button", { name: PULL_ROW, busy: true })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: LEGS_ROW })).toBeDisabled();
      await act(() => {
        release();
      });
      await waitFor(() => {
        expect(routerMock.push).toHaveBeenCalledTimes(1);
      });
    });

    it("should show the error toast, keep the sheet open and let a day be pressed again when the start fails", async () => {
      trainWrites.failInserts = true;
      const user = userEvent.setup();
      await renderRoute();
      await user.press(await screen.findByRole("button", { name: TRAIN_PICK_DAY.action }));

      await user.press(await screen.findByRole("button", { name: PULL_ROW }));

      expect(await screen.findByRole("status", { name: TRAIN_START_FAILED })).toBeOnTheScreen();
      expect(routerMock.push).not.toHaveBeenCalled();
      expect(screen.getByRole("heading", { name: TRAIN_PICK_DAY.sheetTitle })).toBeOnTheScreen();

      trainWrites.failInserts = false;
      await user.press(screen.getByRole("button", { name: PULL_ROW }));
      await waitFor(() => {
        expect(routerMock.push).toHaveBeenCalledTimes(1);
      });
    });

    it("should close the sheet once the session is started, since the card then reads Resume", async () => {
      const user = userEvent.setup();
      await renderRoute();
      await user.press(await screen.findByRole("button", { name: TRAIN_PICK_DAY.action }));

      await user.press(await screen.findByRole("button", { name: PULL_ROW }));

      await waitFor(() => {
        expect(
          screen.queryByRole("heading", { name: TRAIN_PICK_DAY.sheetTitle }),
        ).not.toBeOnTheScreen();
      });
      expect(await screen.findByRole("button", { name: "Resume Pull" })).toBeOnTheScreen();
      // Today's cell of the strip is named for the day picked.
      expect(
        screen.getByLabelText(/^Thursday 15 October, today, Pull, in progress/),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: TRAIN_PICK_DAY.action })).not.toBeOnTheScreen();
    });

    it("should close the sheet from its Close control without starting anything", async () => {
      const user = userEvent.setup();
      await renderRoute();
      await user.press(await screen.findByRole("button", { name: TRAIN_PICK_DAY.action }));

      await user.press(await screen.findByRole("button", { name: TRAIN_PICK_DAY.closeName }));

      await waitFor(() => {
        expect(
          screen.queryByRole("heading", { name: TRAIN_PICK_DAY.sheetTitle }),
        ).not.toBeOnTheScreen();
      });
      expect(trainWrites.inserted).toHaveLength(0);
    });

    it("should dim Pick day and open nothing while offline", async () => {
      const user = userEvent.setup();
      await renderRoute();
      await screen.findByRole("button", { name: TRAIN_PICK_DAY.action });

      await goOffline();
      await user.press(screen.getByRole("button", { name: TRAIN_PICK_DAY.action }));

      expect(screen.getByRole("button", { name: TRAIN_PICK_DAY.action })).toBeDisabled();
      expect(
        screen.queryByRole("heading", { name: TRAIN_PICK_DAY.sheetTitle }),
      ).not.toBeOnTheScreen();
    });
  });

  describe("on the other cards", () => {
    it("should draw Pick day beside Log a session on a rest day", async () => {
      mockNow = new Date("2026-10-14T11:00:00Z");
      jest.setSystemTime(mockNow);
      await renderRoute();

      expect(await screen.findByRole("button", { name: "Log a session" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: TRAIN_PICK_DAY.action })).toBeOnTheScreen();
    });

    it("should draw Pick day beside Log another session once the day's session is done", async () => {
      mockNow = new Date("2026-10-15T18:30:00Z");
      jest.setSystemTime(mockNow);
      trainBackend.weekSessions = [
        mondayPush,
        tuesdayPull,
        thursdayLegsInTheWeek("2026-10-15T19:00:00+01:00"),
      ];
      await renderRoute();

      expect(await screen.findByRole("button", { name: "Log another session" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: TRAIN_PICK_DAY.action })).toBeOnTheScreen();
    });

    it("should draw no Pick day while a session is open, and keep Resume", async () => {
      mockNow = new Date("2026-10-15T18:00:00Z");
      trainBackend.weekSessions = [mondayPush, tuesdayPull, thursdayLegsInTheWeek(null)];
      trainBackend.activeSession = thursdayLegsActive;
      await renderRoute();

      expect(await screen.findByRole("button", { name: "Resume Legs" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: TRAIN_PICK_DAY.action })).not.toBeOnTheScreen();
    });

    it("should draw no Pick day with no routine, on the first visit", async () => {
      trainBackend.routine = null;
      trainBackend.weekSessions = [];
      await renderRoute();

      expect(await screen.findByRole("button", { name: "Log a session" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: TRAIN_PICK_DAY.action })).not.toBeOnTheScreen();
    });
  });
});
