import { KeyLowProvider, keys } from "@keylow/api-client";
import { TRAIN_ERROR, TRAIN_LOADING_NAME, TRAIN_TODAY_CARD } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { TrainScreen } from "../components/TrainScreen";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient, diaryBackend } from "./support/diaryBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  resetTrainBackend,
  trainBackend,
  trainClient,
  trainRequestsTo,
} from "./support/trainBackend";
import {
  goldenRoutine,
  mondayPush,
  openLegsSession,
  thursdayLegsActive,
  thursdayLegsInTheWeek,
  tuesdayPull,
} from "./support/trainGoldenWeek";

import type { TrainScreenProps } from "../components/TrainScreen";
import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// The clock the screen reads, which a test moves with `moveClockTo`.
let mockNow = new Date("2026-10-15T16:55:00Z");
const mockClockListeners = new Set<() => void>();
jest.mock("../lib/useNow", () => {
  const { useSyncExternalStore } = jest.requireActual<typeof import("react")>("react");

  return {
    useNow: () =>
      useSyncExternalStore(
        (listener: () => void) => {
          mockClockListeners.add(listener);

          return () => {
            mockClockListeners.delete(listener);
          };
        },
        () => mockNow,
      ),
  };
});

async function moveClockTo(instant: string) {
  await act(() => {
    mockNow = new Date(instant);
    for (const listener of mockClockListeners) {
      listener();
    }
  });
}

setUpTests();

// The golden week's moments, in Europe/London (BST).
const THURSDAY_1755 = "2026-10-15T16:55:00Z";
const THURSDAY_1900 = "2026-10-15T18:00:00Z";
const WEDNESDAY_1200 = "2026-10-14T11:00:00Z";
// Thursday's Legs ended at 19:00.
const LEGS_ENDED_AT = "2026-10-15T19:00:00+01:00";

let queryClient: QueryClient;

async function renderTrain(props: TrainScreenProps = {}) {
  queryClient = createDiaryQueryClient();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={trainClient} queryClient={queryClient}>
        <TrainScreen {...props} />
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

const allHandlers = () => ({
  onStart: jest.fn(),
  onResume: jest.fn(),
  onViewSession: jest.fn(),
});

function seedGoldenWeekThrough(moment: "planned" | "in_progress" | "done" | "rest") {
  trainBackend.routine = goldenRoutine;
  trainBackend.weekSessions = [mondayPush, tuesdayPull];
  if (moment === "in_progress") {
    trainBackend.weekSessions = [mondayPush, tuesdayPull, thursdayLegsInTheWeek(null)];
    trainBackend.activeSession = thursdayLegsActive;
  }
  if (moment === "done") {
    trainBackend.weekSessions = [mondayPush, tuesdayPull, thursdayLegsInTheWeek(LEGS_ENDED_AT)];
  }
}

describe("the Train home's Today card", () => {
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
    resetTrainBackend();
    mockNow = new Date(THURSDAY_1755);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("on Thursday at 17:55, before Legs", () => {
    beforeEach(() => {
      seedGoldenWeekThrough("planned");
    });

    it("should show Legs, its place in the routine and what it holds, with the core's estimate of the time", async () => {
      await renderTrain();

      expect(await screen.findByRole("heading", { name: "Legs" })).toBeOnTheScreen();
      expect(screen.getByText("Today · Thursday 15 October")).toBeOnTheScreen();
      expect(screen.getByText("Push Pull Legs · day 3 of 4")).toBeOnTheScreen();
      expect(screen.getByText("5 exercises · 16 sets · about 50 min")).toBeOnTheScreen();
    });

    it("should draw no button when no handler is given", async () => {
      await renderTrain();
      await screen.findByRole("heading", { name: "Legs" });

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });

    it("should draw Start Legs when onStart is given, and call it", async () => {
      const handlers = allHandlers();
      const user = userEvent.setup();
      await renderTrain(handlers);

      await user.press(await screen.findByRole("button", { name: "Start Legs" }));

      expect(handlers.onStart).toHaveBeenCalledTimes(1);
      expect(handlers.onResume).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: /Resume/ })).not.toBeOnTheScreen();
    });
  });

  describe("on Thursday at 19:00, with the Legs session open", () => {
    beforeEach(() => {
      seedGoldenWeekThrough("in_progress");
      mockNow = new Date(THURSDAY_1900);
    });

    it("should show Legs in progress with the minutes, the sets and the next set", async () => {
      await renderTrain();

      expect(await screen.findByRole("heading", { name: "Legs" })).toBeOnTheScreen();
      expect(screen.getByText(TRAIN_TODAY_CARD.inProgressLabel)).toBeOnTheScreen();
      expect(screen.getByText("30 min · 8 of 16 sets · next: Leg Press, set 3")).toBeOnTheScreen();
      expect(screen.getByRole("progressbar", { name: "Sets logged" })).toHaveAccessibilityValue({
        min: 0,
        max: 16,
        now: 8,
      });
    });

    it("should draw Resume Legs when onResume is given, and call it", async () => {
      const handlers = allHandlers();
      const user = userEvent.setup();
      await renderTrain(handlers);

      await user.press(await screen.findByRole("button", { name: "Resume Legs" }));

      expect(handlers.onResume).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("button", { name: /Start/ })).not.toBeOnTheScreen();
    });

    it("should show the session in progress even when the week's rows have not caught up with it", async () => {
      trainBackend.weekSessions = [mondayPush, tuesdayPull];
      await renderTrain();

      expect(await screen.findByText(TRAIN_TODAY_CARD.inProgressLabel)).toBeOnTheScreen();
      expect(screen.getByText("30 min · 8 of 16 sets · next: Leg Press, set 3")).toBeOnTheScreen();
    });

    it("should move on to the minute that has come when the clock ticks, without reading again", async () => {
      await renderTrain();
      await screen.findByText("30 min · 8 of 16 sets · next: Leg Press, set 3");
      const readsBefore = trainBackend.requests.length;
      const keysBefore = queryClient
        .getQueryCache()
        .getAll()
        .map((query) => query.queryKey);

      await moveClockTo("2026-10-15T18:01:00Z");

      expect(screen.getByText("31 min · 8 of 16 sets · next: Leg Press, set 3")).toBeOnTheScreen();
      expect(trainBackend.requests).toHaveLength(readsBefore);
      expect(
        queryClient
          .getQueryCache()
          .getAll()
          .map((query) => query.queryKey),
      ).toEqual(keysBefore);
    });
  });

  describe("after the session is finished", () => {
    beforeEach(() => {
      seedGoldenWeekThrough("done");
      mockNow = new Date("2026-10-15T18:01:00Z");
    });

    it("should show Legs done with what was logged and the next planned day", async () => {
      await renderTrain();

      expect(await screen.findByRole("heading", { name: "Legs" })).toBeOnTheScreen();
      expect(screen.getByText(TRAIN_TODAY_CARD.doneLabel)).toBeOnTheScreen();
      expect(screen.getByText("30 min · 8 of 16 sets · next: Push on Saturday")).toBeOnTheScreen();
    });

    it("should draw View session when onViewSession is given, and call it", async () => {
      const handlers = allHandlers();
      const user = userEvent.setup();
      await renderTrain(handlers);

      await user.press(
        await screen.findByRole("button", { name: TRAIN_TODAY_CARD.viewSessionAction }),
      );

      expect(handlers.onViewSession).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("button", { name: /Start|Resume/ })).not.toBeOnTheScreen();
    });

    it("should draw no button when no handler is given", async () => {
      await renderTrain();
      await screen.findByText(TRAIN_TODAY_CARD.doneLabel);

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });
  });

  describe("when the open session changes", () => {
    it("should move from in progress to done when the session ends and the reads are made again", async () => {
      seedGoldenWeekThrough("in_progress");
      mockNow = new Date(THURSDAY_1900);
      await renderTrain();
      await screen.findByText(TRAIN_TODAY_CARD.inProgressLabel);

      trainBackend.activeSession = null;
      trainBackend.weekSessions = [mondayPush, tuesdayPull, thursdayLegsInTheWeek(LEGS_ENDED_AT)];
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: keys.training.all });
      });

      expect(await screen.findByText(TRAIN_TODAY_CARD.doneLabel)).toBeOnTheScreen();
      expect(screen.queryByText(TRAIN_TODAY_CARD.inProgressLabel)).not.toBeOnTheScreen();
    });

    it("should move from planned to in progress when a session is started and the reads are made again", async () => {
      seedGoldenWeekThrough("planned");
      await renderTrain();
      await screen.findByText("5 exercises · 16 sets · about 50 min");

      trainBackend.activeSession = thursdayLegsActive;
      trainBackend.weekSessions = [mondayPush, tuesdayPull, thursdayLegsInTheWeek(null)];
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: keys.training.all });
      });

      expect(await screen.findByText(TRAIN_TODAY_CARD.inProgressLabel)).toBeOnTheScreen();
    });
  });

  describe("on Wednesday at 12:00, a rest day", () => {
    beforeEach(() => {
      seedGoldenWeekThrough("rest");
      mockNow = new Date(WEDNESDAY_1200);
    });

    it("should show the rest day with the next day", async () => {
      await renderTrain(allHandlers());

      expect(
        await screen.findByRole("heading", { name: TRAIN_TODAY_CARD.restTitle }),
      ).toBeOnTheScreen();
      expect(screen.getByText("Today · Wednesday 14 October")).toBeOnTheScreen();
      expect(screen.getByText("Next: Legs on Thursday.")).toBeOnTheScreen();
    });

    it("should draw no button, even with every handler", async () => {
      await renderTrain(allHandlers());
      await screen.findByRole("heading", { name: TRAIN_TODAY_CARD.restTitle });

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });
  });

  describe("in the user's time zone, not UTC", () => {
    it("should show Friday's rest day at 00:30 BST on Friday, which is still Thursday in UTC", async () => {
      seedGoldenWeekThrough("rest");
      mockNow = new Date("2026-10-15T23:30:00Z");
      await renderTrain();

      expect(
        await screen.findByRole("heading", { name: TRAIN_TODAY_CARD.restTitle }),
      ).toBeOnTheScreen();
      expect(screen.getByText("Today · Friday 16 October")).toBeOnTheScreen();
      expect(screen.getByText("Next: Push on Saturday.")).toBeOnTheScreen();
    });

    it("should show the new week's Push at 00:30 BST on Monday, which is still Sunday in UTC", async () => {
      trainBackend.routine = goldenRoutine;
      mockNow = new Date("2026-10-18T23:30:00Z");
      await renderTrain(allHandlers());

      expect(await screen.findByRole("heading", { name: "Push" })).toBeOnTheScreen();
      expect(screen.getByText("Today · Monday 19 October")).toBeOnTheScreen();
      expect(screen.getByText("Push Pull Legs · day 1 of 4")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Start Push" })).toBeOnTheScreen();
    });
  });

  describe("a routine made active later", () => {
    it("should show a rest day before the day it was made active, not the day it plans", async () => {
      trainBackend.routine = { ...goldenRoutine, activated_at: "2026-10-16T09:00:00+01:00" };
      trainBackend.weekSessions = [];
      await renderTrain();

      expect(
        await screen.findByRole("heading", { name: TRAIN_TODAY_CARD.restTitle }),
      ).toBeOnTheScreen();
      expect(screen.getByText("Next: Push on Saturday.")).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: "Legs" })).not.toBeOnTheScreen();
    });
  });

  describe("a session that crosses local midnight", () => {
    it("should keep the session started on Sunday night in progress on Monday at 00:10, in place of Start Push", async () => {
      const { active } = openLegsSession("2026-10-18", "2026-10-18T22:50:00+01:00");
      trainBackend.routine = goldenRoutine;
      trainBackend.weekSessions = [];
      trainBackend.activeSession = active;
      mockNow = new Date("2026-10-18T23:10:00Z");
      await renderTrain(allHandlers());

      expect(await screen.findByText(TRAIN_TODAY_CARD.inProgressLabel)).toBeOnTheScreen();
      expect(screen.getByText("Today · Monday 19 October")).toBeOnTheScreen();
      expect(
        screen.getByText("80 min · 0 of 16 sets · next: Barbell Squat, set 1"),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Resume Legs" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /Start/ })).not.toBeOnTheScreen();
    });

    it("should keep the session started on Thursday night in progress on Friday at 00:10, in place of the rest day", async () => {
      const { inTheWeek, active } = openLegsSession("2026-10-15", "2026-10-15T22:50:00+01:00");
      trainBackend.routine = goldenRoutine;
      trainBackend.weekSessions = [mondayPush, tuesdayPull, inTheWeek];
      trainBackend.activeSession = active;
      mockNow = new Date("2026-10-15T23:10:00Z");
      await renderTrain(allHandlers());

      expect(await screen.findByText(TRAIN_TODAY_CARD.inProgressLabel)).toBeOnTheScreen();
      expect(screen.getByText("Today · Friday 16 October")).toBeOnTheScreen();
      expect(
        screen.getByText("80 min · 0 of 16 sets · next: Barbell Squat, set 1"),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Resume Legs" })).toBeOnTheScreen();
      expect(
        screen.queryByRole("heading", { name: TRAIN_TODAY_CARD.restTitle }),
      ).not.toBeOnTheScreen();
    });
  });

  describe("with no routine", () => {
    it("should show a session in progress as Session with Resume session, in place of the no routine card", async () => {
      trainBackend.sessions = [mondayPush];
      trainBackend.activeSession = {
        ...thursdayLegsActive,
        routine_day_id: null,
        routine_days: null,
      };
      trainBackend.weekSessions = [{ ...thursdayLegsInTheWeek(null), routine_day_id: null }];
      mockNow = new Date(THURSDAY_1900);
      await renderTrain(allHandlers());

      expect(
        await screen.findByRole("heading", { name: TRAIN_TODAY_CARD.sessionName }),
      ).toBeOnTheScreen();
      expect(screen.getByText("30 min · 8 sets")).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: TRAIN_TODAY_CARD.resumeSessionAction }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: "No routine yet" })).not.toBeOnTheScreen();
    });
  });

  describe("offline", () => {
    async function goOffline() {
      await act(() => {
        onlineManager.setOnline(false);
      });
    }

    it("should keep showing the card from the cache, and dim and stop Start Legs", async () => {
      seedGoldenWeekThrough("planned");
      const handlers = allHandlers();
      const user = userEvent.setup();
      await renderTrain(handlers);
      await screen.findByRole("button", { name: "Start Legs" });

      await goOffline();
      await user.press(screen.getByRole("button", { name: "Start Legs" }));

      expect(screen.getByRole("heading", { name: "Legs" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Start Legs" })).toBeDisabled();
      expect(handlers.onStart).not.toHaveBeenCalled();
    });

    it("should dim and stop Resume Legs", async () => {
      seedGoldenWeekThrough("in_progress");
      mockNow = new Date(THURSDAY_1900);
      const handlers = allHandlers();
      const user = userEvent.setup();
      await renderTrain(handlers);
      await screen.findByRole("button", { name: "Resume Legs" });

      await goOffline();
      await user.press(screen.getByRole("button", { name: "Resume Legs" }));

      expect(screen.getByRole("button", { name: "Resume Legs" })).toBeDisabled();
      expect(handlers.onResume).not.toHaveBeenCalled();
    });

    it("should keep View session enabled, since it reads what is saved", async () => {
      seedGoldenWeekThrough("done");
      mockNow = new Date("2026-10-15T18:01:00Z");
      await renderTrain(allHandlers());
      await screen.findByRole("button", { name: TRAIN_TODAY_CARD.viewSessionAction });

      await goOffline();

      expect(
        screen.getByRole("button", { name: TRAIN_TODAY_CARD.viewSessionAction }),
      ).toBeEnabled();
    });
  });

  describe("loading and failing", () => {
    it("should show the skeleton while the week's sessions are read", async () => {
      trainBackend.routine = goldenRoutine;
      trainBackend.hungTables.add("week_sessions");
      await renderTrain();

      expect(await screen.findByRole("status", { name: TRAIN_LOADING_NAME })).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: "Legs" })).not.toBeOnTheScreen();
    });

    it("should show the skeleton while the session in progress is read", async () => {
      trainBackend.routine = goldenRoutine;
      trainBackend.hungTables.add("active_session");
      await renderTrain();

      expect(await screen.findByRole("status", { name: TRAIN_LOADING_NAME })).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: "Legs" })).not.toBeOnTheScreen();
    });

    it("should fail when the week's sessions cannot be read and nothing is cached", async () => {
      trainBackend.routine = goldenRoutine;
      trainBackend.failingTables.add("week_sessions");
      await renderTrain();

      expect(await screen.findByText(TRAIN_ERROR.title)).toBeOnTheScreen();
    });

    it("should fail when the session in progress cannot be read and nothing is cached", async () => {
      trainBackend.routine = goldenRoutine;
      trainBackend.failingTables.add("active_session");
      await renderTrain();

      expect(await screen.findByText(TRAIN_ERROR.title)).toBeOnTheScreen();
    });

    it("should read again, week and session, when Try again is pressed", async () => {
      trainBackend.routine = goldenRoutine;
      trainBackend.failingTables.add("week_sessions");
      const user = userEvent.setup();
      await renderTrain();
      const tryAgain = await screen.findByRole("button", { name: TRAIN_ERROR.action });
      const readsAfterFirstFailure = trainRequestsTo("week_sessions");
      trainBackend.failingTables.clear();
      seedGoldenWeekThrough("planned");

      await user.press(tryAgain);

      expect(await screen.findByRole("heading", { name: "Legs" })).toBeOnTheScreen();
      expect(trainRequestsTo("week_sessions")).toBeGreaterThan(readsAfterFirstFailure);
    });

    it("should make no read while the terms are not accepted", async () => {
      diaryBackend.terms = { terms_accepted_at: null, terms_version: null };
      await renderTrain();
      await screen.findByRole("status", { name: TRAIN_LOADING_NAME });
      await act(async () => {
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(trainRequestsTo("week_sessions")).toBe(0);
      });
      expect(trainRequestsTo("active_session")).toBe(0);
    });
  });
});
