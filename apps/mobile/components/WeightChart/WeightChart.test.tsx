import "../../test/support/gestureHandler";

import { addCalendarDays } from "@keylow/core/dates";
import { computeTrend } from "@keylow/core/engine";
import { themes } from "@keylow/tokens";
import { isHiddenFromAccessibility, screen } from "@testing-library/react-native";

import { plotPadding } from "./layout";
import { prepareWeightChart } from "./prepareWeightChart";
import { WeightChart } from "./WeightChart";
import { renderChart } from "../../test/support/chartRender";

import type { WeightRange } from "@keylow/core/weight";
import type { ThemeScheme } from "@keylow/tokens";
import type { ReactElement } from "react";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// Skia draws nothing in Jest, so Victory never calls for the drawing. This stands in for the parts of it the
// chart uses: the chart calls its children with a point for each row and each series, and the lines and
// points it draws are views that keep the props they were given, so a test can read what would be drawn.
jest.mock("victory-native", () => {
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  return {
    CartesianChart: (props: {
      data: ({ day: number } & Record<string, number | null>)[];
      yKeys: string[];
      domain: unknown;
      padding: unknown;
      children: (arguments_: { points: Record<string, unknown[]> }) => import("react").ReactNode;
    }) =>
      createElement(
        "CartesianChart",
        { domain: props.domain, padding: props.padding },
        props.children({
          points: Object.fromEntries(
            props.yKeys.map((key) => [
              key,
              props.data.map((row) => ({
                x: row.day * 10,
                xValue: row.day,
                y: row[key] ?? null,
                yValue: row[key] ?? null,
              })),
            ]),
          ),
        }),
      ),
    Line: (props: object) => createElement("Line", props),
    Scatter: (props: object) => createElement("Scatter", props),
  };
});

const today = "2026-10-23";
const dayOf = (daysAgo: number) => addCalendarDays(today, -daysAgo);

type Reading = { local_date: string; weight_kg: number };

// 61 days around 82 kg with a five day gap, a 99 kg reading the trend leaves out and a second reading on one day.
function seedLikeReadings(): Reading[] {
  const gap = new Set([12, 11, 10, 9, 8]);
  const readings: Reading[] = [];
  for (let daysAgo = 60; daysAgo >= 0; daysAgo -= 1) {
    if (!gap.has(daysAgo)) {
      readings.push({
        local_date: dayOf(daysAgo),
        weight_kg: daysAgo === 20 ? 99 : 82 + (daysAgo % 3) * 0.2,
      });
    }
  }
  readings.push({ local_date: dayOf(3), weight_kg: 81.4 });
  return readings;
}

function chartOf(range: WeightRange, readings: readonly Reading[] = seedLikeReadings()) {
  const points = computeTrend(
    readings.map((reading) => ({ localDate: reading.local_date, weightKg: reading.weight_kg })),
  );
  return prepareWeightChart({ points, weighIns: readings, range, today });
}

async function drawChart(
  range: WeightRange,
  { isSettling = false, readings }: { isSettling?: boolean; readings?: readonly Reading[] } = {},
  scheme: ThemeScheme = "dark",
) {
  const chart: ReactElement = (
    <WeightChart data={chartOf(range, readings)} isSettling={isSettling} name="The chart" />
  );
  await renderChart(chart, scheme);
}

const hiddenToo = { includeHiddenElements: true };

type Plotted = { xValue: number; y: number | null };

function drawn(type: "Line" | "Scatter") {
  return (screen.root?.queryAll((node) => node.type === type) ?? []).map((node) => ({
    color: node.props.color as unknown,
    radius: node.props.radius as unknown,
    style: node.props.style as unknown,
    strokeWidth: node.props.strokeWidth as unknown,
    children: node.props.children as { props: { intervals: number[] } } | null | undefined,
    points: node.props.points as Plotted[],
  }));
}

const plottedDays = (series: { points: Plotted[] }) =>
  series.points.filter((point) => point.y !== null).map((point) => point.xValue);

const colours = (scheme: ThemeScheme) => themes[scheme];

describe("WeightChart", () => {
  describe("for a screen reader", () => {
    it("should be one image named by the caller", async () => {
      await drawChart(90);

      expect(screen.getAllByRole("img")).toHaveLength(1);
      expect(screen.getByRole("img", { name: "The chart" })).toBeOnTheScreen();
    });

    it("should hide the axis values and dates from a screen reader", async () => {
      await drawChart(90);

      for (const text of [
        ...screen.getAllByText(/^\d+$/, hiddenToo),
        screen.getByText("Today", hiddenToo),
      ]) {
        expect(isHiddenFromAccessibility(text)).toBe(true);
      }
    });
  });

  describe("the axes", () => {
    it("should write the whole kilograms of the y axis", async () => {
      await drawChart(90);

      const axis = chartOf(90).yAxis;

      expect(
        screen.getAllByText(/^\d+$/, hiddenToo).map((text) => Number(text.props.children)),
      ).toEqual(axis?.ticks);
    });

    it("should write the first day, the middle day and today under the plot", async () => {
      await drawChart(7);

      for (const label of chartOf(7).xLabels) {
        expect(screen.getByText(label, hiddenToo)).toBeOnTheScreen();
      }
    });

    it("should give the plot the room the labels and the marker need", async () => {
      await drawChart(90);

      const chart = screen.root?.queryAll((node) => node.type === "CartesianChart")[0];

      expect(chart?.props.padding).toEqual(plotPadding);
      expect(chart?.props.domain).toEqual({
        x: [0, 89],
        y: [chartOf(90).yAxis?.min, chartOf(90).yAxis?.max],
      });
    });
  });

  describe("the trend line", () => {
    it("should be one line through every day, 2.25 wide and in the trend colour", async () => {
      await drawChart(30);

      const [line, ...others] = drawn("Line");

      expect(others).toHaveLength(0);
      expect(plottedDays(line ?? { points: [] })).toEqual(
        chartOf(30).trend.map((point) => point.dayIndex),
      );
      expect(line?.strokeWidth).toBe(2.25);
      expect(line?.color).toBe(colours("dark")["chart-trend"]);
    });

    it("should be broken between two runs of readings", async () => {
      const apart: Reading[] = [
        ...[80, 79, 78, 77, 76].map((daysAgo) => ({ local_date: dayOf(daysAgo), weight_kg: 82 })),
        ...[5, 4, 3, 2, 1].map((daysAgo) => ({ local_date: dayOf(daysAgo), weight_kg: 81 })),
      ];
      await drawChart(90, { readings: apart });

      expect(drawn("Line")).toHaveLength(2);
    });

    it("should be solid when the trend has settled", async () => {
      await drawChart(90);

      expect(drawn("Line")[0]?.children ?? null).toBeNull();
    });

    it("should be dashed, 5 on and 4 off, while the trend settles", async () => {
      await drawChart(90, { isSettling: true });

      expect(drawn("Line")[0]?.children?.props.intervals).toEqual([5, 4]);
    });
  });

  describe("the points", () => {
    it("should draw a dot for each reading except the left out one, 2.6 wide", async () => {
      await drawChart(90);

      const [readings] = drawn("Scatter");

      expect(readings?.radius).toBe(2.6);
      expect(readings?.color).toBe(colours("dark")["chart-point"]);
      expect(readings?.points.filter((point) => point.y !== null)).toHaveLength(
        chartOf(90).readings.length,
      );
      expect(readings?.points.map((point) => point.y)).not.toContain(99);
    });

    it("should draw smaller dots on the 1 year range", async () => {
      await drawChart(365);

      expect(drawn("Scatter")[0]?.radius).toBe(1.6);
    });

    it("should ring the left out reading, larger and in the warning colour", async () => {
      await drawChart(90);

      const rings = drawn("Scatter").find((series) => series.color === colours("dark").warning);

      expect(rings?.style).toBe("stroke");
      expect(rings?.radius).toBe(3.5);
      expect(rings?.strokeWidth).toBe(1.75);
      expect(rings?.points.filter((point) => point.y !== null).map((point) => point.y)).toEqual([
        99,
      ]);
    });

    it("should mark each filled day with a small dashed ring on the line", async () => {
      await drawChart(30);

      const filled = drawn("Scatter").find((series) => series.radius === 2.2);

      expect(plottedDays(filled ?? { points: [] })).toEqual(
        chartOf(30).filledDays.map((day) => day.dayIndex),
      );
      expect(filled?.style).toBe("stroke");
      expect(filled?.children?.props.intervals).toEqual([2, 2]);
    });

    it("should not mark filled days on the 1 year range", async () => {
      await drawChart(365);

      const filled = drawn("Scatter").find((series) => series.radius === 2.2);

      expect(filled).toBeUndefined();
    });

    it("should mark the latest trend value, 4.5 wide, in the marker colour with a ring of the surface colour", async () => {
      await drawChart(90);

      const marker = drawn("Scatter").find(
        (series) => series.color === colours("dark")["chart-marker"],
      );
      const ring = drawn("Scatter").find((series) => series.color === colours("dark").surface);
      const latestDay = chartOf(90).latest?.dayIndex;

      expect(marker?.radius).toBe(4.5);
      expect(plottedDays(marker ?? { points: [] })).toEqual([latestDay]);
      expect(ring?.style).toBe("stroke");
      expect(ring?.strokeWidth).toBe(2);
      expect(ring?.radius).toBe(4.5);
      expect(plottedDays(ring ?? { points: [] })).toEqual([latestDay]);
    });

    it("should draw in the light colours in the light scheme", async () => {
      await drawChart(90, {}, "light");

      expect(drawn("Line")[0]?.color).toBe(colours("light")["chart-trend"]);
      expect(drawn("Scatter")[0]?.color).toBe(colours("light")["chart-point"]);
    });
  });

  describe("a range with no points", () => {
    it("should draw no data and still name the days", async () => {
      await drawChart(7, { readings: [{ local_date: dayOf(40), weight_kg: 82 }] });

      expect(drawn("Line")).toHaveLength(0);
      expect(drawn("Scatter")).toHaveLength(0);
      expect(screen.getByText("Today", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByRole("img", { name: "The chart" })).toBeOnTheScreen();
    });
  });
});
