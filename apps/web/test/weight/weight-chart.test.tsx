import { WEIGHT_ERROR, WEIGHT_RANGE_LABELS, describeChartName } from "@keylow/core/copy";
import { addCalendarDays } from "@keylow/core/dates";
import { computeTrend } from "@keylow/core/engine";
import { WEIGHT_RANGES, prepareWeightChart } from "@keylow/core/weight";
import { onlineManager } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  isInaccessible,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithWeight, resetWeightBackend, weighInRow, weightBackend } from "./support";
import { compileUtilities } from "../ui/compileUtilities";

import type { WeightRange } from "@keylow/core/weight";

import { WeightScreen } from "@/components/weight";

vi.mock("@keylow/core/weight", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@keylow/core/weight")>();
  return { ...actual, prepareWeightChart: vi.fn(actual.prepareWeightChart) };
});

vi.mock("@keylow/core/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@keylow/core/engine")>();
  return { ...actual, computeTrend: vi.fn(actual.computeTrend) };
});

const prepareMock = vi.mocked(prepareWeightChart);
const computeTrendMock = vi.mocked(computeTrend);

// Saturday 17 October 2026, 12:00 UTC.
const NOW = new Date("2026-10-17T12:00:00Z");
const TODAY = "2026-10-17";
const dayOf = (daysAgo: number) => addCalendarDays(TODAY, -daysAgo);

// The board's own sizes: the drawing is 754 by 220 at 1280 and 341 by 160 at 375.
const DESKTOP = { width: 754, height: 220 };
const PHONE = { width: 341, height: 160 };

const OUTLIER_DAYS_AGO = 20;
const GAP_DAYS_AGO = [12, 11, 10, 9, 8];
const TWO_READINGS_DAYS_AGO = 3;

// The weight of a daily weigher who loses 0.5 kg a month with a day to day wobble of about 0.4 kg, so the
// trend over a window alone would not match the trend over the whole history.
const weightOf = (daysAgo: number) =>
  Math.round((82 + daysAgo * (0.5 / 30) + Math.sin(daysAgo * 1.7) * 0.4) * 10) / 10;

type Reading = { daysAgo: number; weightKg: number };

// A year and a month of readings, newest first as the list reads them: a five day gap, one reading the trend
// leaves out, and a day with two readings.
function aYearOfReadings(): Reading[] {
  const readings: Reading[] = [];
  for (let daysAgo = 0; daysAgo < 400; daysAgo += 1) {
    if (!GAP_DAYS_AGO.includes(daysAgo)) {
      readings.push({ daysAgo, weightKg: daysAgo === OUTLIER_DAYS_AGO ? 99 : weightOf(daysAgo) });
    }
  }
  readings.push({ daysAgo: TWO_READINGS_DAYS_AGO, weightKg: 81.4 });
  return readings;
}

function seed(readings: readonly Reading[]) {
  weightBackend.weighIns = readings.map(({ daysAgo, weightKg }, index) =>
    weighInRow({
      localDate: dayOf(daysAgo),
      utcTime: index % 2 === 0 ? "07:10" : "07:20",
      weightKg,
    }),
  );
}

function stubSize(size: { width: number; height: number }) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    () => new DOMRect(0, 0, size.width, size.height),
  );
}

// A ResizeObserver that tells a test's callback when the test says the column changed.
const resizeCallbacks: ResizeObserverCallback[] = [];
class FakeResizeObserver implements ResizeObserver {
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    resizeCallbacks.push(callback);
  }

  observe() {}
  unobserve() {}
  disconnect() {
    resizeCallbacks.splice(resizeCallbacks.indexOf(this.callback), 1);
  }
}

function resizeTo(size: { width: number; height: number }) {
  stubSize(size);
  for (const callback of [...resizeCallbacks]) {
    callback([], new FakeResizeObserver(() => undefined));
  }
}

const chartName = (range: WeightRange, trendKg: number) => describeChartName(range, trendKg);
const figure = () => screen.findByRole("img", { name: /^Weight over the last/ });

// The drawing's marks have no role of their own, because the whole figure is one image, so they are read off
// it by the token class that colours each kind.
function marksOf(chart: HTMLElement) {
  const circles = Array.from(chart.querySelectorAll("circle"));
  const withClass = (name: string) => circles.filter((circle) => circle.classList.contains(name));

  return {
    readings: withClass("fill-chart-point"),
    filled: withClass("stroke-chart-point"),
    leftOut: withClass("stroke-warning"),
    marker: withClass("fill-chart-marker"),
    lines: Array.from(chart.querySelectorAll("path")),
    grid: Array.from(chart.querySelectorAll("line")),
  };
}

const numberOf = (element: Element, name: string) => Number(element.getAttribute(name));

// The one mark of a kind, so a test that expects it fails when it is missing and does not read something else.
function only<Mark extends Element>(marks: readonly Mark[]): Mark {
  const [mark] = marks;
  if (mark === undefined || marks.length !== 1) {
    throw new Error(`Expected one mark and found ${marks.length}`);
  }

  return mark;
}

// Presses a range and waits for the figure to be named for it.
async function chooseRange(range: WeightRange) {
  fireEvent.click(await screen.findByRole("radio", { name: WEIGHT_RANGE_LABELS[range] }));
  await screen.findByRole("img", { name: new RegExp(`^${chartName(range, Number.NaN)}`) });
}

describe("the trend card and the chart on the Weight page", () => {
  beforeEach(() => {
    resetWeightBackend();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    stubSize(DESKTOP);
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    prepareMock.mockClear();
    computeTrendMock.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    onlineManager.setOnline(true);
    vi.useRealTimers();
  });

  describe("the card", () => {
    it("should say where the trend stands, to one decimal, with the rate and the last weigh-in", async () => {
      seed(aYearOfReadings());
      render();

      const card = await screen.findByRole("region", { name: "Trend weight" });

      expect(within(card).getByText(/^\d+\.\d$/)).toBeTruthy();
      expect(within(card).getByText("kg")).toBeTruthy();
      expect(within(card).getByText(/kg a week$/)).toBeTruthy();
      expect(within(card).getByText(/^Last weigh-in 82\.0 kg today\./)).toBeTruthy();
      expect(within(card).queryByText("Settling")).toBeNull();
    });

    it("should say Settling, and how many weigh-ins it still needs, under 7 weigh-ins", async () => {
      seed([
        { daysAgo: 0, weightKg: 82 },
        { daysAgo: 1, weightKg: 82.2 },
        { daysAgo: 2, weightKg: 82.4 },
      ]);
      render();

      const card = await screen.findByRole("region", { name: "Trend weight" });

      expect(within(card).getByText("Settling")).toBeTruthy();
      expect(within(card).getByText("Settles after 7 weigh-ins. 3 of 7 so far.")).toBeTruthy();
      expect(within(card).queryByText(/kg a week$/)).toBeNull();
    });

    it("should draw nothing when there are no weigh-ins", async () => {
      render();
      await screen.findByRole("heading", { level: 2, name: "No weigh-ins yet" });

      expect(screen.queryByRole("region", { name: "Trend weight" })).toBeNull();
      expect(screen.queryByRole("radiogroup")).toBeNull();
    });
  });

  describe("the range control", () => {
    it("should offer 1 week, 30 days, 90 days and 1 year, starting on 90 days", async () => {
      seed(aYearOfReadings());
      render();

      const group = await screen.findByRole("radiogroup", { name: "Chart range" });
      const radios = within(group).getAllByRole("radio");

      expect(radios.map((radio) => radio.closest("label")?.textContent)).toEqual(
        WEIGHT_RANGES.map((range) => WEIGHT_RANGE_LABELS[range]),
      );
      expect(within(group).getByRole("radio", { name: "90 days", checked: true })).toBeTruthy();
    });

    it("should name the figure for the range chosen, with the same trend on every range", async () => {
      seed(aYearOfReadings());
      render();
      const trendNumber = (await screen.findByRole("region", { name: "Trend weight" })).textContent;
      const trendKg = Number(/(\d+\.\d)kg/.exec(trendNumber)?.[1]);

      for (const range of WEIGHT_RANGES) {
        fireEvent.click(screen.getByRole("radio", { name: WEIGHT_RANGE_LABELS[range] }));

        expect(await screen.findByRole("img", { name: chartName(range, trendKg) })).toBeTruthy();
      }
    });

    it("should work the trend out once for the weigh-ins and never again for a range", async () => {
      seed(aYearOfReadings());
      render();
      await figure();
      const callsForTheData = computeTrendMock.mock.calls.length;

      for (const range of WEIGHT_RANGES) {
        fireEvent.click(screen.getByRole("radio", { name: WEIGHT_RANGE_LABELS[range] }));
        await figure();
      }

      expect(callsForTheData).toBeGreaterThan(0);
      expect(computeTrendMock).toHaveBeenCalledTimes(callsForTheData);
    });
  });

  describe("what each range draws", () => {
    // The readings the board would draw for a range, counted from the rows the test made: a dot for each
    // reading in the last `range` days, less the one the trend leaves out.
    const expectedReadings = (range: WeightRange) =>
      aYearOfReadings().filter(
        (reading) => reading.daysAgo < range && reading.daysAgo !== OUTLIER_DAYS_AGO,
      ).length;

    it.each(WEIGHT_RANGES)(
      "should draw a dot for each reading of the last %i days",
      async (range) => {
        seed(aYearOfReadings());
        render();
        await figure();

        await chooseRange(range);
        const marks = marksOf(await figure());

        expect(marks.readings).toHaveLength(expectedReadings(range));
      },
    );

    it("should draw the day with two readings as two dots", async () => {
      seed(aYearOfReadings());
      render();
      await chooseRange(7);
      const marks = marksOf(await figure());

      // Seven days, one of them with two readings.
      expect(marks.readings).toHaveLength(8);
    });

    it("should draw the reading the trend left out as a ring, and not as a dot", async () => {
      seed(aYearOfReadings());
      render();
      await chooseRange(30);
      const marks = marksOf(await figure());

      expect(marks.leftOut).toHaveLength(1);
      expect(marks.readings).toHaveLength(expectedReadings(30));
    });

    it("should draw no ring for a range the left out reading is not in", async () => {
      seed(aYearOfReadings());
      render();
      await chooseRange(7);

      expect(marksOf(await figure()).leftOut).toHaveLength(0);
    });

    it("should mark the days the trend filled in on 30 days, and not on a year", async () => {
      seed(aYearOfReadings());
      render();
      await chooseRange(30);
      expect(marksOf(await figure()).filled).toHaveLength(GAP_DAYS_AGO.length);

      await chooseRange(365);

      expect(marksOf(await figure()).filled).toHaveLength(0);
    });

    it("should draw one marker, on the latest day, at the right end of the plot", async () => {
      seed(aYearOfReadings());
      render();
      await chooseRange(30);
      const marks = marksOf(await figure());

      expect(marks.marker).toHaveLength(1);
      // The last day is 44 px in from the right edge, as the board has it.
      expect(numberOf(marks.marker[0] ?? marks.readings[0] ?? document.body, "cx")).toBe(
        DESKTOP.width - 44,
      );
    });

    it("should draw the trend at the same value on every range", async () => {
      const readings = aYearOfReadings();
      seed(readings);
      render();
      await figure();
      const oracle = new Map(
        computeTrend(
          readings.map(({ daysAgo, weightKg }) => ({ localDate: dayOf(daysAgo), weightKg })),
        ).map((point) => [point.date, point.trendKg]),
      );

      for (const range of WEIGHT_RANGES) {
        await chooseRange(range);
        const chart = await figure();
        const weightAtY = weightAtHeightOf(chart);
        const marks = marksOf(chart);
        const firstY = Number(
          /^M[\d.]+ ([\d.]+)/.exec(only(marks.lines).getAttribute("d") ?? "")?.[1],
        );

        expect(weightAtY(firstY)).toBeCloseTo(oracle.get(dayOf(range - 1)) ?? Number.NaN, 1);
        expect(weightAtY(numberOf(only(marks.marker), "cy"))).toBeCloseTo(
          oracle.get(TODAY) ?? Number.NaN,
          1,
        );
      }
    });

    it("should draw a heavier weight higher than a lighter one, and write the heavier label higher", async () => {
      seed([
        { daysAgo: 1, weightKg: 80 },
        { daysAgo: 0, weightKg: 84 },
      ]);
      render();
      const chart = await figure();
      const [lighter, heavier] = marksOf(chart).readings;
      const labelTops = Array.from(chart.querySelectorAll("span"))
        .filter((span) => /^\d+$/.test(span.textContent))
        .map((span) => ({
          weightKg: Number(span.textContent),
          top: Number.parseFloat(span.style.getPropertyValue("--label-top")),
        }))
        .sort((first, second) => first.weightKg - second.weightKg);

      expect(numberOf(heavier ?? chart, "cy")).toBeLessThan(numberOf(lighter ?? chart, "cy"));
      expect(labelTops.length).toBeGreaterThan(1);
      expect(labelTops.at(0)?.top).toBeGreaterThan(
        labelTops.at(-1)?.top ?? Number.POSITIVE_INFINITY,
      );
    });

    it("should break the line where the readings stop for longer than the trend joins", async () => {
      // Ten days, then forty days of nothing, then ten days: more than the 30 days the trend bridges.
      seed([
        ...Array.from({ length: 10 }, (_, daysAgo) => ({ daysAgo, weightKg: 82 })),
        ...Array.from({ length: 10 }, (_, index) => ({ daysAgo: 50 + index, weightKg: 83 })),
      ]);
      render();
      await chooseRange(90);

      expect(marksOf(await figure()).lines).toHaveLength(2);
    });

    it("should join the days either side of a gap the trend bridges", async () => {
      seed([
        ...Array.from({ length: 10 }, (_, daysAgo) => ({ daysAgo, weightKg: 82 })),
        ...Array.from({ length: 10 }, (_, index) => ({ daysAgo: 30 + index, weightKg: 83 })),
      ]);
      render();
      await chooseRange(90);

      expect(marksOf(await figure()).lines).toHaveLength(1);
    });

    it("should size the dots as the board does", async () => {
      seed(aYearOfReadings());
      render();
      // The marks are read before the next range is chosen, because the same elements are drawn again for it.
      const radiusOf = (circles: Element[]) => circles[0]?.getAttribute("r");
      await chooseRange(30);
      const month = marksOf(await figure());
      const monthRadii = [month.readings, month.filled, month.leftOut, month.marker].map(radiusOf);
      await chooseRange(365);
      const yearRadius = radiusOf(marksOf(await figure()).readings);

      expect(monthRadii).toEqual(["2.6", "2.2", "3.5", "4.5"]);
      expect(yearRadius).toBe("1.6");
    });

    it("should draw one weigh-in as a dot and a marker, and no line", async () => {
      seed([{ daysAgo: 0, weightKg: 82 }]);
      render();
      await chooseRange(30);
      const marks = marksOf(await figure());

      expect(marks.readings).toHaveLength(1);
      expect(marks.marker).toHaveLength(1);
      expect(marks.lines).toHaveLength(0);
    });

    it("should draw the grid and the days, and no marks, for a range with nothing in it", async () => {
      seed([
        { daysAgo: 40, weightKg: 82 },
        { daysAgo: 41, weightKg: 82.2 },
      ]);
      render();
      await chooseRange(7);
      const chart = await figure();
      const marks = marksOf(chart);

      expect(marks.grid).toHaveLength(3);
      expect(marks.readings).toHaveLength(0);
      expect(marks.marker).toHaveLength(0);
      expect(marks.lines).toHaveLength(0);
      expect(within(chart).getByText("Today")).toBeTruthy();
      expect(within(chart).getByText("11 Oct")).toBeTruthy();
    });

    it("should draw the days under the plot: the first, the middle and today", async () => {
      seed(aYearOfReadings());
      render();
      const chart = await figure();

      expect(within(chart).getByText("20 Jul")).toBeTruthy();
      expect(within(chart).getByText("2 Sep")).toBeTruthy();
      expect(within(chart).getByText("Today")).toBeTruthy();
    });

    it("should write the weights down the right of the grid, a line for each", async () => {
      seed(aYearOfReadings());
      render();
      const chart = await figure();
      const marks = marksOf(chart);
      const labels = Array.from(chart.querySelectorAll("span")).filter((span) =>
        /^\d+$/.test(span.textContent),
      );

      expect(labels.length).toBeGreaterThan(1);
      expect(labels).toHaveLength(marks.grid.length);
    });

    it("should dash the trend while it settles, and not otherwise", async () => {
      seed([
        { daysAgo: 0, weightKg: 82 },
        { daysAgo: 1, weightKg: 82.2 },
        { daysAgo: 2, weightKg: 82.4 },
      ]);
      render();
      const [settlingLine] = marksOf(await figure()).lines;
      const dashed = settlingLine?.getAttribute("class") ?? "";
      cleanup();

      seed(aYearOfReadings());
      render();
      const [settledLine] = marksOf(await figure()).lines;

      expect(dashed).toContain("[stroke-dasharray:5_4]");
      expect(settledLine?.getAttribute("class")).not.toContain("stroke-dasharray");
    });
  });

  describe("the size of the drawing", () => {
    it("should draw nothing until its column has a size, rather than guess one", async () => {
      stubSize({ width: 0, height: 0 });
      seed(aYearOfReadings());
      render();
      const chart = await figure();

      expect(marksOf(chart).readings).toHaveLength(0);
      expect(marksOf(chart).grid).toHaveLength(0);
    });

    it("should follow the column to a phone's width with dots of the same size", async () => {
      seed(aYearOfReadings());
      render();
      const wide = marksOf(await figure());
      const wideRadius = wide.readings[0]?.getAttribute("r");
      const wideMarkerX = numberOf(wide.marker[0] ?? document.body, "cx");

      resizeTo(PHONE);

      await waitFor(() => {
        expect(
          numberOf(
            marksOf(screen.getByRole("img", { name: /^Weight/ })).marker[0] ?? document.body,
            "cx",
          ),
        ).not.toBe(wideMarkerX);
      });
      const narrow = marksOf(screen.getByRole("img", { name: /^Weight/ }));

      expect(numberOf(narrow.marker[0] ?? document.body, "cx")).toBe(PHONE.width - 44);
      expect(narrow.readings[0]?.getAttribute("r")).toBe(wideRadius);
      expect(
        screen
          .getByRole("img", { name: /^Weight/ })
          .querySelector("svg")
          ?.getAttribute("viewBox"),
      ).toBe(`0 0 ${PHONE.width} ${PHONE.height}`);
    });

    it("should fit its plot to the height of the breakpoint", async () => {
      seed(aYearOfReadings());
      render();
      const tall = marksOf(await figure()).grid;
      resizeTo(PHONE);
      await waitFor(() => {
        expect(
          marksOf(screen.getByRole("img", { name: /^Weight/ })).grid[0]?.getAttribute("x2"),
        ).toBe(String(PHONE.width - 40));
      });
      const short = marksOf(screen.getByRole("img", { name: /^Weight/ })).grid;

      // The top of the axis is 8 px below the top of the drawing and its bottom is 12 px above the bottom.
      const extent = (lines: Element[]) => {
        const heights = lines.map((line) => numberOf(line, "y1"));
        return [Math.min(...heights), Math.max(...heights)];
      };
      expect(extent(tall)).toEqual([8, DESKTOP.height - 12]);
      expect(extent(short)).toEqual([8, PHONE.height - 12]);
    });

    it("should not place the points again when something else on the page changes", async () => {
      seed(aYearOfReadings());
      render();
      await figure();
      const calls = prepareMock.mock.calls.length;

      fireEvent.click(screen.getByRole("button", { name: "Add weigh-in" }));
      await screen.findByRole("dialog");
      resizeTo(PHONE);

      expect(prepareMock).toHaveBeenCalledTimes(calls);
    });
  });

  describe("for a screen reader", () => {
    it("should be one image named for the range and the trend, with its parts hidden", async () => {
      seed(aYearOfReadings());
      render();
      const chart = await figure();

      expect(screen.getAllByRole("img")).toHaveLength(1);
      expect(chart.getAttribute("aria-label")).toMatch(
        /^Weight over the last 90 days, trend \d+\.\d kg$/,
      );
      for (const label of [within(chart).getByText("Today"), within(chart).getByText("20 Jul")]) {
        expect(isInaccessible(label)).toBe(true);
      }
      expect(isInaccessible(chart.querySelector("svg") ?? chart)).toBe(true);
    });

    it("should write the legend under the chart", async () => {
      seed(aYearOfReadings());
      render();
      await figure();

      expect(screen.getByText("Trend")).toBeTruthy();
      expect(screen.getByText("Weigh-in")).toBeTruthy();
      expect(screen.getByText("Left out")).toBeTruthy();
    });
  });

  describe("the page's states", () => {
    it("should show the skeleton of both columns while the weigh-ins load, and no chart", () => {
      weightBackend.weighInReadsHang = true;
      render();

      expect(screen.getByRole("status", { name: "Loading your weigh-ins" })).toBeTruthy();
      expect(screen.queryByRole("img")).toBeNull();
      expect(screen.queryByRole("radiogroup")).toBeNull();
    });

    it("should be the error and not a skeleton offline with nothing read, and add no chart", async () => {
      onlineManager.setOnline(false);
      weightBackend.weighInReadsHang = true;
      render();

      expect(await screen.findByRole("heading", { name: WEIGHT_ERROR.title })).toBeTruthy();
      expect(screen.queryByRole("status")).toBeNull();
      expect(screen.queryByRole("radiogroup")).toBeNull();
    });
  });

  describe("health data", () => {
    it("should write no weight to the console", async () => {
      const spies = (["log", "info", "warn", "error"] as const).map((level) =>
        vi.spyOn(console, level).mockImplementation(() => undefined),
      );
      seed(aYearOfReadings());
      render();
      await figure();
      await chooseRange(30);

      for (const spy of spies) {
        expect(spy).not.toHaveBeenCalled();
      }
    });
  });

  describe("the layout", () => {
    it("should be two columns from the large breakpoint, the card and chart at the left", async () => {
      seed(aYearOfReadings());
      render();
      const card = await screen.findByRole("region", { name: "Trend weight" });
      const columns = card.parentElement?.parentElement?.parentElement;
      const css = await compileUtilities(columns?.getAttribute("class") ?? "");
      const largeRules = css.slice(css.indexOf("@media"));

      expect(largeRules).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s+400px/);
      const list = within(columns ?? document.body).getByRole("region", { name: "Weigh-ins" });
      expect(card.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("should give the plot 160 px at a phone and 220 px from the large breakpoint", async () => {
      seed(aYearOfReadings());
      render();
      const svg = (await figure()).querySelector("svg");
      const css = await compileUtilities(svg?.getAttribute("class") ?? "");
      const largeRules = css.slice(css.indexOf("@media"));

      expect(css.slice(0, css.indexOf("@media"))).toMatch(/height:\s*160px/);
      expect(largeRules).toMatch(/height:\s*220px/);
    });

    it("should paint the marks with the chart tokens, and dash the settling trend", async () => {
      const css = await compileUtilities(
        "fill-chart-point stroke-chart-point stroke-warning stroke-chart-trend fill-chart-marker stroke-chart-grid [stroke-dasharray:5_4] stroke-[2.25]",
      );

      expect(css).toMatch(/\.fill-chart-point\s*{\s*fill:/);
      expect(css).toMatch(/\.stroke-chart-trend\s*{\s*stroke:/);
      expect(css).toMatch(/\.stroke-chart-grid\s*{\s*stroke:/);
      expect(css).toMatch(/\.fill-chart-marker\s*{\s*fill:/);
      expect(css).toMatch(/stroke-dasharray:\s*5 4/);
      expect(css).toMatch(/\.stroke-\\\[2\\\.25\\\]\s*{\s*stroke-width:\s*2\.25/);
    });
  });
});

function render() {
  return renderWithWeight(<WeightScreen />);
}

// The weight a height in the drawing stands for, read from the grid's own lines and the weights written beside
// them, so it does not depend on how the drawing was placed.
function weightAtHeightOf(chart: HTMLElement) {
  const heights = Array.from(chart.querySelectorAll("line")).map((line) => numberOf(line, "y1"));
  const weights = Array.from(chart.querySelectorAll("span"))
    .filter((span) => /^\d+$/.test(span.textContent))
    .map((span) => Number(span.textContent));
  const [firstHeight = 0, secondHeight = 1] = heights;
  const [firstWeight = 0, secondWeight = 0] = weights;

  return (height: number) =>
    firstWeight +
    ((height - firstHeight) * (secondWeight - firstWeight)) / (secondHeight - firstHeight);
}
