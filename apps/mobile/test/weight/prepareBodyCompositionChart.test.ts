import { WEIGHT_SCREEN, describeChartDate } from "@keylow/core/copy";
import { addCalendarDays } from "@keylow/core/dates";
import { rangeWindow } from "@keylow/core/weight";

import { prepareBodyCompositionChart } from "../../components/BodyCompositionChart";

import type { CompositionInputPoint } from "../../components/BodyCompositionChart";
import type { WeightRange } from "@keylow/core/weight";

// The folder's public surface also holds the figure, which reads the saved Appearance setting.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const today = "2026-10-23";

const dayOf = (daysAgo: number) => addCalendarDays(today, -daysAgo);

const pointOf = (
  daysAgo: number,
  { fat = 20, lean = 60, segment = 0 }: { fat?: number; lean?: number; segment?: number } = {},
): CompositionInputPoint => ({ date: dayOf(daysAgo), segment, fat, lean });

// One point a day for the last `days` days, the body fat falling a little and the lean mass staying about level.
const everyDay = (days: number): CompositionInputPoint[] =>
  Array.from({ length: days }, (_, index) => {
    const daysAgo = days - 1 - index;
    return pointOf(daysAgo, { fat: 22 - index * 0.02, lean: 63 + (index % 3) * 0.1 });
  });

const prepare = (points: readonly CompositionInputPoint[], range: WeightRange = 90) =>
  prepareBodyCompositionChart({ points, range, today });

describe("prepareBodyCompositionChart", () => {
  describe("the window", () => {
    it.each([7, 30, 90, 365] as const)(
      "should cover exactly the dates of the %i day range",
      (range) => {
        expect(prepare([], range).window).toEqual(rangeWindow(range, today));
      },
    );

    it("should carry the range, because the drawing spreads the days across it", () => {
      expect(prepare([], 30).range).toBe(30);
    });
  });

  describe("placing the points", () => {
    it("should place a day by how many days it is after the window starts", () => {
      const chart = prepare(everyDay(30), 30);

      expect(chart.bodyFat.points.map((point) => point.dayIndex)).toEqual(
        Array.from({ length: 30 }, (_, index) => index),
      );
      expect(chart.bodyFat.points[0]?.date).toBe(rangeWindow(30, today).from);
      expect(chart.bodyFat.points.at(-1)?.date).toBe(today);
    });

    it("should give each plot its own value of the same day", () => {
      const chart = prepare([pointOf(2, { fat: 21.4, lean: 64.2 })], 7);

      expect(chart.bodyFat.points.map((point) => point.value)).toEqual([21.4]);
      expect(chart.leanMass.points.map((point) => point.value)).toEqual([64.2]);
    });

    it("should keep the values as they came, with nothing worked out again", () => {
      const chart = prepare([pointOf(0, { fat: 21.4437, lean: 64.2519 })], 7);

      expect(chart.bodyFat.points[0]?.value).toBe(21.4437);
      expect(chart.leanMass.points[0]?.value).toBe(64.2519);
    });

    it("should keep the run each day belongs to, so the line breaks between runs", () => {
      const chart = prepare(
        [pointOf(5, { segment: 0 }), pointOf(4, { segment: 0 }), pointOf(1, { segment: 1 })],
        7,
      );

      expect(chart.bodyFat.points.map((point) => point.segment)).toEqual([0, 0, 1]);
      expect(chart.leanMass.points.map((point) => point.segment)).toEqual([0, 0, 1]);
    });
  });

  describe("the range filter", () => {
    it("should drop the days before the window and keep the first day of it", () => {
      const chart = prepare([pointOf(7), pointOf(6), pointOf(5)], 7);

      expect(chart.bodyFat.points.map((point) => point.date)).toEqual([dayOf(6), dayOf(5)]);
    });

    it("should drop the days after today", () => {
      const chart = prepare([pointOf(0), pointOf(-1)], 7);

      expect(chart.leanMass.points.map((point) => point.date)).toEqual([today]);
    });

    it("should only filter, so the days the range keeps are the days the input had", () => {
      const input = everyDay(100);

      expect(prepare(input, 30).bodyFat.points.map((point) => point.value)).toEqual(
        input.slice(-30).map((point) => point.fat),
      );
    });
  });

  describe("the latest point", () => {
    it("should be the last point of each plot", () => {
      const chart = prepare([pointOf(3, { fat: 22 }), pointOf(1, { fat: 21.5, lean: 64 })], 7);

      expect(chart.bodyFat.latest).toEqual({
        date: dayOf(1),
        dayIndex: 5,
        value: 21.5,
        segment: 0,
      });
      expect(chart.leanMass.latest?.value).toBe(64);
    });

    it("should be null with no point in the range", () => {
      const chart = prepare([pointOf(40)], 7);

      expect(chart.bodyFat.latest).toBeNull();
      expect(chart.leanMass.latest).toBeNull();
    });
  });

  describe("the x labels", () => {
    it("should be the first day, the middle day and today, as the weight chart has them", () => {
      expect(prepare([], 7).xLabels).toEqual([
        describeChartDate(dayOf(6)),
        describeChartDate(dayOf(3)),
        WEIGHT_SCREEN.chartToday,
      ]);
    });

    it("should put the middle day half way across a longer range", () => {
      expect(prepare([], 90).xLabels).toEqual([
        describeChartDate(dayOf(89)),
        describeChartDate(dayOf(45)),
        WEIGHT_SCREEN.chartToday,
      ]);
    });
  });

  describe("a range with no point", () => {
    it("should have no points and no axis, so the figure draws the grids and no line", () => {
      const chart = prepare([pointOf(40)], 7);

      expect(chart.bodyFat).toEqual({ points: [], latest: null, yAxis: null });
      expect(chart.leanMass).toEqual({ points: [], latest: null, yAxis: null });
    });
  });

  describe("the y axis of each plot", () => {
    // The body fat values, one a day ending today.
    const axisOf = (fat: number[]) =>
      prepare(
        fat.map((value, index) => pointOf(fat.length - 1 - index, { fat: value })),
        90,
      ).bodyFat.yAxis;

    it("should label whole numbers 17, 18 and 19 for values from 18.1 to 18.4", () => {
      expect(axisOf([18.1, 18.4])).toEqual({ min: 17, max: 19, ticks: [17, 18, 19] });
    });

    it("should keep to 4 whole number ticks that hold every value from 62.5 to 70.2", () => {
      const axis = axisOf([62.5, 66, 70.2]);

      expect(axis?.ticks).toEqual([60, 65, 70, 75]);
      expect(axis?.min).toBeLessThanOrEqual(62.5);
      expect(axis?.max).toBeGreaterThanOrEqual(70.2);
    });

    it("should leave 0.5 above and below the values before it rounds out", () => {
      expect(axisOf([18, 19])).toEqual({ min: 17, max: 20, ticks: [17, 18, 19, 20] });
    });

    it("should take the smallest step of 1, 2, 5, 10 or 20 that keeps to 4 ticks", () => {
      expect(axisOf([10.2, 12.8])?.ticks).toEqual([8, 10, 12, 14]);
      expect(axisOf([40, 62])?.ticks).toEqual([20, 40, 60, 80]);
    });

    it("should keep to 4 ticks however wide the values are", () => {
      expect(axisOf([30, 130])?.ticks).toEqual([0, 50, 100, 150]);
    });

    it.each([[[18.1, 18.4]], [[62.5, 70.2]], [[40, 62]], [[3.2, 3.2]], [[99.9, 100.1]]])(
      "should keep to at most 4 evenly spaced whole number ticks round %j",
      (values) => {
        const axis = axisOf(values);
        const ticks = axis?.ticks ?? [];
        const steps = ticks.slice(1).map((tick, index) => tick - (ticks[index] ?? 0));

        expect(ticks.length).toBeLessThanOrEqual(4);
        expect(ticks.length).toBeGreaterThanOrEqual(2);
        expect(ticks.every(Number.isInteger)).toBe(true);
        expect(new Set(steps).size).toBe(1);
        expect(axis?.min).toBe(ticks[0]);
        expect(axis?.max).toBe(ticks.at(-1));
        expect(axis?.min).toBeLessThanOrEqual(Math.min(...values));
        expect(axis?.max).toBeGreaterThanOrEqual(Math.max(...values));
      },
    );

    it("should give a single point a valid axis", () => {
      const axis = axisOf([20.2]);

      expect(axis).toEqual({ min: 19, max: 21, ticks: [19, 20, 21] });
    });

    it("should give each plot an axis of its own", () => {
      const chart = prepare(
        [pointOf(1, { fat: 20.4, lean: 63.1 }), pointOf(0, { fat: 20.1, lean: 63.4 })],
        7,
      );

      expect(chart.bodyFat.yAxis?.ticks).toEqual([19, 20, 21]);
      expect(chart.leanMass.yAxis?.ticks).toEqual([62, 63, 64]);
    });
  });
});
