import { keys, markAchievementsSeen } from "@keylow/api-client";
import { runAchievements } from "@keylow/core";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, within } from "@testing-library/react-native";

import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import AchievementsRoute from "../app/(tabs)/more/achievements";
import { getQueuedIds, resetCelebrations } from "../lib/achievements/celebrationStore";
import { storedStatsWithOneEntry } from "../lib/achievements/storedStatsFixture";
import { ThemeProvider } from "../lib/theme";

import type { AchievementState } from "@keylow/api-client";

type HeldRows = AchievementState["held"];

// What the read answers. The read itself is tested where it lives, in `@keylow/api-client`.
const mockRead: {
  data: AchievementState | undefined;
  isError: boolean;
  refetch: jest.Mock<Promise<unknown>, []>;
} = { data: undefined, isError: false, refetch: jest.fn(() => Promise.resolve()) };

// One object for every render, as the real client is, because the hook that marks rows seen depends on it.
const mockClient = { name: "the supabase client" };

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useAchievementState: () => mockRead,
  useSupabase: () => mockClient,
  markAchievementsSeen: jest.fn(() => Promise.resolve()),
}));
jest.mock("../lib/useReadsEnabled", () => ({ useReadsEnabled: () => true }));
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

const held = (id: string, overrides: Partial<HeldRows[number]> = {}): HeldRows[number] => ({
  id,
  unlockedAt: "2026-11-06T09:00:00.000Z",
  seenAt: "2026-11-06T09:05:00.000Z",
  backfilled: false,
  ...overrides,
});

// The engine over made-up stats, so the screen is checked against what the app really computes.
function readHolding(rows: HeldRows): AchievementState {
  const run = runAchievements({
    stats: storedStatsWithOneEntry,
    weighInDates: [],
    held: rows.map((row) => row.id),
    ledger: [],
    device: { reminderEnabled: false },
    now: new Date("2026-11-19T12:00:00Z"),
    isBackfill: false,
  });
  return { run, held: rows, today: "2026-11-19", weeks: { training: [], weighIn: [] } };
}

let queryClient: QueryClient;

async function renderScreen() {
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <QueryClientProvider client={queryClient}>
        <AchievementsRoute />
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return user;
}

describe("the Achievements screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/AchievementsScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetCelebrations();
    jest.mocked(markAchievementsSeen).mockClear();
    mockRead.data = readHolding([held("first-bite")]);
    mockRead.isError = false;
    mockRead.refetch.mockClear();
    queryClient = new QueryClient();
    onlineManager.setOnline(true);
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
  });

  describe("its header and the level card", () => {
    it("should be headed Achievements, with Back to More", async () => {
      const user = await renderScreen();

      expect(screen.getByRole("heading", { name: "Achievements" })).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Back to More" }));
      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should go to More when there is no screen to go back to", async () => {
      routerMock.canGoBack.mockReturnValue(false);
      const user = await renderScreen();

      await user.press(screen.getByRole("button", { name: "Back to More" }));

      expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/more");
    });

    it("should show the level, its name, the points and the way to the next level", async () => {
      await renderScreen();

      expect(screen.getByText("Level 0")).toBeOnTheScreen();
      expect(screen.getByText("Sprout")).toBeOnTheScreen();
      expect(screen.getByText("40 points to level 1")).toBeOnTheScreen();
      expect(screen.getByRole("progressbar", { name: "Progress to level 1" })).toBeOnTheScreen();
    });

    it("should show the streak, the freezes held and how many of the 130 badges are earned", async () => {
      await renderScreen();

      expect(screen.getByLabelText("0 day streak")).toBeOnTheScreen();
      expect(screen.getByLabelText(/^\d+ freezes?$/)).toBeOnTheScreen();
      expect(screen.getByLabelText("1 of 130 badges")).toBeOnTheScreen();
    });
  });

  describe("the catalogue", () => {
    it("should list the 13 categories with how many of each are earned", async () => {
      await renderScreen();

      // The screen's own heading and the 13 categories.
      expect(screen.getAllByRole("heading")).toHaveLength(14);
      expect(screen.getByRole("heading", { name: "Getting started" })).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Hidden and seasonal" })).toBeOnTheScreen();
      expect(screen.getByText("1 of 12")).toBeOnTheScreen();
    });

    it("should name an earned badge with its tier", async () => {
      await renderScreen();

      expect(screen.getByRole("button", { name: "First Bite, Bronze, earned" })).toBeOnTheScreen();
    });

    it("should show a locked badge with its progress line", async () => {
      await renderScreen();

      const badge = screen.getByRole("button", { name: "Hat Trick, Bronze, locked, 0 of 3 days" });
      expect(within(badge).getByText("0 of 3 days")).toBeOnTheScreen();
    });

    it("should show hidden badges as ??? with nothing given away", async () => {
      await renderScreen();

      const hidden = screen.getAllByRole("button", { name: "Hidden badge" });
      expect(hidden).toHaveLength(6);
      for (const badge of hidden) {
        expect(within(badge).getByText("???")).toBeOnTheScreen();
      }
    });

    it("should open a badge's detail when it is pressed", async () => {
      const user = await renderScreen();

      await user.press(
        screen.getByRole("button", { name: "Hat Trick, Bronze, locked, 0 of 3 days" }),
      );

      expect(routerMock.push).toHaveBeenCalledWith("/more/achievements/hat-trick");
    });
  });

  describe("seen", () => {
    it("should mark every unseen row seen, backfilled ones included, and tell the queue the same ids", async () => {
      mockRead.data = readHolding([
        held("first-bite", { seenAt: null }),
        held("home-cook", { seenAt: null, backfilled: true }),
        held("jotter"),
      ]);
      const invalidate = jest.spyOn(queryClient, "invalidateQueries");
      await renderScreen();

      expect(markAchievementsSeen).toHaveBeenCalledTimes(1);
      expect(markAchievementsSeen).toHaveBeenCalledWith(mockClient, ["first-bite", "home-cook"]);
      expect(getQueuedIds()).toEqual(expect.arrayContaining(["first-bite", "home-cook"]));
      expect(getQueuedIds()).not.toContain("jotter");
      expect(invalidate).toHaveBeenCalledWith({ queryKey: keys.achievements.all });
    });

    it("should write nothing when every row is already seen", async () => {
      const invalidate = jest.spyOn(queryClient, "invalidateQueries");
      await renderScreen();

      expect(markAchievementsSeen).not.toHaveBeenCalled();
      expect(invalidate).not.toHaveBeenCalled();
    });

    it("should leave the screen as it was when marking them seen fails", async () => {
      mockRead.data = readHolding([held("first-bite", { seenAt: null })]);
      jest.mocked(markAchievementsSeen).mockRejectedValueOnce(new Error("offline"));
      await renderScreen();

      expect(screen.getByRole("button", { name: "First Bite, Bronze, earned" })).toBeOnTheScreen();
    });
  });

  describe("loading, offline and error", () => {
    it("should say it is loading while the read has no data", async () => {
      mockRead.data = undefined;
      await renderScreen();

      expect(screen.getByLabelText("Loading achievements")).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: "Getting started" })).not.toBeOnTheScreen();
    });

    it("should say so when offline and still show the last known badges", async () => {
      await act(() => {
        onlineManager.setOnline(false);
      });
      await renderScreen();

      expect(
        screen.getByText("You are offline. Badges you earn now are saved when Ki-Lo reconnects."),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "First Bite, Bronze, earned" })).toBeOnTheScreen();
    });

    it("should show its error state with Try again when the read failed", async () => {
      mockRead.data = undefined;
      mockRead.isError = true;
      const user = await renderScreen();

      expect(screen.getByText("Your achievements did not load")).toBeOnTheScreen();
      expect(
        screen.getByText("Your badges are safe. Ki-Lo could not reach them just now."),
      ).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Try again" }));
      expect(mockRead.refetch).toHaveBeenCalledTimes(1);
    });
  });
});
