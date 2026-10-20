import "../support/gestureHandler";

import { themes } from "@keylow/tokens";
import { isHiddenFromAccessibility, screen } from "@testing-library/react-native";

import { LineChart } from "../../components/ui";
import { plotPadding } from "../../components/ui/LineChart/layout";
import { renderChart } from "../support/chartRender";

import type { LineChartPoint, LineChartProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// Skia draws nothing in Jest, so Victory never calls for the line. This stands in for the three parts of it the
// chart uses: the chart calls its children with a point for each datum, and the line and the points it draws
// are views that keep the props they were given, so a test can read what would have been drawn.
jest.mock("victory-native", () => {
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  return {
    CartesianChart: (props: {
      data: { index: number; value: number | null }[];
      domain: unknown;
      padding: unknown;
      children: (arguments_: { points: { value: unknown[] } }) => unknown;
    }) =>
      createElement(
        "CartesianChart",
        { domain: props.domain, padding: props.padding },
        props.children({
          points: {
            value: props.data.map((datum) => ({
              x: datum.index * 10,
              xValue: datum.index,
              y: datum.value,
              yValue: datum.value,
            })),
          },
        }) as never,
      ),
    Line: (props: object) => createElement("Line", props),
    Scatter: (props: object) => createElement("Scatter", props),
  };
});

// Mondays, one a week from 12 October 2026.
const mondays = ["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09"];

function weeksOf(values: (number | null)[]): LineChartPoint[] {
  return values.map((value, index) => ({ week: mondays[index] ?? "2027-01-04", value }));
}

async function drawLineChart(
  values: (number | null)[],
  props: Partial<LineChartProps> = {},
  scheme: ThemeScheme = "dark",
) {
  await renderChart(
    <LineChart
      label="Barbell row"
      points={weeksOf(values)}
      summary="Summary"
      unit="kg"
      {...props}
    />,
    scheme,
  );
}

type Plotted = { xValue: number; y: number | null };

function drawn(type: "Line" | "Scatter") {
  return (screen.root?.queryAll((node) => node.type === type) ?? []).map((node) => ({
    color: node.props.color as unknown,
    radius: node.props.radius as unknown,
    connectMissingData: node.props.connectMissingData as unknown,
    points: node.props.points as Plotted[],
  }));
}

describe("LineChart drawing", () => {
  it("should draw one line through every week, with a skipped week as a gap that is not joined over", async () => {
    await drawLineChart([40, 42, null, 48, 50]);

    const [line, ...others] = drawn("Line");

    expect(others).toHaveLength(0);
    expect(line?.points.map((point) => point.y)).toEqual([40, 42, null, 48, 50]);
    expect(line?.connectMissingData).toBe(false);
  });

  it("should draw a point for each week with a reading and none for a skipped week", async () => {
    await drawLineChart([40, 42, null, 48, 50]);

    const [ordinary, emphasised] = drawn("Scatter");
    const weeksDrawn = [...(ordinary?.points ?? []), ...(emphasised?.points ?? [])]
      .filter((point) => point.y !== null)
      .map((point) => point.xValue)
      .sort();

    expect(weeksDrawn).toEqual([0, 1, 3, 4]);
  });

  it("should draw a reading between two skipped weeks as a point", async () => {
    await drawLineChart([40, null, 45, null, 50]);

    const [ordinary, emphasised] = drawn("Scatter");

    expect(ordinary?.points.map((point) => point.xValue)).toEqual([0, 1, 2, 3]);
    expect(emphasised?.points.map((point) => point.xValue)).toEqual([4]);
  });

  describe("the emphasised point", () => {
    it("should be the latest week, larger than the rest", async () => {
      await drawLineChart([40, 45, 50]);

      const [ordinary, emphasised] = drawn("Scatter");

      expect(emphasised?.points.map((point) => point.xValue)).toEqual([2]);
      expect(emphasised?.radius).toBe(4);
      expect(ordinary?.radius).toBe(2.5);
      expect(ordinary?.points.map((point) => point.xValue)).not.toContain(2);
    });

    it("should be the last week with a reading when the final week is skipped", async () => {
      await drawLineChart([40, 45, null]);

      expect(drawn("Scatter")[1]?.points.map((point) => point.xValue)).toEqual([1]);
    });

    it("should move to the selected week", async () => {
      await drawLineChart([40, 45, 50], { selectedWeek: "2026-10-19" });

      expect(drawn("Scatter")[1]?.points.map((point) => point.xValue)).toEqual([1]);
    });
  });

  it("should give the chart the weeks across and the lowest to the highest value up", async () => {
    await drawLineChart([40, 42, null, 48, 55]);

    expect(
      screen.root?.queryAll((node) => node.type === "CartesianChart")[0]?.props.domain,
    ).toEqual({
      x: [-0.5, 4.5],
      y: [40, 55],
    });
  });

  it("should open the value range of a flat series, so the line is drawn in the middle", async () => {
    await drawLineChart([50, 50, 50]);

    expect(
      screen.root?.queryAll((node) => node.type === "CartesianChart")[0]?.props.domain,
    ).toEqual({
      x: [-0.5, 2.5],
      y: [49, 51],
    });
  });

  it("should pad the plot by the insets the gutter and the week labels are laid out with", async () => {
    await drawLineChart([40, 45, 50]);

    expect(
      screen.root?.queryAll((node) => node.type === "CartesianChart")[0]?.props.padding,
    ).toEqual(plotPadding);
  });

  it("should hide the drawing from screen readers, since the summary carries it", async () => {
    await drawLineChart([40, 45, 50]);

    const [chart] = screen.root?.queryAll((node) => node.type === "CartesianChart") ?? [];

    expect(chart && isHiddenFromAccessibility(chart)).toBe(true);
  });

  it("should draw no line when no week has a reading", async () => {
    await drawLineChart([null, null]);

    expect(drawn("Line")).toHaveLength(0);
  });

  describe.each<ThemeScheme>(["dark", "light"])("in the %s scheme", (scheme) => {
    it("should draw the line, the points and the marker in the chart tokens", async () => {
      await drawLineChart([40, 45, 50], {}, scheme);

      expect(drawn("Line")[0]?.color).toBe(themes[scheme]["chart-trend"]);
      expect(drawn("Scatter")[0]?.color).toBe(themes[scheme]["chart-point"]);
      expect(drawn("Scatter")[1]?.color).toBe(themes[scheme]["chart-marker"]);
    });
  });
});
