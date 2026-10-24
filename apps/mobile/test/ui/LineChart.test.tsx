import "../support/gestureHandler";

import { themes } from "@keylow/tokens";
import { fireEvent, isHiddenFromAccessibility, screen } from "@testing-library/react-native";

import { LineChart } from "../../components/ui";
import { renderChart } from "../support/chartRender";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { expectTextsInOrder } from "../support/textsInOrder";
import { resolvedColor } from "../support/themeColor";

import type { LineChartBand, LineChartPoint, LineChartProps } from "../../components/ui";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// The axis values and week labels are hidden from screen readers, so a query has to ask for them.
const hiddenToo = { includeHiddenElements: true };

const summary = "Barbell row, 5 weeks, from 40 kg to 55 kg";

// Mondays, one a week from 12 October 2026.
const mondays = ["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09"];

function weeksOf(values: (number | null)[]): LineChartPoint[] {
  return values.map((value, index) => ({ week: mondays[index] ?? `2027-01-${index + 1}`, value }));
}

const fiveWeeks = weeksOf([40, 45, 47.5, 50, 55]);

async function renderLineChart(props: Partial<LineChartProps> = {}) {
  await renderChart(
    <LineChart label="Barbell row" points={fiveWeeks} summary={summary} unit="kg" {...props} />,
  );
}

describe("LineChart", () => {
  describe("accessibility", () => {
    it("should be one image named by the summary the caller gives", async () => {
      await renderLineChart();

      expect(screen.getAllByRole("img")).toHaveLength(1);
      expect(screen.getByRole("img", { name: summary })).toBeOnTheScreen();
    });

    it("should write the summary under the chart", async () => {
      await renderLineChart();

      expect(screen.getByText(summary)).toBeOnTheScreen();
    });

    it("should keep the summary the caller gave when a week has no reading", async () => {
      await renderLineChart({ points: weeksOf([40, null, 47.5, null, 55]) });

      expect(screen.getByRole("img", { name: summary })).toBeOnTheScreen();
      expect(screen.getByText(summary)).toBeOnTheScreen();
    });
  });

  describe("labels", () => {
    it("should write what the chart shows and its unit", async () => {
      await renderLineChart();

      expect(screen.getByText("Barbell row")).toBeOnTheScreen();
      expect(screen.getByText("kg")).toBeOnTheScreen();
    });

    it("should write the highest, middle and lowest value on the axis", async () => {
      await renderLineChart();

      expect(screen.getByText("55", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("47.5", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("40", hiddenToo)).toBeOnTheScreen();
    });

    it("should write the axis values the way the caller formats them", async () => {
      await renderLineChart({ formatValue: (value) => `${value.toFixed(1)}!` });

      expect(screen.getByText("55.0!", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("40.0!", hiddenToo)).toBeOnTheScreen();
    });

    it("should label the weeks it can fit, counting back from the latest", async () => {
      const weeks = Array.from({ length: 13 }, (_, index) => ({
        week: new Date(Date.UTC(2026, 0, 5 + 7 * index)).toISOString().slice(0, 10),
        value: 40 + index,
      }));
      await renderLineChart({ points: weeks });

      // 13 weeks, labelled every fourth from the last: the week of 30 March back to the week of 5 January.
      expectTextsInOrder(screen.getAllByText(/^\d+ (Jan|Feb|Mar)$/, hiddenToo), [
        "5 Jan",
        "2 Feb",
        "2 Mar",
        "30 Mar",
      ]);
    });

    it("should label every week of a short series", async () => {
      await renderLineChart({ points: weeksOf([40, 45, 47.5, 50]) });

      expect(screen.getByText("12 Oct", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("19 Oct", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("26 Oct", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("2 Nov", hiddenToo)).toBeOnTheScreen();
    });
  });

  describe("hidden from screen readers", () => {
    it("should hide the axis values, since the summary carries them", async () => {
      await renderLineChart();

      expect(isHiddenFromAccessibility(screen.getByText("55", hiddenToo))).toBe(true);
      expect(isHiddenFromAccessibility(screen.getByText("40", hiddenToo))).toBe(true);
    });

    it("should hide the week labels", async () => {
      await renderLineChart();

      expect(isHiddenFromAccessibility(screen.getByText("12 Oct", hiddenToo))).toBe(true);
    });

    it("should keep the unit, the label and the summary readable", async () => {
      await renderLineChart();

      expect(isHiddenFromAccessibility(screen.getByText("kg"))).toBe(false);
      expect(isHiddenFromAccessibility(screen.getByText("Barbell row"))).toBe(false);
      expect(isHiddenFromAccessibility(screen.getByText(summary))).toBe(false);
    });
  });

  describe("long axis values", () => {
    it("should keep an axis value at its size however large the text is set, so it never wraps", async () => {
      await renderLineChart({ points: weeksOf([100, 110, 142.5]) });

      expect(screen.getByText("142.5", hiddenToo).props.maxFontSizeMultiplier).toBe(1);
      expect(screen.getByText("12 Oct", hiddenToo).props.maxFontSizeMultiplier).toBe(1);
    });
  });

  describe("data that is not a line", () => {
    it("should draw the axes and the summary without a value on the axis when no week has a reading", async () => {
      await renderLineChart({ points: weeksOf([null, null, null]) });

      expect(screen.getByText("kg")).toBeOnTheScreen();
      expect(screen.getByText(summary)).toBeOnTheScreen();
      expect(screen.queryByText("55", hiddenToo)).not.toBeOnTheScreen();
    });

    it("should draw one week with a reading", async () => {
      await renderLineChart({ points: weeksOf([47.5]) });

      expect(screen.getByText("48.5", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("46.5", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("12 Oct", hiddenToo)).toBeOnTheScreen();
    });

    it("should draw no week at all", async () => {
      await renderLineChart({ points: [] });

      expect(screen.getByText(summary)).toBeOnTheScreen();
    });

    it("should open a flat series by one either side", async () => {
      await renderLineChart({ points: weeksOf([50, 50, 50]) });

      expect(screen.getByText("51", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("50", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("49", hiddenToo)).toBeOnTheScreen();
    });
  });

  describe("selecting a week", () => {
    it("should offer no week to tap without a handler", async () => {
      await renderLineChart();

      expect(screen.queryAllByRole("button")).toHaveLength(0);
    });

    it("should hand the week start to the handler when a week is tapped", async () => {
      const onSelectWeek = jest.fn();
      await renderLineChart({ onSelectWeek });

      await fireEvent.press(screen.getByRole("button", { name: "26 Oct" }));

      expect(onSelectWeek).toHaveBeenCalledTimes(1);
      expect(onSelectWeek).toHaveBeenCalledWith("2026-10-26");
    });

    it("should not offer a week without a reading", async () => {
      await renderLineChart({ points: weeksOf([40, null, 47.5]), onSelectWeek: jest.fn() });

      expect(screen.getAllByRole("button")).toHaveLength(2);
      expect(screen.getByRole("button", { name: "12 Oct" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "26 Oct" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "19 Oct" })).not.toBeOnTheScreen();
    });
  });

  describe("with a likely range band", () => {
    let kitStyles: string;

    beforeAll(async () => {
      kitStyles = await compileKitStyles();
    });

    beforeEach(() => {
      registerAppStyles(kitStyles);
    });

    // The golden five weeks of the programme canvas, from 21 September.
    const goldenWeeks = ["2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"];
    const goldenPoints = [2500, 2500, 2559.56, 2574.22, 2579.54].map((value, index) => ({
      week: goldenWeeks[index] ?? "",
      value,
    }));
    const goldenBand: LineChartBand[] = [
      { low: 2019.4, high: 2980.6 },
      { low: 2019.4, high: 2980.6 },
      { low: 2291.43, high: 2827.69 },
      { low: 2388.77, high: 2759.67 },
      { low: 2430.91, high: 2728.17 },
    ];
    const goldenSummary =
      "Estimated expenditure over 5 weeks: 2,500 kcal a day in the week of 21 September, 2,580 now, likely 2,430 to 2,730.";
    const legend = { line: "Estimate", band: "Likely range" };
    // The expenditure card's formatter: to the nearest 10, with a thousands separator.
    const nearestTen = (value: number) => (Math.round(value / 10) * 10).toLocaleString("en-GB");

    const bandedProps = {
      points: goldenPoints,
      band: goldenBand,
      legend,
      summary: goldenSummary,
      label: "Expenditure by week",
      unit: "kcal a day",
      formatValue: nearestTen,
    };

    // The golden chart, with whatever the test changes. `without` leaves the band or the legend out altogether.
    async function renderBanded(
      overrides: Partial<LineChartProps> = {},
      without?: "band" | "legend",
    ) {
      const { band, legend: legendWords, ...rest } = { ...bandedProps, ...overrides };
      await renderLineChart({
        ...rest,
        ...(without === "band" ? {} : { band }),
        ...(without === "legend" ? {} : { legend: legendWords }),
      });
    }

    it("should write the axis from the lowest band end to the highest, to the nearest 10", async () => {
      await renderBanded();

      expectTextsInOrder(screen.getAllByText(/^\d,\d{3}$/, hiddenToo), ["2,980", "2,500", "2,020"]);
    });

    it("should write the axis of the values alone when there is no band", async () => {
      await renderLineChart({ points: goldenPoints, formatValue: nearestTen });

      expectTextsInOrder(screen.getAllByText(/^\d,\d{3}$/, hiddenToo), ["2,580", "2,540", "2,500"]);
    });

    it("should label every second week back from the latest", async () => {
      await renderBanded();

      expectTextsInOrder(screen.getAllByText(/^\d+ (Sep|Oct)$/, hiddenToo), [
        "21 Sep",
        "5 Oct",
        "19 Oct",
      ]);
    });

    it("should keep the chart one image named by the caller's summary", async () => {
      await renderBanded();

      expect(screen.getAllByRole("img")).toHaveLength(1);
      expect(screen.getByRole("img", { name: goldenSummary })).toBeOnTheScreen();
    });

    it("should write the legend with the caller's words, under the week labels and before the summary", async () => {
      await renderBanded();

      expectTextsInOrder(
        screen.getAllByText(/^(19 Oct|Estimate|Likely range|Estimated expenditure.*)$/, hiddenToo),
        ["19 Oct", "Estimate", "Likely range", goldenSummary],
      );
    });

    it("should write the legend in whatever words the caller gives", async () => {
      await renderBanded({ legend: { line: "Trend", band: "Usual range" } });

      expect(screen.getByText("Trend", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("Usual range", hiddenToo)).toBeOnTheScreen();
      expect(screen.queryByText("Likely range", hiddenToo)).not.toBeOnTheScreen();
    });

    it("should hide the legend from screen readers, since the summary carries it", async () => {
      await renderBanded();

      expect(isHiddenFromAccessibility(screen.getByText("Estimate", hiddenToo))).toBe(true);
      expect(isHiddenFromAccessibility(screen.getByText("Likely range", hiddenToo))).toBe(true);
    });

    it("should draw a legend swatch of 14 by 2 points in the trend colour for the line", async () => {
      await renderBanded();

      expect(await screen.findByTestId("legend-line-swatch", hiddenToo)).toHaveStyle({
        width: 14,
        height: 2,
        backgroundColor: resolvedColor("dark", "chart-trend"),
      });
    });

    it("should draw a legend swatch of 14 by 10 points in the band colour, ringed in the axis colour, for the band", async () => {
      await renderBanded();

      expect(await screen.findByTestId("legend-band-swatch", hiddenToo)).toHaveStyle({
        width: 14,
        height: 10,
        backgroundColor: themes.dark["chart-band"],
        borderWidth: 1,
        borderColor: resolvedColor("dark", "chart-axis"),
      });
    });

    it("should draw no legend when the caller gives none", async () => {
      await renderBanded({}, "legend");

      expect(screen.queryByText("Estimate", hiddenToo)).not.toBeOnTheScreen();
      expect(screen.queryByText("Likely range", hiddenToo)).not.toBeOnTheScreen();
    });

    it("should draw no legend without a band, even when the caller gives one", async () => {
      await renderBanded({}, "band");

      expect(screen.queryByText("Estimate", hiddenToo)).not.toBeOnTheScreen();
      expect(screen.queryByText("Likely range", hiddenToo)).not.toBeOnTheScreen();
    });

    it("should draw a week with no value, and its band, as a gap", async () => {
      await renderBanded({
        points: goldenPoints.map((point, index) =>
          index === 3 ? { ...point, value: null } : point,
        ),
        band: goldenBand.map((ends, index) => (index === 3 ? null : ends)),
      });

      expect(screen.getByRole("img", { name: goldenSummary })).toBeOnTheScreen();
      expectTextsInOrder(screen.getAllByText(/^\d,\d{3}$/, hiddenToo), ["2,980", "2,500", "2,020"]);
    });

    it("should draw one week with its band", async () => {
      await renderBanded({
        points: [{ week: "2026-10-19", value: 2413.125 }],
        band: [{ low: 1949.23, high: 2877.02 }],
      });

      expectTextsInOrder(screen.getAllByText(/^\d,\d{3}$/, hiddenToo), ["2,880", "2,410", "1,950"]);
      expect(screen.getByText("Likely range", hiddenToo)).toBeOnTheScreen();
    });

    it("should draw two weeks with their band", async () => {
      await renderBanded({
        points: [
          { week: "2026-10-19", value: 2413.125 },
          { week: "2026-10-26", value: 2413.125 },
        ],
        band: [
          { low: 1949.23, high: 2877.02 },
          { low: 1949.23, high: 2877.02 },
        ],
      });

      expectTextsInOrder(screen.getAllByText(/^\d+ Oct$/, hiddenToo), ["19 Oct", "26 Oct"]);
      expect(screen.getByText("Estimate", hiddenToo)).toBeOnTheScreen();
    });
  });
});
