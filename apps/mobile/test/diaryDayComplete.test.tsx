import "./support/gestureHandler";

import { KeyLowProvider } from "@keylow/api-client";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { DiaryScreen } from "../components/DiaryScreen";
import { useDiaryStreak } from "../components/DiaryScreen/useDiaryStreak";
import { ToastProvider } from "../components/ui";
import { AchievementSync } from "../lib/achievements";
import { ThemeProvider } from "../lib/theme";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  requestsTo,
  resetDiaryBackend,
  sampleDay,
} from "./support/diaryBackend";
import { resetRouterMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
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
jest.mock("../lib/useReadsEnabled", () => ({ useReadsEnabled: () => true }));
// The clock each test sets. London is UTC+1 until 25 October 2026 and UTC from then on.
let mockNow = new Date("2026-10-15T22:59:00Z");
jest.mock("../lib/useNow", () => ({ useNow: () => mockNow }));
// The streak is worked out by core from the stored days: here it is what the test says it is.
jest.mock("../components/DiaryScreen/useDiaryStreak", () => ({ useDiaryStreak: jest.fn() }));

setUpTests();

const mockStreak = jest.mocked(useDiaryStreak);
const today = "2026-10-15";
const yesterday = "2026-10-14";

let queryClient: QueryClient;

async function renderDiaryAt(now: string) {
  mockNow = new Date(now);
  queryClient = createDiaryQueryClient();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <ToastProvider>
          <AchievementSync accountId="account-a" />
          <DiaryScreen />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  await screen.findByRole("button", { name: "Add food at 08:00" });
}

const toggle = () => screen.getByRole("switch");

describe("the Day complete control and the streak line", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/DiaryScreen"]);
  });

  beforeEach(() => {
    installVirtualClock();
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    mockStreak.mockReturnValue({ current: 11, isTodayCounted: false });
    diaryBackend.entries = sampleDay(today);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
    jest.useRealTimers();
  });

  describe("a day with nothing logged", () => {
    it("should be disabled and say to log something first", async () => {
      diaryBackend.entries = [];

      await renderDiaryAt("2026-10-15T09:00:00Z");

      expect(toggle()).toBeDisabled();
      expect(screen.getByText("Log something first to complete the day")).toBeOnTheScreen();
    });

    it("should still show the plain streak line, with no reminder", async () => {
      diaryBackend.entries = [];

      await renderDiaryAt("2026-10-15T09:00:00Z");

      expect(screen.getByText("11-day streak")).toBeOnTheScreen();
    });
  });

  describe("today", () => {
    it("should offer to complete at 23:59 and remind that completing keeps the streak", async () => {
      await renderDiaryAt("2026-10-15T22:59:00Z");

      expect(toggle()).not.toBeChecked();
      expect(toggle()).toBeEnabled();
      expect(
        screen.getByText("Keeps your streak and feeds the expenditure estimate"),
      ).toBeOnTheScreen();
      expect(screen.getByText("11-day streak · complete today to keep it")).toBeOnTheScreen();
    });

    it("should say how many days in a row once the day is complete, and offer Undo by tapping again", async () => {
      const user = userEvent.setup();
      mockStreak.mockReturnValue({ current: 12, isTodayCounted: true });
      diaryBackend.dayLogs = [
        {
          local_date: today,
          is_complete: true,
          completed_at: "2026-10-15T20:00:00+00:00",
          note: null,
        },
      ];
      await renderDiaryAt("2026-10-15T22:59:00Z");

      expect(toggle()).toBeChecked();
      expect(
        screen.getByText("12 days in a row. Tap again to undo before midnight"),
      ).toBeOnTheScreen();
      expect(screen.getByText("12-day streak")).toBeOnTheScreen();

      await user.press(toggle());

      await waitFor(() => {
        expect(toggle()).not.toBeChecked();
      });
    });

    it("should keep a complete day with no entries enabled, so it can be undone", async () => {
      const user = userEvent.setup();
      diaryBackend.entries = [];
      diaryBackend.dayLogs = [
        {
          local_date: today,
          is_complete: true,
          completed_at: "2026-10-15T20:00:00+00:00",
          note: null,
        },
      ];
      await renderDiaryAt("2026-10-15T22:59:00Z");

      expect(toggle()).toBeChecked();
      expect(toggle()).toBeEnabled();

      await user.press(toggle());

      await waitFor(() => {
        expect(toggle()).not.toBeChecked();
      });
    });

    it("should not state a number the streak has not reached while the stats catch up", async () => {
      mockStreak.mockReturnValue({ current: 11, isTodayCounted: false });
      diaryBackend.dayLogs = [
        {
          local_date: today,
          is_complete: true,
          completed_at: "2026-10-15T20:00:00+00:00",
          note: null,
        },
      ];

      await renderDiaryAt("2026-10-15T22:59:00Z");

      expect(screen.getByText("Counted in your expenditure estimate")).toBeOnTheScreen();
    });

    it("should have the achievements run after a Day complete is saved", async () => {
      const user = userEvent.setup();
      await renderDiaryAt("2026-10-15T22:59:00Z");
      const readsBefore = requestsTo("achievement_stats");

      await user.press(toggle());
      await waitFor(() => {
        expect(diaryBackend.dayLogs).toEqual([
          expect.objectContaining({ local_date: today, is_complete: true }),
        ]);
      });
      await act(() => jest.advanceTimersByTimeAsync(2500));

      expect(requestsTo("achievement_stats")).toBeGreaterThan(readsBefore);
    });
  });

  describe("yesterday", () => {
    const openYesterday = async () => {
      const user = userEvent.setup();
      await user.press(screen.getByRole("button", { name: "Wednesday 14 October" }));
      await screen.findByRole("heading", { name: "Wed 14 Oct" });
      await screen.findByRole("switch");
    };

    beforeEach(() => {
      diaryBackend.entries = sampleDay(yesterday);
    });

    it("should still count for the streak at 11:59 and say so", async () => {
      await renderDiaryAt("2026-10-15T10:59:00Z");
      await openYesterday();

      expect(
        screen.getByText("You can still complete yesterday until 12:00 to keep your streak."),
      ).toBeOnTheScreen();
      expect(screen.getByText("Counts for your streak until 12:00 today")).toBeOnTheScreen();
      expect(screen.getByText("11-day streak")).toBeOnTheScreen();
    });

    it("should complete yesterday when it is pressed at 11:59", async () => {
      const user = userEvent.setup();
      await renderDiaryAt("2026-10-15T10:59:00Z");
      await openYesterday();

      await user.press(toggle());

      await waitFor(() => {
        expect(diaryBackend.dayLogs).toEqual([
          expect.objectContaining({ local_date: yesterday, is_complete: true }),
        ]);
      });
    });

    it("should be a past day at 12:00, still completable, with no streak line", async () => {
      const user = userEvent.setup();
      await renderDiaryAt("2026-10-15T11:00:00Z");
      await openYesterday();

      expect(
        screen.getByText(
          "Completing this day now helps the expenditure estimate. It no longer counts for your streak.",
        ),
      ).toBeOnTheScreen();
      expect(screen.getByText("Complete days feed the expenditure estimate")).toBeOnTheScreen();
      expect(screen.queryByText(/-day streak/)).not.toBeOnTheScreen();
      expect(toggle()).toBeEnabled();

      await user.press(toggle());

      await waitFor(() => {
        expect(diaryBackend.dayLogs).toEqual([
          expect.objectContaining({ local_date: yesterday, is_complete: true }),
        ]);
      });
    });
  });

  describe("offline", () => {
    it("should say the completion is saved on the phone", async () => {
      diaryBackend.dayLogs = [
        {
          local_date: today,
          is_complete: true,
          completed_at: "2026-10-15T20:00:00+00:00",
          note: null,
        },
      ];
      await renderDiaryAt("2026-10-15T22:59:00Z");

      await act(() => {
        onlineManager.setOnline(false);
      });

      expect(
        await screen.findByText("Saved on this phone. Badges follow when Ki-Lo reconnects"),
      ).toBeOnTheScreen();
      expect(toggle()).toBeChecked();
    });

    it("should keep the switch off while offline, where a change could not be saved", async () => {
      await renderDiaryAt("2026-10-15T22:59:00Z");

      await act(() => {
        onlineManager.setOnline(false);
      });

      expect(toggle()).toBeDisabled();
    });
  });
});
