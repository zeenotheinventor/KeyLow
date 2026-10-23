import "../../test/support/gestureHandler";

import { KeyLowProvider, useWeighIns, useWeightTrend } from "@keylow/api-client";
import {
  WEIGHT_RANGE_LABELS,
  describeChartName,
  describeRateBadge,
  describeSettlingLine,
} from "@keylow/core/copy";
import { addCalendarDays, toLocalDate } from "@keylow/core/dates";
import { computeTrend } from "@keylow/core/engine";
import { WEIGHT_RANGES, rangeWindow, weeklyRateKg } from "@keylow/core/weight";
import { render, screen, userEvent, waitFor } from "@testing-library/react-native";

import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../../test/support/kitStyles";
import { registerAppStyles } from "../../test/support/nativeWindStyles";
import { resolvedColor } from "../../test/support/themeColor";
import {
  createWeightQueryClient,
  resetWeightBackend,
  weightBackend,
  weightClient,
  weighInRow,
} from "../../test/support/weightBackend";
import { WeightChart } from "../WeightChart";
import { WeightTrendCard } from "./WeightTrendCard";

import type { WeightChartData } from "../WeightChart";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// The real chart, wrapped so a test can read what the card gave it.
jest.mock("../WeightChart", () => {
  const actual = jest.requireActual<typeof import("../WeightChart")>("../WeightChart");
  return { ...actual, WeightChart: jest.fn(actual.WeightChart) };
});

// The real engine, wrapped so a test can count how often the trend is worked out.
jest.mock("@keylow/core/engine", () => {
  const actual = jest.requireActual<typeof import("@keylow/core/engine")>("@keylow/core/engine");
  return { ...actual, computeTrend: jest.fn(actual.computeTrend) };
});

const chartMock = jest.mocked(WeightChart);
const computeTrendMock = jest.mocked(computeTrend);

const today = () => toLocalDate(new Date(), "Europe/London");
const dayOf = (daysAgo: number) => addCalendarDays(today(), -daysAgo);

// Readings are taken in UTC, so the time reads as written whatever the season.
const reading = (daysAgo: number, weightKg: number) =>
  weighInRow({ localDate: dayOf(daysAgo), utcTime: "07:30", weightKg, timeZone: "UTC" });

// 91 days of a steady loss of 0.3 kg a week, newest first as the list reads them.
function seedLoss() {
  weightBackend.weighIns = Array.from({ length: 91 }, (_, daysAgo) =>
    reading(daysAgo, Math.round((80 + daysAgo * (0.3 / 7)) * 1000) / 1000),
  );
}

// The seed's shape: a daily weigher around 82 kg with a five day gap, one reading of 99 kg the trend
// leaves out, and a day with two readings.
function seedWithGapAndOutlier() {
  const gap = new Set([12, 11, 10, 9, 8]);
  const rows = Array.from({ length: 61 }, (_, daysAgo) => daysAgo)
    .filter((daysAgo) => !gap.has(daysAgo))
    .map((daysAgo) => reading(daysAgo, daysAgo === 20 ? 99 : 82 + (daysAgo % 3) * 0.2));
  weightBackend.weighIns = [reading(3, 81.4), ...rows];
}

// The screen reads the weigh-ins and the trend and gives them to the card, which this does the same way.
function CardOverBackend() {
  const weighIns = useWeighIns();
  const trend = useWeightTrend();

  return weighIns.data === undefined ? null : (
    <WeightTrendCard today={today()} trend={trend} weighIns={weighIns.data} />
  );
}

async function renderCard() {
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={weightClient} queryClient={createWeightQueryClient()}>
        <CardOverBackend />
      </KeyLowProvider>
    </ThemeProvider>,
  );
  await screen.findByLabelText("Trend weight");
}

function latestChartProps() {
  const call = chartMock.mock.calls.at(-1);
  if (call === undefined) {
    throw new Error("the chart was never drawn");
  }
  return call[0];
}

const chartData = (): WeightChartData => latestChartProps().data;

describe("the trend card", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetWeightBackend();
    chartMock.mockClear();
    computeTrendMock.mockClear();
  });

  describe("settled", () => {
    it("should be the Trend weight card with the weekly rate", async () => {
      seedLoss();
      await renderCard();

      expect(screen.getByText("Trend weight")).toBeOnTheScreen();
      expect(screen.getByText("−0.3 kg a week")).toBeOnTheScreen();
    });

    it("should draw the rate in the accent tone", async () => {
      seedLoss();
      await renderCard();

      expect(screen.getByText("−0.3 kg a week")).toHaveStyle({
        color: resolvedColor("dark", "accent"),
      });
    });

    it("should work the rate out from the series", async () => {
      seedLoss();
      await renderCard();

      const points = computeTrend(
        weightBackend.weighIns.map((row) => ({
          localDate: String(row["local_date"]),
          weightKg: Number(row["weight_kg"]),
        })),
      );
      const rate = weeklyRateKg(points);

      expect(rate).not.toBeNull();
      expect(screen.getByText(describeRateBadge(rate ?? 0))).toBeOnTheScreen();
    });

    it("should show the trend to one decimal in kg", async () => {
      seedLoss();
      await renderCard();

      const trendKg = chartData().latest?.trendKg ?? 0;

      expect(screen.getByText((Math.round(trendKg * 10) / 10).toFixed(1))).toBeOnTheScreen();
      expect(screen.getByText("kg")).toBeOnTheScreen();
    });

    it("should say when the last weigh-in was and which way the average went", async () => {
      seedLoss();
      await renderCard();

      expect(
        screen.getByText(/^Last weigh-in \d+\.\d kg today\. Average loss over the last 7 days\.$/),
      ).toBeOnTheScreen();
    });

    it("should not draw the chart dashed", async () => {
      seedLoss();
      await renderCard();

      expect(latestChartProps().isSettling).toBe(false);
    });
  });

  describe("settling", () => {
    beforeEach(() => {
      weightBackend.weighIns = [reading(0, 82), reading(1, 82.2), reading(2, 82.4)];
    });

    it("should show the Settling badge and no rate", async () => {
      await renderCard();

      expect(screen.getByText("Settling")).toBeOnTheScreen();
      expect(screen.queryByText(/a week$/)).not.toBeOnTheScreen();
    });

    it("should draw the Settling badge in the warning tone", async () => {
      await renderCard();

      expect(screen.getByText("Settling")).toHaveStyle({ color: resolvedColor("dark", "warning") });
    });

    it("should say how many weigh-ins it still needs", async () => {
      await renderCard();

      expect(screen.getByText(describeSettlingLine(3))).toBeOnTheScreen();
      expect(screen.getByText("Settles after 7 weigh-ins. 3 of 7 so far.")).toBeOnTheScreen();
    });

    it("should draw the chart dashed", async () => {
      await renderCard();

      expect(latestChartProps().isSettling).toBe(true);
    });
  });

  describe("the range control", () => {
    it("should offer 1 week, 30 days, 90 days and 1 year with 90 days chosen", async () => {
      seedLoss();
      await renderCard();

      const radios = screen.getAllByRole("radio");

      expect(radios).toHaveLength(WEIGHT_RANGES.length);
      WEIGHT_RANGES.forEach((range, position) => {
        expect(radios[position]).toHaveAccessibleName(WEIGHT_RANGE_LABELS[range]);
      });
      expect(screen.getByRole("radio", { name: "90 days", checked: true })).toBeOnTheScreen();
    });

    it("should be a group named Chart range", async () => {
      seedLoss();
      await renderCard();

      // The role query does not resolve a radiogroup, so the group is found by its name.
      expect(screen.getByLabelText("Chart range")).toHaveProp("role", "radiogroup");
    });

    it.each(WEIGHT_RANGES)(
      "should draw exactly the %i day window when it is chosen",
      async (range) => {
        const user = userEvent.setup();
        seedLoss();
        await renderCard();

        await user.press(screen.getByRole("radio", { name: WEIGHT_RANGE_LABELS[range] }));

        expect(chartData().range).toBe(range);
        expect(chartData().window).toEqual(rangeWindow(range, today()));
        expect(
          screen.getByRole("radio", { name: WEIGHT_RANGE_LABELS[range], checked: true }),
        ).toBeOnTheScreen();
      },
    );

    it("should name the chart for the range chosen, with the trend", async () => {
      const user = userEvent.setup();
      seedLoss();
      await renderCard();
      const trendKg = chartData().latest?.trendKg ?? 0;

      await user.press(screen.getByRole("radio", { name: "1 week" }));

      expect(screen.getByRole("image", { name: describeChartName(7, trendKg) })).toBeOnTheScreen();
      expect(
        screen.getByRole("image", { name: /^Weight over the last week, trend \d+\.\d kg$/ }),
      ).toBeOnTheScreen();
    });

    it("should work the trend out once for the data and never again for a range", async () => {
      const user = userEvent.setup();
      seedLoss();
      await renderCard();
      const callsForTheData = computeTrendMock.mock.calls.length;

      for (const range of WEIGHT_RANGES) {
        await user.press(screen.getByRole("radio", { name: WEIGHT_RANGE_LABELS[range] }));
      }

      expect(callsForTheData).toBeGreaterThan(0);
      expect(computeTrendMock).toHaveBeenCalledTimes(callsForTheData);
    });
  });

  describe("what the chart is given", () => {
    it("should hold the readings without the left out one, and that one apart", async () => {
      seedWithGapAndOutlier();
      await renderCard();

      const data = chartData();

      expect(data.readings.map((point) => point.weightKg)).not.toContain(99);
      expect(data.leftOut.map((point) => point.weightKg)).toEqual([99]);
    });

    it("should hold both readings of a day that has two", async () => {
      seedWithGapAndOutlier();
      await renderCard();

      expect(chartData().readings.filter((point) => point.date === dayOf(3))).toHaveLength(2);
    });

    it("should hold the filled days and a trend line with a point for each day", async () => {
      seedWithGapAndOutlier();
      await renderCard();

      const data = chartData();

      expect(data.filledDays.map((point) => point.date)).toEqual([
        dayOf(12),
        dayOf(11),
        dayOf(10),
        dayOf(9),
        dayOf(8),
      ]);
      expect(data.trend).toHaveLength(61);
      expect(data.latest).toEqual(data.trend.at(-1));
    });

    it("should hold the trend values the hook gives for the same rows", async () => {
      seedWithGapAndOutlier();
      await renderCard();

      const points = computeTrend(
        weightBackend.weighIns.map((row) => ({
          localDate: String(row["local_date"]),
          weightKg: Number(row["weight_kg"]),
        })),
      );

      expect(chartData().trend.map((point) => point.trendKg)).toEqual(
        points.map((point) => point.trendKg),
      );
    });

    it("should hold nothing to draw for a range with no weigh-ins, without throwing", async () => {
      const user = userEvent.setup();
      weightBackend.weighIns = [reading(40, 82), reading(41, 82.2)];
      await renderCard();

      await user.press(screen.getByRole("radio", { name: "1 week" }));

      expect(chartData()).toMatchObject({ readings: [], leftOut: [], trend: [], latest: null });
    });
  });

  describe("for a screen reader", () => {
    it("should be one image named for the range and the trend", async () => {
      seedLoss();
      await renderCard();
      const trendKg = chartData().latest?.trendKg ?? 0;

      expect(screen.getAllByRole("image")).toHaveLength(1);
      expect(screen.getByRole("image", { name: describeChartName(90, trendKg) })).toBeOnTheScreen();
    });

    it("should write the legend under the chart", async () => {
      seedLoss();
      await renderCard();

      expect(screen.getByText("Trend")).toBeOnTheScreen();
      expect(screen.getByText("Weigh-in")).toBeOnTheScreen();
      expect(screen.getByText("Left out")).toBeOnTheScreen();
    });
  });

  describe("health data", () => {
    it("should write no weight or date to the console", async () => {
      const spies = (["log", "info", "warn", "error"] as const).map((level) =>
        jest.spyOn(console, level).mockImplementation(() => undefined),
      );
      seedWithGapAndOutlier();
      await renderCard();
      await waitFor(() => {
        expect(screen.getByText(/^Last weigh-in/)).toBeOnTheScreen();
      });

      for (const spy of spies) {
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
      }
    });
  });
});
