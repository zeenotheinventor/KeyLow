import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { compileUtilities } from "./compileUtilities";

import type { LineChartPoint, LineChartProps } from "@/components/ui/LineChart";

import { LineChart } from "@/components/ui/LineChart";

// The board's own sizes: the drawing is 754 by 220 in the Programme's column at 1280, 576 by 220 in a half
// column, 536 by 220 at the two column page's narrowest and 341 by 160 at 375.
const WIDE = { width: 754, height: 220 };
const HALF = { width: 576, height: 220 };
const PHONE = { width: 341, height: 160 };

// The chart measures the box its column gives it, so a test says what that box is.
function stubWidth(width: number) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    () => new DOMRect(0, 0, width, 100),
  );
}

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

function resizeTo(width: number) {
  stubWidth(width);
  for (const callback of [...resizeCallbacks]) {
    callback([], new FakeResizeObserver(() => undefined));
  }
}

// Mondays counted back from 19 October 2026, oldest first.
function weeksEndingAt(values: (number | null)[]): LineChartPoint[] {
  return values.map((value, index) => ({
    week: new Date(Date.UTC(2026, 9, 19 - 7 * (values.length - 1 - index)))
      .toISOString()
      .slice(0, 10),
    value,
  }));
}

// The board's bench series: 13 weeks, a plateau and a step at the end.
const THIRTEEN_WEEKS = weeksEndingAt([
  55,
  55,
  55,
  58.75,
  58.75,
  58.75,
  62.5,
  62.5,
  62.5,
  62.5,
  62.5,
  null,
  62.5,
]);

// The Monday of a week of the board's series, which a test selects.
function weekAt(index: number): string {
  const week = THIRTEEN_WEEKS[index]?.week;
  if (week === undefined) {
    throw new Error(`No week at ${index}`);
  }
  return week;
}

const SUMMARY = "Barbell Bench Press - Medium Grip, 13 weeks, from 55 kg to 62.5 kg";

function chart(props: Partial<LineChartProps> = {}) {
  return (
    <LineChart
      label="Barbell Bench Press - Medium Grip"
      points={THIRTEEN_WEEKS}
      summary={SUMMARY}
      unit="kg"
      {...props}
    />
  );
}

// The drawing's marks have no role of their own, because the chart is one image, so they are read off the
// drawing by the token class that colours each kind.
function drawing() {
  const image = screen.getByRole("img", { name: SUMMARY });
  const svg = image.matches("svg") ? image : image.querySelector("svg");
  if (svg === null) {
    throw new Error("The chart has no drawing");
  }
  const circles = Array.from(svg.querySelectorAll<SVGCircleElement>("circle"));
  const withClass = (name: string) => circles.filter((circle) => circle.classList.contains(name));
  return {
    svg,
    points: withClass("fill-chart-point"),
    marker: withClass("fill-chart-marker"),
    lines: Array.from(svg.querySelectorAll<SVGPathElement>("path.stroke-chart-trend")),
    band: Array.from(svg.querySelectorAll<SVGPathElement>("path.fill-chart-band")),
    grid: Array.from(svg.querySelectorAll<SVGPathElement>("path.stroke-chart-grid")),
    axis: Array.from(svg.querySelectorAll<SVGPathElement>("path.stroke-chart-axis")),
  };
}

const numberOf = (element: Element, name: string) => Number(element.getAttribute(name));

function only<Mark extends Element>(marks: readonly Mark[]): Mark {
  const [mark] = marks;
  if (mark === undefined || marks.length !== 1) {
    throw new Error(`Expected one mark and found ${marks.length}`);
  }
  return mark;
}

beforeEach(() => {
  stubWidth(HALF.width);
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resizeCallbacks.length = 0;
});

describe("LineChart", () => {
  describe("the frame", () => {
    it("should be one image named by the summary, and write the summary under the chart", () => {
      render(chart());

      expect(screen.getByRole("img", { name: SUMMARY })).toBeDefined();
      expect(screen.getByText(SUMMARY)).toBeDefined();
    });

    it("should write the label and the unit above the drawing", () => {
      render(chart());

      expect(screen.getByText("Barbell Bench Press - Medium Grip")).toBeDefined();
      expect(screen.getByText("kg")).toBeDefined();
    });

    it("should let the drawing shrink with its column, so a grid or flex parent can narrow it", () => {
      render(chart());

      expect(drawing().svg.classList.contains("w-full")).toBe(true);
    });

    it("should take its column's width in a flex row, not the width of its content", () => {
      render(chart());

      expect(screen.getByText(SUMMARY).closest("figure")?.classList.contains("w-full")).toBe(true);
    });

    it("should write the tick and week labels with tabular figures", () => {
      render(chart());

      expect(screen.getByText("19 Oct").classList.contains("tabular-nums")).toBe(true);
      expect(screen.getByText("62.5").classList.contains("tabular-nums")).toBe(true);
    });

    it("should have no buttons without onSelectWeek", () => {
      render(chart());

      expect(screen.queryByRole("button")).toBeNull();
    });
  });

  describe("the drawing", () => {
    it("should be the measured width by 220 high at the half column's width", () => {
      render(chart());

      const { svg } = drawing();
      expect(svg.getAttribute("viewBox")).toBe("0 0 576 220");
      expect(numberOf(svg, "width")).toBe(576);
      expect(numberOf(svg, "height")).toBe(220);
    });

    it("should be 754 by 220 in the Programme's column", () => {
      stubWidth(WIDE.width);
      render(chart());

      expect(drawing().svg.getAttribute("viewBox")).toBe("0 0 754 220");
    });

    it("should be 160 high at 341 wide", () => {
      stubWidth(PHONE.width);
      render(chart());

      expect(drawing().svg.getAttribute("viewBox")).toBe("0 0 341 160");
    });

    it("should follow its column when the column changes width", () => {
      render(chart());
      act(() => {
        resizeTo(PHONE.width);
      });

      expect(drawing().svg.getAttribute("viewBox")).toBe("0 0 341 160");
    });

    it("should draw nothing before its column has a size", () => {
      stubWidth(0);
      render(chart());

      expect(screen.getByRole("img", { name: SUMMARY }).querySelector("svg")).toBeNull();
      expect(screen.getByText(SUMMARY)).toBeDefined();
    });

    it("should put each week in the middle of an equal column inside 12 left and 44 right", () => {
      render(chart());

      const { points, marker } = drawing();
      const xs = [...points, ...marker].map((mark) => numberOf(mark, "cx")).sort((a, b) => a - b);
      expect(xs[0]).toBe(32);
      expect(xs.at(-1)).toBe(512);
    });

    it("should put the lowest value on the bottom of the plot and the highest on the top", () => {
      render(chart());

      const ys = [...drawing().points, ...drawing().marker].map((mark) => numberOf(mark, "cy"));
      expect(Math.max(...ys)).toBe(208);
      expect(Math.min(...ys)).toBe(8);
    });

    it("should draw the grid at three values, stopping at the value column, with the bottom in the axis colour", () => {
      render(chart());

      const { grid, axis } = drawing();
      expect(only(grid).getAttribute("d")).toBe("M0 8H536M0 108H536");
      expect(only(axis).getAttribute("d")).toBe("M0 208H536");
    });

    it("should write the highest, middle and lowest values on the right", () => {
      render(chart());

      expect(screen.getByText("62.5")).toBeDefined();
      expect(screen.getByText("58.8")).toBeDefined();
      expect(screen.getByText("55")).toBeDefined();
    });

    it("should write the axis with the caller's formatValue", () => {
      render(chart({ formatValue: (value) => `${value} kilograms` }));

      expect(screen.getByText("62.5 kilograms")).toBeDefined();
    });

    it("should draw the line 2.5 wide with round caps and joins", () => {
      render(chart());

      const line = only(drawing().lines);
      expect(Array.from(line.classList)).toEqual(expect.arrayContaining(["stroke-[2.5]"]));
      expect(line.getAttribute("stroke-linecap")).toBe("round");
      expect(line.getAttribute("stroke-linejoin")).toBe("round");
    });

    it("should draw a point of 2.5 on every reading and a marker of 4 ringed in the surface on the latest", () => {
      render(chart());

      const { points, marker } = drawing();
      expect(points).toHaveLength(11);
      points.forEach((point) => {
        expect(numberOf(point, "r")).toBe(2.5);
      });
      const latest = only(marker);
      expect(numberOf(latest, "r")).toBe(4);
      expect(Array.from(latest.classList)).toEqual(
        expect.arrayContaining(["stroke-surface", "stroke-2"]),
      );
      expect(numberOf(latest, "cx")).toBe(512);
    });

    it("should move the marker to the selected week", () => {
      render(chart({ selectedWeek: weekAt(10) }));

      const { points, marker } = drawing();
      expect(numberOf(only(marker), "cx")).toBe(432);
      expect(points).toHaveLength(11);
    });

    it("should emphasise nothing for a selected week without a reading", () => {
      render(chart({ selectedWeek: weekAt(11) }));

      const { points, marker } = drawing();
      expect(marker).toHaveLength(0);
      expect(points).toHaveLength(12);
    });

    it("should break the line at a skipped week and leave the week without a point", () => {
      render(chart());

      const { lines, points, marker } = drawing();
      const xs = [...points, ...marker].map((mark) => numberOf(mark, "cx"));
      expect(lines).toHaveLength(1);
      expect(xs).not.toContain(12 + 520 * (11.5 / 13));
    });

    it("should draw a reading alone as a point and no line", () => {
      render(chart({ points: weeksEndingAt([null, 60, null, null]) }));

      const { lines, marker } = drawing();
      expect(lines).toHaveLength(0);
      expect(only(marker)).toBeDefined();
    });

    it("should draw a dot and no line for a single week, in the middle of the plot", () => {
      render(chart({ points: weeksEndingAt([60]) }));

      const dot = only(drawing().marker);
      expect(numberOf(dot, "cx")).toBe(12 + 520 / 2);
      expect(numberOf(dot, "cy")).toBe(108);
    });

    it("should draw the grid and no marks when no week has a reading", () => {
      render(chart({ points: weeksEndingAt([null, null, null]) }));

      const { points, marker, lines, grid } = drawing();
      expect(points).toHaveLength(0);
      expect(marker).toHaveLength(0);
      expect(lines).toHaveLength(0);
      expect(grid).toHaveLength(1);
    });
  });

  describe("the week labels", () => {
    it("should label 7 of 13 weeks counting back from the latest when the chart is wide", () => {
      render(chart());

      for (const label of ["27 Jul", "10 Aug", "24 Aug", "7 Sep", "21 Sep", "5 Oct", "19 Oct"]) {
        expect(screen.getByText(label)).toBeDefined();
      }
      expect(screen.queryByText("3 Aug")).toBeNull();
    });

    it("should label 4 of 13 weeks at a phone's width", () => {
      stubWidth(PHONE.width);
      render(chart());

      for (const label of ["19 Oct", "21 Sep", "24 Aug", "27 Jul"]) {
        expect(screen.getByText(label)).toBeDefined();
      }
      expect(screen.queryByText("5 Oct")).toBeNull();
    });

    it("should label every week of a short series", () => {
      stubWidth(PHONE.width);
      render(chart({ points: weeksEndingAt([60, null, 61, 62.5]) }));

      for (const label of ["28 Sep", "5 Oct", "12 Oct", "19 Oct"]) {
        expect(screen.getByText(label)).toBeDefined();
      }
    });

    it("should centre each label under its point", () => {
      render(chart());

      const label = screen.getByText("19 Oct");
      expect(Array.from(label.classList)).toEqual(expect.arrayContaining(["-translate-x-1/2"]));
      expect(label.style.getPropertyValue("--label-left")).toBe("512px");
    });
  });

  describe("the band", () => {
    const FIVE_WEEKS = weeksEndingAt([2500, 2500, 2540, 2560, 2580]);
    const BAND = [
      { low: 2000, high: 3000 },
      { low: 2100, high: 2900 },
      { low: 2250, high: 2800 },
      { low: 2300, high: 2780 },
      { low: 2430, high: 2730 },
    ];
    const LEGEND = { line: "Estimate", band: "Likely range" };

    it("should shade the band behind the line and widen the axis to hold its ends", () => {
      render(chart({ points: FIVE_WEEKS, band: BAND, legend: LEGEND, formatValue: String }));

      const { band, lines } = drawing();
      expect(only(band)).toBeDefined();
      expect(lines).toHaveLength(1);
      expect(screen.getByText("3000")).toBeDefined();
      expect(screen.getByText("2000")).toBeDefined();
    });

    it("should draw the band before the line so it is behind it", () => {
      render(chart({ points: FIVE_WEEKS, band: BAND, legend: LEGEND }));

      const { svg, band, lines } = drawing();
      const paths = Array.from(svg.querySelectorAll<SVGPathElement>("path"));
      expect(paths.indexOf(only(band))).toBeLessThan(paths.indexOf(only(lines)));
    });

    it("should name the line and the band in a legend under the week labels", () => {
      render(chart({ points: FIVE_WEEKS, band: BAND, legend: LEGEND }));

      expect(screen.getByText("Estimate")).toBeDefined();
      expect(screen.getByText("Likely range")).toBeDefined();
    });

    it("should have no legend without a band, whatever the legend says", () => {
      render(chart({ legend: LEGEND }));

      expect(screen.queryByText("Estimate")).toBeNull();
    });

    it("should have no band shape without a band", () => {
      render(chart());

      expect(drawing().band).toHaveLength(0);
    });

    it("should break the band at a week without one and draw a week alone as a bar 12 wide", () => {
      render(
        chart({
          points: FIVE_WEEKS,
          band: [BAND[0] ?? null, BAND[1] ?? null, BAND[2] ?? null, null, BAND[4] ?? null],
          legend: LEGEND,
        }),
      );

      const path = only(drawing().band).getAttribute("d") ?? "";
      expect(path.split("Z").filter((shape) => shape.trim() !== "")).toHaveLength(2);
      const bar = /M(\S+) \S+ H(\S+) V\S+ H\S+ Z/.exec(path);
      expect(Number(bar?.[2]) - Number(bar?.[1])).toBe(12);
    });
  });

  describe("the week buttons", () => {
    it("should give each week with a reading a button named by its week", () => {
      render(chart({ onSelectWeek: () => undefined }));

      expect(screen.getAllByRole("button")).toHaveLength(12);
      expect(screen.getByRole("button", { name: "19 Oct" })).toBeDefined();
      expect(screen.getByRole("button", { name: "27 Jul" })).toBeDefined();
    });

    it("should give a skipped week no button", () => {
      render(chart({ onSelectWeek: () => undefined }));

      expect(screen.queryByRole("button", { name: "12 Oct" })).toBeNull();
    });

    it("should say the summary once: the drawing is the image and the caption is hidden", () => {
      render(chart({ onSelectWeek: () => undefined }));

      expect(screen.getAllByRole("img", { name: SUMMARY })).toHaveLength(1);
      expect(screen.getByText(SUMMARY).closest("[aria-hidden='true']")).not.toBeNull();
    });

    it("should say the summary in the caption of a chart that is one image", () => {
      render(chart());

      expect(screen.getByText(SUMMARY).closest("[aria-hidden='true']")).toBeNull();
    });

    it("should mark the selected week's button as pressed and the others as not", () => {
      render(chart({ onSelectWeek: () => undefined, selectedWeek: weekAt(6) }));

      expect(screen.getByRole("button", { name: "7 Sep", pressed: true })).toBeDefined();
      expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(11);
    });

    it("should leave the buttons without a pressed state when no week is selected", () => {
      render(chart({ onSelectWeek: () => undefined }));

      expect(screen.queryAllByRole("button", { pressed: true })).toHaveLength(0);
      expect(screen.queryAllByRole("button", { pressed: false })).toHaveLength(0);
    });

    it("should select the week a press is on", () => {
      const onSelectWeek = vi.fn();
      render(chart({ onSelectWeek }));

      fireEvent.click(screen.getByRole("button", { name: "7 Sep" }));

      expect(onSelectWeek).toHaveBeenCalledExactlyOnceWith(weekAt(6));
    });

    it("should take the keyboard's focus", () => {
      render(chart({ onSelectWeek: () => undefined }));

      const button = screen.getByRole("button", { name: "7 Sep" });
      button.focus();

      expect(document.activeElement).toBe(button);
    });

    it("should show an inset focus ring on a focused week", async () => {
      render(chart({ onSelectWeek: () => undefined }));

      const css = await compileUtilities(screen.getByRole("button", { name: "7 Sep" }).className);
      expect(css).toContain("--tw-ring-inset: inset");
    });

    it("should keep the chart one image named by the summary beside the buttons", () => {
      render(chart({ onSelectWeek: () => undefined }));

      expect(screen.getByRole("img", { name: SUMMARY })).toBeDefined();
      expect(within(screen.getByRole("img", { name: SUMMARY })).queryByRole("button")).toBeNull();
    });

    it("should lay each press target over its own column of the plot", () => {
      render(chart({ onSelectWeek: () => undefined }));

      const button = screen.getByRole("button", { name: "27 Jul" });
      expect(button.style.getPropertyValue("--column-left")).toBe("12px");
      expect(button.style.getPropertyValue("--column-width")).toBe("40px");
    });
  });
});
