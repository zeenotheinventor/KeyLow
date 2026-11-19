import { markAchievementsSeen } from "@keylow/api-client";
import { ACHIEVEMENTS } from "@keylow/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { AccessibilityInfo, AppState } from "react-native";

import { AchievementCelebration } from "../components/AchievementCelebration";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  getCelebrationState,
  recordCelebrations,
  resetCelebrations,
} from "../lib/achievements/celebrationStore";
import { ThemeProvider } from "../lib/theme";

import type { AchievementId, CelebrationEntry, CelebrationExtras } from "@keylow/core";

const mockClient = { name: "the supabase client" };

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useSupabase: () => mockClient,
  markAchievementsSeen: jest.fn(() => Promise.resolve()),
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);

const fresh = (...ids: AchievementId[]): CelebrationEntry[] =>
  ids.map((id) => ({ id, isNew: true }));
const held = (...ids: AchievementId[]): CelebrationEntry[] =>
  ids.map((id) => ({ id, isNew: false }));

const bronzeIds = ACHIEVEMENTS.filter(({ tier }) => tier === "bronze").map(({ id }) => id);

async function queue(entries: CelebrationEntry[], extras: CelebrationExtras | null = null) {
  await act(() => {
    recordCelebrations({ entries, extras, notification: null, backfillSummary: null }, true);
  });
}

let queryClient: QueryClient;

async function renderCelebration() {
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <QueryClientProvider client={queryClient}>
        <AchievementCelebration />
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return user;
}

describe("AchievementCelebration", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/AchievementCelebration"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetCelebrations();
    jest.mocked(markAchievementsSeen).mockClear();
    jest.mocked(Haptics.impactAsync).mockClear();
    queryClient = new QueryClient();
    Object.assign(AppState, { currentState: "active" });
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
    jest.restoreAllMocks();
  });

  it("should show nothing when nothing is waiting", async () => {
    await renderCelebration();

    expect(screen.queryByRole("status")).not.toBeOnTheScreen();
    expect(screen.queryByRole("heading")).not.toBeOnTheScreen();
  });

  it("should show nothing for a backfill, which queues no entries", async () => {
    await renderCelebration();

    await act(() => {
      recordCelebrations(
        { entries: [], extras: null, notification: null, backfillSummary: 23 },
        true,
      );
    });

    expect(screen.queryByRole("status")).not.toBeOnTheScreen();
  });

  describe("a drain of one", () => {
    it("should show the single toast with how it was earned and the points", async () => {
      await renderCelebration();

      await queue(fresh("hat-trick"));

      expect(await screen.findByText("Badge earned: Hat Trick")).toBeOnTheScreen();
      expect(screen.getByText("3-day daily streak. +10 points")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "View" })).toBeOnTheScreen();
    });

    it("should play the short haptic", async () => {
      await renderCelebration();

      await queue(fresh("hat-trick"));

      await screen.findByText("Badge earned: Hat Trick");
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    });

    it("should take it out of the queue and mark it seen", async () => {
      await renderCelebration();

      await queue(fresh("hat-trick"));

      await screen.findByText("Badge earned: Hat Trick");
      expect(getCelebrationState().entries).toEqual([]);
      expect(markAchievementsSeen).toHaveBeenCalledTimes(1);
      expect(markAchievementsSeen).toHaveBeenCalledWith(mockClient, ["hat-trick"]);
    });

    it("should open the badge from View and close the toast", async () => {
      const user = await renderCelebration();
      await queue(fresh("hat-trick"));

      await user.press(await screen.findByRole("button", { name: "View" }));

      expect(routerMock.push).toHaveBeenCalledWith("/more/achievements/hat-trick");
      expect(screen.queryByText("Badge earned: Hat Trick")).not.toBeOnTheScreen();
    });

    it("should close itself after 4 seconds", async () => {
      jest.useFakeTimers();
      await renderCelebration();
      await queue(fresh("hat-trick"));
      expect(screen.getByText("Badge earned: Hat Trick")).toBeOnTheScreen();

      await act(async () => {
        await jest.advanceTimersByTimeAsync(4000);
      });

      expect(screen.queryByText("Badge earned: Hat Trick")).not.toBeOnTheScreen();
      jest.useRealTimers();
    });
  });

  describe("a drain of several", () => {
    it("should show one grouped toast for three", async () => {
      await renderCelebration();

      await queue(fresh("fortnight", "notebook", "bullseye"));

      expect(await screen.findByText("3 badges earned")).toBeOnTheScreen();
      expect(screen.getByText("Fortnight, Notebook and Bullseye. +45 points")).toBeOnTheScreen();
      expect(screen.getAllByRole("status")).toHaveLength(1);
    });

    it("should show the freeze and level lines the run's notification carries", async () => {
      await renderCelebration();
      const extras = { freezes: 1, levelName: "Sapling" };

      await queue(fresh("fortnight", "notebook", "bullseye"), extras);

      expect(await screen.findByText("+1 freeze")).toBeOnTheScreen();
      expect(screen.getByText("You reached Sapling")).toBeOnTheScreen();
    });

    it("should show one toast for fourteen, counting the rest", async () => {
      await renderCelebration();

      await queue(held(...bronzeIds.slice(0, 14)));

      expect(await screen.findByText("14 badges earned")).toBeOnTheScreen();
      expect(screen.getByText(/ and 11 more\. \+140 points$/)).toBeOnTheScreen();
      expect(screen.getAllByRole("status")).toHaveLength(1);
      expect(getCelebrationState().entries).toEqual([]);
      expect(markAchievementsSeen).toHaveBeenCalledTimes(1);
      expect(markAchievementsSeen).toHaveBeenCalledWith(mockClient, bronzeIds.slice(0, 14));
    });

    it("should open the highest tier badge from View", async () => {
      const user = await renderCelebration();
      await queue(held("notebook", "fortnight", "bullseye"));

      await user.press(await screen.findByRole("button", { name: "View" }));

      expect(routerMock.push).toHaveBeenCalledWith("/more/achievements/fortnight");
    });

    it("should show a second drain as the one toast, never both", async () => {
      await renderCelebration();
      await queue(fresh("hat-trick"));
      await screen.findByText("Badge earned: Hat Trick");

      await queue(fresh("fortnight", "notebook"));

      expect(await screen.findByText("2 badges earned")).toBeOnTheScreen();
      expect(screen.getAllByRole("status")).toHaveLength(1);
    });
  });

  describe("Gold and Platinum", () => {
    it("should show the moment for a new Gold, with the others in one line and no toast", async () => {
      await renderCelebration();

      await queue([...fresh("month-strong"), ...held("notebook", "bullseye")]);

      expect(await screen.findByRole("heading", { name: "Month Strong" })).toBeOnTheScreen();
      expect(screen.getByLabelText("Gold badge earned, Month Strong")).toBeOnTheScreen();
      expect(screen.getByText("GOLD BADGE")).toBeOnTheScreen();
      expect(screen.getByText("and 2 more badges")).toBeOnTheScreen();
      expect(screen.getByText("+70 points")).toBeOnTheScreen();
      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
      expect(markAchievementsSeen).toHaveBeenCalledWith(mockClient, [
        "month-strong",
        "notebook",
        "bullseye",
      ]);
    });

    it("should play the heavy double haptic for the moment", async () => {
      await renderCelebration();

      await queue(fresh("month-strong"));

      await screen.findByRole("heading", { name: "Month Strong" });
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Heavy);
    });

    it("should show the Platinum moment", async () => {
      await renderCelebration();

      await queue(fresh("full-circle"));

      expect(await screen.findByText("PLATINUM BADGE")).toBeOnTheScreen();
    });

    it("should close on Nice one", async () => {
      const user = await renderCelebration();
      await queue(fresh("month-strong"));

      await user.press(await screen.findByRole("button", { name: "Nice one" }));

      expect(screen.queryByRole("heading", { name: "Month Strong" })).not.toBeOnTheScreen();
      expect(routerMock.push).not.toHaveBeenCalled();
    });

    it("should open the Achievements screen from See all achievements", async () => {
      const user = await renderCelebration();
      await queue(fresh("month-strong"));

      await user.press(await screen.findByRole("button", { name: "See all achievements" }));

      expect(routerMock.push).toHaveBeenCalledWith("/more/achievements");
      expect(screen.queryByRole("heading", { name: "Month Strong" })).not.toBeOnTheScreen();
    });

    it("should keep a later drain waiting until the moment is closed", async () => {
      const user = await renderCelebration();
      await queue(fresh("month-strong"));
      await screen.findByRole("heading", { name: "Month Strong" });

      await queue(fresh("hat-trick"));

      expect(screen.queryByText("Badge earned: Hat Trick")).not.toBeOnTheScreen();
      expect(getCelebrationState().entries).toEqual(fresh("hat-trick"));

      await user.press(screen.getByRole("button", { name: "Nice one" }));

      expect(await screen.findByText("Badge earned: Hat Trick")).toBeOnTheScreen();
    });

    it("should keep the content with reduced motion", async () => {
      jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
      await renderCelebration();

      await queue(fresh("month-strong"));

      expect(await screen.findByRole("heading", { name: "Month Strong" })).toBeOnTheScreen();
      expect(screen.getByText("30-day streak.")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Nice one" })).toBeOnTheScreen();
    });
  });

  describe("catch-up, the first open after this ships", () => {
    it("should show one grouped toast and no moment for held badges, a held Gold among them", async () => {
      await renderCelebration();

      await queue(held("notebook", "month-strong", "full-circle", ...bronzeIds.slice(0, 11)));

      expect(await screen.findByText("14 badges earned")).toBeOnTheScreen();
      expect(screen.getAllByRole("status")).toHaveLength(1);
      expect(screen.queryByRole("heading")).not.toBeOnTheScreen();
      expect(screen.queryByText("GOLD BADGE")).not.toBeOnTheScreen();
      expect(screen.queryByText("PLATINUM BADGE")).not.toBeOnTheScreen();
    });

    it("should show a held Gold with nothing new as a toast", async () => {
      await renderCelebration();

      await queue(held("month-strong"));

      expect(await screen.findByText("Badge earned: Month Strong")).toBeOnTheScreen();
      expect(screen.queryByRole("heading")).not.toBeOnTheScreen();
    });

    it("should show nothing again once the queue is drained", async () => {
      await renderCelebration();
      await queue(held("notebook", "bullseye"));
      await screen.findByText("2 badges earned");

      await cleanup();
      await renderCelebration();

      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
    });
  });

  describe("while the app is not in front", () => {
    it("should wait for it to come back", async () => {
      Object.assign(AppState, { currentState: "background" });
      let onChange: (state: "active") => void = () => undefined;
      jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
        onChange = listener;
        return { remove: () => undefined };
      });
      await renderCelebration();

      await queue(fresh("hat-trick"));

      expect(screen.queryByText("Badge earned: Hat Trick")).not.toBeOnTheScreen();
      expect(getCelebrationState().entries).toHaveLength(1);

      Object.assign(AppState, { currentState: "active" });
      await act(() => {
        onChange("active");
      });

      expect(await screen.findByText("Badge earned: Hat Trick")).toBeOnTheScreen();
    });
  });
});
