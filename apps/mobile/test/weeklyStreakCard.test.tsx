import { recentWeeksOf } from "@keylow/core";
import { render, screen } from "@testing-library/react-native";

import { WeeklyStreakCard } from "../components/WeeklyStreakCard";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { WeeklyStreakCardProps } from "../components/WeeklyStreakCard";
import type { WeekRecord } from "@keylow/core";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// Thursday 19 November 2026, so this week began on Monday the 16th. The board's training streak: weeks
// W3 to W7 kept, the two before them not, and this week 2 sessions of 4.
const TODAY = "2026-11-19";
const week = (weekStart: string, achieved: number, required: number): WeekRecord => ({
  weekStart,
  achieved,
  required,
});
const trainingWeeks = [
  week("2026-10-12", 4, 4),
  week("2026-10-19", 4, 4),
  week("2026-10-26", 4, 4),
  week("2026-11-02", 4, 4),
  week("2026-11-09", 4, 4),
  week("2026-11-16", 2, 4),
];

describe("WeeklyStreakCard", () => {
  let styles: string;

  beforeAll(async () => {
    styles = await compileKitStyles("", ["components/WeeklyStreakCard"]);
  });

  beforeEach(() => {
    registerAppStyles(styles);
  });

  async function renderCard(props: WeeklyStreakCardProps) {
    await render(
      <ThemeProvider fixedPreference="dark">
        <WeeklyStreakCard {...props} />
      </ThemeProvider>,
    );
  }

  describe("training", () => {
    const training: WeeklyStreakCardProps = {
      kind: "training",
      streak: { current: 6, longest: 9, thisWeek: "at_risk" },
      recent: recentWeeksOf(trainingWeeks, TODAY, 8),
    };

    it("should title the streak and give the best", async () => {
      await renderCard(training);

      expect(screen.getByText("6-week training streak")).toBeOnTheScreen();
      expect(screen.getByText("Best 9")).toBeOnTheScreen();
    });

    it("should say how many sessions are done and how many more keep the streak", async () => {
      await renderCard(training);

      expect(
        screen.getByText("2 of 4 sessions this week. 2 more by Sunday to keep it."),
      ).toBeOnTheScreen();
    });

    it("should draw the last eight weeks, this week last, each with its state", async () => {
      await renderCard(training);

      expect(screen.getByLabelText("Last 8 weeks")).toBeOnTheScreen();
      expect(screen.getByLabelText("W1, missed")).toBeOnTheScreen();
      expect(screen.getByLabelText("W3, complete")).toBeOnTheScreen();
      expect(screen.getByLabelText("W7, complete")).toBeOnTheScreen();
      expect(screen.getByLabelText("Now, at risk")).toBeOnTheScreen();
    });

    it("should name no weight", async () => {
      await renderCard(training);

      expect(screen.queryByText(/\bkg\b|\blb\b|\bst\b/)).not.toBeOnTheScreen();
    });

    it("should still show a streak of nothing", async () => {
      await renderCard({
        kind: "training",
        streak: { current: 0, longest: 0, thisWeek: "at_risk" },
        recent: recentWeeksOf([week("2026-11-16", 0, 3)], TODAY, 8),
      });

      expect(screen.getByText("Start a training streak this week")).toBeOnTheScreen();
      expect(screen.queryByText(/^Best/)).not.toBeOnTheScreen();
      expect(
        screen.getByText("0 of 3 sessions this week. 3 more by Sunday to keep it."),
      ).toBeOnTheScreen();
    });
  });

  describe("weigh-in", () => {
    it("should say the week has a weigh-in, with the best", async () => {
      await renderCard({
        kind: "weigh_in",
        streak: { current: 9, longest: 14, thisWeek: "complete" },
      });

      expect(screen.getByText("9-week weigh-in streak")).toBeOnTheScreen();
      expect(screen.getByText("Weighed in this week. Best 14 weeks.")).toBeOnTheScreen();
    });

    it("should invite a first streak and leave the best out while it is 0", async () => {
      await renderCard({
        kind: "weigh_in",
        streak: { current: 0, longest: 0, thisWeek: "at_risk" },
      });

      expect(screen.getByText("Start a weigh-in streak this week")).toBeOnTheScreen();
      expect(screen.getByText("Weigh in by Sunday to keep it.")).toBeOnTheScreen();
    });

    it("should ask for a weigh-in when the week is at risk", async () => {
      await renderCard({
        kind: "weigh_in",
        streak: { current: 9, longest: 14, thisWeek: "at_risk" },
      });

      expect(screen.getByText("Weigh in by Sunday to keep it. Best 14 weeks.")).toBeOnTheScreen();
    });
  });
});
