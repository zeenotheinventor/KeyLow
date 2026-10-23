import { addCalendarDays } from "@keylow/core/dates";
import { computeTrend } from "@keylow/core/engine";
import { rangeWindow } from "@keylow/core/weight";

import { prepareWeightChart } from "./prepareWeightChart";

import type { WeightRange } from "@keylow/core/weight";

const today = "2026-10-23";

const dayOf = (daysAgo: number) => addCalendarDays(today, -daysAgo);

type Reading = { local_date: string; weight_kg: number };

// The seed's shape: a daily weigher around 82 kg for 61 days, with a five day gap, one reading of 99 kg
// that the trend leaves out, and a day with two readings.
function seedLikeReadings(): Reading[] {
  const gap = new Set([12, 11, 10, 9, 8]);
  const readings: Reading[] = [];
  for (let daysAgo = 60; daysAgo >= 0; daysAgo -= 1) {
    if (!gap.has(daysAgo)) {
      readings.push({ local_date: dayOf(daysAgo), weight_kg: 82 + (daysAgo % 3) * 0.2 });
    }
  }
  const outlier = readings.find((reading) => reading.local_date === dayOf(20));
  if (outlier !== undefined) {
    outlier.weight_kg = 99;
  }
  readings.push({ local_date: dayOf(3), weight_kg: 81.4 });
  return readings;
}

function prepare(range: WeightRange, readings: readonly Reading[] = seedLikeReadings()) {
  const points = computeTrend(
    readings.map((reading) => ({ localDate: reading.local_date, weightKg: reading.weight_kg })),
  );
  return { points, chart: prepareWeightChart({ points, weighIns: readings, range, today }) };
}

describe("prepareWeightChart", () => {
  describe("the window", () => {
    it.each([7, 30, 90, 365] as const)(
      "should cover exactly the dates of the %i day range",
      (range) => {
        const { chart } = prepare(range);

        expect(chart.window).toEqual(rangeWindow(range, today));
      },
    );

    it("should keep only the trend points inside the range, one for each day", () => {
      const { chart } = prepare(30);

      expect(chart.trend.map((point) => point.date)).toEqual(
        Array.from({ length: 30 }, (_, index) => dayOf(29 - index)),
      );
    });

    it("should place a day by how many days it is after the window starts", () => {
      const { chart } = prepare(30);

      expect(chart.trend[0]?.dayIndex).toBe(0);
      expect(chart.trend.at(-1)?.dayIndex).toBe(29);
    });

    it("should start the trend where the readings start when the range reaches further back", () => {
      const { chart } = prepare(365);

      expect(chart.trend).toHaveLength(61);
      expect(chart.trend[0]?.dayIndex).toBe(365 - 61);
    });
  });

  describe("the points", () => {
    it("should draw every reading in the range except the left out one", () => {
      const { chart } = prepare(90);

      expect(chart.readings.map((reading) => reading.weightKg)).not.toContain(99);
      expect(chart.readings).toHaveLength(seedLikeReadings().length - 1);
    });

    it("should list the left out reading apart from the others", () => {
      const { chart } = prepare(90);

      expect(chart.leftOut).toEqual([{ date: dayOf(20), dayIndex: 89 - 20, weightKg: 99 }]);
    });

    it("should draw both readings of a day that has two", () => {
      const { chart } = prepare(7);

      expect(
        chart.readings.filter((reading) => reading.date === dayOf(3)).map((r) => r.weightKg),
      ).toEqual(expect.arrayContaining([81.4, 82]));
    });

    it("should leave out a left out reading that is outside the range", () => {
      const { chart } = prepare(7);

      expect(chart.leftOut).toEqual([]);
    });

    it("should mark the filled days, and not the left out day", () => {
      const { chart } = prepare(30);

      expect(chart.filledDays.map((point) => point.date)).toEqual([
        dayOf(12),
        dayOf(11),
        dayOf(10),
        dayOf(9),
        dayOf(8),
      ]);
    });

    it("should put the latest marker on the last trend point", () => {
      const { chart, points } = prepare(90);

      expect(chart.latest).toEqual(chart.trend.at(-1));
      expect(chart.latest?.trendKg).toBe(points.at(-1)?.trendKg);
    });

    it("should give the trend values as the engine computed them", () => {
      const { chart, points } = prepare(90);

      expect(chart.trend.map((point) => point.trendKg)).toEqual(
        points.filter((point) => point.date >= chart.window.from).map((point) => point.trendKg),
      );
    });
  });

  describe("the y axis", () => {
    it("should label whole kilograms from below the lowest value to above the highest", () => {
      const { chart } = prepare(7);

      expect(chart.yAxis).toEqual({ min: 80, max: 83, ticks: [80, 81, 82, 83] });
    });

    it("should step by two kilograms when the span is over six", () => {
      const { chart } = prepare(90);

      expect(chart.yAxis).toEqual({
        min: 80,
        max: 100,
        ticks: [80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100],
      });
    });

    it("should keep a step of one kilogram when the span is exactly six", () => {
      // 80 and 84 kg open the axis from 79 to 85.
      const { chart } = prepare(7, [
        { local_date: dayOf(1), weight_kg: 80 },
        { local_date: dayOf(0), weight_kg: 84 },
      ]);

      expect(chart.yAxis).toEqual({ min: 79, max: 85, ticks: [79, 80, 81, 82, 83, 84, 85] });
    });

    it("should step by two kilograms when the span is seven", () => {
      // 80 and 85 kg open the axis from 79 to 86.
      const { chart } = prepare(7, [
        { local_date: dayOf(1), weight_kg: 80 },
        { local_date: dayOf(0), weight_kg: 85 },
      ]);

      expect(chart.yAxis).toEqual({ min: 79, max: 86, ticks: [79, 81, 83, 85] });
    });

    it("should have no axis without a point in the window", () => {
      const { chart } = prepare(7, [{ local_date: dayOf(40), weight_kg: 82 }]);

      expect(chart.yAxis).toBeNull();
    });
  });

  describe("the x labels", () => {
    it("should name the first day, the middle day and today", () => {
      const { chart } = prepare(7);

      expect(chart.xLabels).toEqual(["17 Oct", "20 Oct", "Today"]);
    });

    it("should put the middle label on the middle day of an even range", () => {
      const { chart } = prepare(30);

      // 30 days run from 24 Sep to 23 Oct, and the board rounds the middle up: 14.5 days ago is 15.
      expect(chart.xLabels).toEqual(["24 Sep", "8 Oct", "Today"]);
    });
  });

  describe("a window with no points", () => {
    it("should be empty and not throw", () => {
      const { chart } = prepare(7, [{ local_date: dayOf(40), weight_kg: 82 }]);

      expect(chart).toMatchObject({
        readings: [],
        leftOut: [],
        trend: [],
        filledDays: [],
        latest: null,
      });
    });

    it("should be empty without any weigh-ins", () => {
      const { chart } = prepare(90, []);

      expect(chart.trend).toEqual([]);
    });
  });
});
