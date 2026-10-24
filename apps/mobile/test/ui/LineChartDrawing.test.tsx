import "../support/gestureHandler";

import { themes } from "@keylow/tokens";
import { isHiddenFromAccessibility, screen } from "@testing-library/react-native";

import { LineChart } from "../../components/ui";
import { plotPadding } from "../../components/ui/LineChart/layout";
import { renderChart } from "../support/chartRender";

import type { LineChartBand, LineChartPoint, LineChartProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// Skia draws nothing in Jest, so Victory never calls for the line. This stands in for the three parts of it the
// chart uses: the chart calls its children with a point for each datum and each of the keys it was given, and
// the line and the points it draws are views that keep the props they were given, so a test can read what
// would have been drawn. The band is a Skia path, which is a view that keeps its props for the same reason.
jest.mock("victory-native", () => {
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  return {
    CartesianChart: (props: {
      data: Record<string, number | null>[];
      yKeys: string[];
      domain: unknown;
      padding: unknown;
      children: (arguments_: { points: Record<string, unknown[]> }) => unknown;
    }) =>
      createElement(
        "CartesianChart",
        { domain: props.domain, padding: props.padding, yKeys: props.yKeys },
        props.children({
          points: Object.fromEntries(
            props.yKeys.map((key) => [
              key,
              props.data.map((datum) => ({
                x: (datum.index ?? 0) * 10,
                xValue: datum.index,
                y: datum[key],
                yValue: datum[key],
              })),
            ]),
          ),
        }) as never,
      ),
    Line: (props: object) => createElement("Line", props),
    Scatter: (props: object) => createElement("Scatter", props),
  };
});

jest.mock("@shopify/react-native-skia", () => {
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  const renderNothing = () => null;
  const drawing: Record<string, unknown> = {
    __esModule: true,
    Path: (props: object) => createElement("BandPath", props),
  };
  return new Proxy(drawing, {
    get: (target, name: string) => (name in target ? target[name] : renderNothing),
  });
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

// The golden five weeks of the programme canvas: the estimate and its likely range for each week.
const goldenValues = [2500, 2500, 2559.56, 2574.22, 2579.54];
const goldenBand: LineChartBand[] = [
  { low: 2019.4, high: 2980.6 },
  { low: 2019.4, high: 2980.6 },
  { low: 2291.43, high: 2827.69 },
  { low: 2388.77, high: 2759.67 },
  { low: 2430.91, high: 2728.17 },
];

function bands() {
  return (screen.root?.queryAll((node) => node.type === "BandPath") ?? []).map((node) => ({
    color: node.props.color as unknown,
    path: node.props.path as unknown,
  }));
}

function chartDomain() {
  return screen.root?.queryAll((node) => node.type === "CartesianChart")[0]?.props
    .domain as unknown;
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

  describe("the band", () => {
    it("should draw no band, and ask Victory for no more than the values, without one", async () => {
      await drawLineChart([40, 45, 50]);

      expect(bands()).toEqual([]);
      expect(
        screen.root?.queryAll((node) => node.type === "CartesianChart")[0]?.props.yKeys,
      ).toEqual(["value"]);
    });

    it("should run the value range from the lowest to the highest of the values and the band ends", async () => {
      await drawLineChart(goldenValues, { band: goldenBand });

      expect(chartDomain()).toEqual({ x: [-0.5, 4.5], y: [2019.4, 2980.6] });
    });

    it("should leave the value range alone when the band sits inside the values", async () => {
      await drawLineChart([40, 55], {
        band: [
          { low: 41, high: 43 },
          { low: 50, high: 54 },
        ],
      });

      expect(chartDomain()).toEqual({ x: [-0.5, 1.5], y: [40, 55] });
    });

    it("should draw one shape through every week, along the high ends and back along the low ends", async () => {
      await drawLineChart(goldenValues, { band: goldenBand });

      expect(bands().map((band) => band.path)).toEqual([
        "M0 2980.6 L10 2980.6 L20 2827.69 L30 2759.67 L40 2728.17 L40 2430.91 L30 2388.77 L20 2291.43 L10 2019.4 L0 2019.4 Z",
      ]);
    });

    it("should break the band at a week with no value, as the line breaks", async () => {
      await drawLineChart([2500, 2500, 2559.56, null, 2579.54], {
        band: [
          goldenBand[0] ?? null,
          goldenBand[1] ?? null,
          goldenBand[2] ?? null,
          null,
          goldenBand[4] ?? null,
        ],
      });

      expect(bands().map((band) => band.path)).toEqual([
        "M0 2980.6 L10 2980.6 L20 2827.69 L20 2291.43 L10 2019.4 L0 2019.4 Z M34 2728.17 H46 V2430.91 H34 Z",
      ]);
    });

    it("should break the band at a week with a value but no band, and keep the line going through it", async () => {
      await drawLineChart([40, 45, 50, 55], {
        band: [{ low: 38, high: 42 }, { low: 43, high: 47 }, null, { low: 53, high: 57 }],
      });

      expect(bands().map((band) => band.path)).toEqual([
        "M0 42 L10 47 L10 43 L0 38 Z M24 57 H36 V53 H24 Z",
      ]);
      expect(drawn("Line")[0]?.points.map((point) => point.y)).toEqual([40, 45, 50, 55]);
    });

    it("should draw a lone week as a bar 12 points wide, centred on its point", async () => {
      await drawLineChart([2413.125], { band: [{ low: 1949.23, high: 2877.02 }] });

      expect(bands().map((band) => band.path)).toEqual(["M-6 2877.02 H6 V1949.23 H-6 Z"]);
    });

    it("should draw the band in the band token, before the line, so the line is over it", async () => {
      await drawLineChart(goldenValues, { band: goldenBand }, "light");

      const drawnTypes = (
        screen.root?.queryAll((node) => node.type === "BandPath" || node.type === "Line") ?? []
      ).map((node) => node.type);

      expect(drawnTypes).toEqual(["BandPath", "Line"]);
      expect(bands()[0]?.color).toBe(themes.light["chart-band"]);
    });

    it("should draw the band in the dark scheme's token too", async () => {
      await drawLineChart(goldenValues, { band: goldenBand }, "dark");

      expect(bands()[0]?.color).toBe(themes.dark["chart-band"]);
    });

    it("should keep the line, the points and the marker as they are with a band", async () => {
      await drawLineChart([40, 45, 50], {
        band: [
          { low: 38, high: 42 },
          { low: 43, high: 47 },
          { low: 48, high: 52 },
        ],
      });

      expect(drawn("Line")[0]?.points.map((point) => point.y)).toEqual([40, 45, 50]);
      expect(drawn("Scatter")[1]?.points.map((point) => point.xValue)).toEqual([2]);
    });
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
