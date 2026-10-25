import "../support/gestureHandler";

import { addCalendarDays } from "@keylow/core/dates";
import { themes } from "@keylow/tokens";
import { isHiddenFromAccessibility, screen } from "@testing-library/react-native";

import {
  BodyCompositionChart,
  prepareBodyCompositionChart,
} from "../../components/BodyCompositionChart";
import * as stories from "../../components/BodyCompositionChart/BodyCompositionChart.stories";
import { storyStates } from "../../components/BodyCompositionChart/storyStates";
import { renderChart } from "../support/chartRender";

import type { CompositionInputPoint } from "../../components/BodyCompositionChart";
import type { WeightRange } from "@keylow/core/weight";
import type { ThemeScheme } from "@keylow/tokens";

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

// 61 days of body fat falling from about 22 % and lean mass about level at 63 kg.
function sixtyOneDays(): CompositionInputPoint[] {
  return Array.from({ length: 61 }, (_, index) => ({
    date: dayOf(60 - index),
    segment: 0,
    fat: 22 - index * 0.02,
    lean: 63 + (index % 3) * 0.1,
  }));
}

const dataOf = (range: WeightRange, points: readonly CompositionInputPoint[] = sixtyOneDays()) =>
  prepareBodyCompositionChart({ points, range, today });

async function drawChart(
  range: WeightRange,
  {
    isSettling = false,
    points,
    scheme = "dark",
  }: { isSettling?: boolean; points?: readonly CompositionInputPoint[]; scheme?: ThemeScheme } = {},
) {
  await renderChart(
    <BodyCompositionChart data={dataOf(range, points)} isSettling={isSettling} name="The chart" />,
    scheme,
  );
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

const plottedValues = (series: { points: Plotted[] }) =>
  series.points.filter((point) => point.y !== null).map((point) => point.y);

const colours = (scheme: ThemeScheme) => themes[scheme];

describe("BodyCompositionChart", () => {
  describe("for a screen reader", () => {
    it("should be one image named by the caller", async () => {
      await drawChart(90);

      expect(screen.getAllByRole("img")).toHaveLength(1);
      expect(screen.getByRole("img", { name: "The chart" })).toBeOnTheScreen();
    });

    it("should hide the captions from a screen reader", async () => {
      await drawChart(90);

      for (const caption of [
        screen.getByText("Body fat", hiddenToo),
        screen.getByText("Lean mass", hiddenToo),
      ]) {
        expect(isHiddenFromAccessibility(caption)).toBe(true);
      }
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

  describe("the captions", () => {
    it("should name the top plot Body fat and the one under it Lean mass", async () => {
      await drawChart(90);

      const captions = screen
        .getAllByText(/^(Body fat|Lean mass)$/, hiddenToo)
        .map((caption): unknown => caption.props.children);

      expect(captions).toEqual(["Body fat", "Lean mass"]);
    });
  });

  describe("the axes", () => {
    it("should write the whole numbers of each plot's own y axis, body fat first", async () => {
      await drawChart(90);

      const { bodyFat, leanMass } = dataOf(90);

      expect(
        screen.getAllByText(/^\d+$/, hiddenToo).map((text) => Number(text.props.children)),
      ).toEqual([...(bodyFat.yAxis?.ticks ?? []), ...(leanMass.yAxis?.ticks ?? [])]);
    });

    it("should write the first day, the middle day and today once, under both plots", async () => {
      await drawChart(7);

      for (const label of dataOf(7).xLabels) {
        expect(screen.getAllByText(label, hiddenToo)).toHaveLength(1);
      }
    });

    it("should give each plot its own domain and the room the labels and the marker need", async () => {
      await drawChart(90);

      const { bodyFat, leanMass } = dataOf(90);
      const plots = screen.root?.queryAll((node) => node.type === "CartesianChart") ?? [];

      expect(plots).toHaveLength(2);
      expect(plots.map((plot): unknown => plot.props.domain)).toEqual([
        { x: [0, 89], y: [bodyFat.yAxis?.min, bodyFat.yAxis?.max] },
        { x: [0, 89], y: [leanMass.yAxis?.min, leanMass.yAxis?.max] },
      ]);
      expect(plots.map((plot): unknown => plot.props.padding)).toEqual([
        { left: 12, right: 44, top: 16, bottom: 8 },
        { left: 12, right: 44, top: 16, bottom: 8 },
      ]);
    });
  });

  describe("the lines", () => {
    it("should be one line in each plot, 2.25 wide and in the trend colour", async () => {
      await drawChart(30);

      const lines = drawn("Line");
      const { bodyFat, leanMass } = dataOf(30);

      expect(lines).toHaveLength(2);
      expect(lines.map(plottedValues)).toEqual([
        bodyFat.points.map((point) => point.value),
        leanMass.points.map((point) => point.value),
      ]);
      for (const line of lines) {
        expect(line.strokeWidth).toBe(2.25);
        expect(line.color).toBe(colours("dark")["chart-trend"]);
      }
    });

    it("should be broken between two runs, in each plot", async () => {
      const apart: CompositionInputPoint[] = [
        ...[80, 79, 78].map((daysAgo) => ({
          date: dayOf(daysAgo),
          segment: 0,
          fat: 22,
          lean: 63,
        })),
        ...[5, 4, 3].map((daysAgo) => ({ date: dayOf(daysAgo), segment: 1, fat: 21, lean: 64 })),
      ];
      await drawChart(90, { points: apart });

      expect(drawn("Line")).toHaveLength(4);
    });

    it("should be solid when the trend has settled", async () => {
      await drawChart(90);

      for (const line of drawn("Line")) {
        expect(line.children ?? null).toBeNull();
      }
    });

    it("should be dashed, 5 on and 4 off, in both plots while the trend settles", async () => {
      await drawChart(90, { isSettling: true });

      const lines = drawn("Line");

      expect(lines).toHaveLength(2);
      for (const line of lines) {
        expect(line.children?.props.intervals).toEqual([5, 4]);
      }
    });
  });

  describe("the markers", () => {
    it("should mark the latest value of each plot, 4.5 wide, with a ring of the surface colour", async () => {
      await drawChart(90);

      const latestDay = dataOf(90).bodyFat.latest?.dayIndex;
      const markers = drawn("Scatter").filter(
        (series) => series.color === colours("dark")["chart-marker"],
      );
      const rings = drawn("Scatter").filter((series) => series.color === colours("dark").surface);

      expect(markers).toHaveLength(2);
      expect(rings).toHaveLength(2);
      for (const marker of markers) {
        expect(marker.radius).toBe(4.5);
        expect(plottedDays(marker)).toEqual([latestDay]);
      }
      for (const ring of rings) {
        expect(ring.style).toBe("stroke");
        expect(ring.strokeWidth).toBe(2);
        expect(ring.radius).toBe(4.5);
        expect(plottedDays(ring)).toEqual([latestDay]);
      }
    });

    it("should draw nothing else: no reading dots and no rings for filled or left out days", async () => {
      await drawChart(90);

      expect(drawn("Scatter")).toHaveLength(4);
    });

    it("should draw in the light colours in the light scheme", async () => {
      await drawChart(90, { scheme: "light" });

      expect(drawn("Line")[0]?.color).toBe(colours("light")["chart-trend"]);
      expect(drawn("Scatter")[0]?.color).toBe(colours("light")["chart-marker"]);
    });
  });

  describe("a range with no points", () => {
    it("should draw both grids, both captions and the days, and no line", async () => {
      await drawChart(7, { points: [{ date: dayOf(40), segment: 0, fat: 22, lean: 63 }] });

      expect(drawn("Line")).toHaveLength(0);
      expect(drawn("Scatter")).toHaveLength(0);
      expect(screen.getByText("Body fat", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("Lean mass", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("Today", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByRole("img", { name: "The chart" })).toBeOnTheScreen();
    });
  });

  describe("a single point", () => {
    it("should draw a marker in each plot and an axis round the value", async () => {
      await drawChart(30, { points: [{ date: dayOf(0), segment: 0, fat: 20.2, lean: 64.4 }] });

      const markers = drawn("Scatter").filter(
        (series) => series.color === colours("dark")["chart-marker"],
      );

      expect(markers.map(plottedValues)).toEqual([[20.2], [64.4]]);
      expect(
        screen.getAllByText(/^\d+$/, hiddenToo).map((text) => Number(text.props.children)),
      ).toEqual([19, 20, 21, 63, 64, 65]);
    });
  });

  describe("health data", () => {
    it("should not log a value", async () => {
      const spies = (["debug", "error", "info", "log", "warn"] as const).map((method) =>
        jest.spyOn(console, method).mockImplementation(() => {}),
      );

      await drawChart(90, { isSettling: true });

      for (const spy of spies) {
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
      }
    });
  });

  describe("the stories", () => {
    it("should have exactly the stories storyStates.ts lists", () => {
      expect(
        Object.keys(stories)
          .filter((name) => name !== "default")
          .sort(),
      ).toEqual([...storyStates].sort());
    });
  });
});
