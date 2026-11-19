import { KeyLowProvider } from "@keylow/api-client";
import { QueryClient } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";

import { TrainStreakCard } from "../components/TrainScreen/TrainStreakCard";
import { WeightStreakCard } from "../components/WeightScreen/WeightStreakCard";
import { ThemeProvider } from "../lib/theme";
import { useReadsEnabled } from "../lib/useReadsEnabled";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { streakStatsClient } from "./support/streakFixtures";

import type { StreakStatsOptions } from "./support/streakFixtures";
import type { ReactNode } from "react";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock("../lib/useReadsEnabled");
// 13:00 on Thursday 19 November 2026, UTC. This week began on Monday the 16th.
const mockNow = new Date("2026-11-19T13:00:00Z");
jest.mock("../lib/useNow", () => ({ useNow: () => mockNow }));

describe("the weekly streaks on the Train and Weight screens", () => {
  let styles: string;
  let queryClient: QueryClient;

  beforeAll(async () => {
    styles = await compileKitStyles("", [
      "components/TrainScreen/TrainStreakCard",
      "components/WeightScreen/WeightStreakCard",
      "components/WeeklyStreakCard",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(styles);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    jest.mocked(useReadsEnabled).mockReturnValue(true);
  });

  afterEach(() => {
    queryClient.clear();
  });

  async function renderWith(options: StreakStatsOptions | "fails", card: ReactNode) {
    const { client } = streakStatsClient(options);
    await render(
      <ThemeProvider fixedPreference="dark">
        <KeyLowProvider client={client} queryClient={queryClient}>
          {card}
        </KeyLowProvider>
      </ThemeProvider>,
    );
  }

  // The board's training week: four weeks kept, and 2 of 4 sessions so far this week.
  const trainingWeeks = [
    { weekStart: "2026-10-19", sessions: 4 },
    { weekStart: "2026-10-26", sessions: 4 },
    { weekStart: "2026-11-02", sessions: 4 },
    { weekStart: "2026-11-09", sessions: 4 },
    { weekStart: "2026-11-16", sessions: 2 },
  ];

  describe("on the Train tab", () => {
    it("should show the training streak and how this week is going", async () => {
      await renderWith({ trainingWeeks }, <TrainStreakCard />);

      expect(await screen.findByText("4-week training streak")).toBeOnTheScreen();
      expect(screen.getByText("Best 4")).toBeOnTheScreen();
      expect(
        screen.getByText("2 of 4 sessions this week. 2 more by Sunday to keep it."),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText("Now, at risk")).toBeOnTheScreen();
    });

    it("should count a week with all its sessions", async () => {
      await renderWith(
        {
          trainingWeeks: [...trainingWeeks.slice(0, 4), { weekStart: "2026-11-16", sessions: 4 }],
        },
        <TrainStreakCard />,
      );

      expect(await screen.findByText("5-week training streak")).toBeOnTheScreen();
      expect(screen.getByText("4 of 4 sessions this week.")).toBeOnTheScreen();
    });

    it("should be left out when the streak cannot be read", async () => {
      await renderWith("fails", <TrainStreakCard />);

      await waitFor(() => {
        expect(screen.queryByText(/training streak/)).not.toBeOnTheScreen();
      });
    });
  });

  describe("on the Weight screen", () => {
    it("should say this week has a weigh-in", async () => {
      await renderWith(
        { weighInDates: ["2026-11-03", "2026-11-10", "2026-11-17"] },
        <WeightStreakCard />,
      );

      expect(await screen.findByText("3-week weigh-in streak")).toBeOnTheScreen();
      expect(screen.getByText("Weighed in this week. Best 3 weeks.")).toBeOnTheScreen();
    });

    it("should ask for a weigh-in when this week has none yet", async () => {
      await renderWith({ weighInDates: ["2026-11-03", "2026-11-10"] }, <WeightStreakCard />);

      expect(await screen.findByText("2-week weigh-in streak")).toBeOnTheScreen();
      expect(screen.getByText("Weigh in by Sunday to keep it. Best 2 weeks.")).toBeOnTheScreen();
    });

    it("should name no weight", async () => {
      await renderWith({ weighInDates: ["2026-11-17"] }, <WeightStreakCard />);

      await screen.findByText("1-week weigh-in streak");
      expect(screen.queryByText(/\bkg\b|\blb\b/)).not.toBeOnTheScreen();
    });

    it("should be left out when the streak cannot be read", async () => {
      await renderWith("fails", <WeightStreakCard />);

      await waitFor(() => {
        expect(screen.queryByText(/weigh-in streak/)).not.toBeOnTheScreen();
      });
    });
  });
});
