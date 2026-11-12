import { prepareBodyCompositionChart } from "@keylow/core/weight";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DESKTOP, FakeResizeObserver, PHONE, resizeTo, stubSize } from "./chartSizeFakes";

import type { BodySplitPoint, WeightRange } from "@keylow/core/weight";

import { BodyCompositionChart } from "@/components/weight/BodyCompositionChart";

const TODAY = "2026-10-17";
const NAME = "Body fat and lean mass over the last 30 days, body fat 18.4 kg, lean mass 63.7 kg";

// Body fat 20 to 18.4 and lean mass 63 to 63.7 over the last 30 days, one point a day.
function thirtyDays(): BodySplitPoint[] {
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(`${TODAY}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - (29 - index));

    return {
      date: date.toISOString().slice(0, 10),
      segment: 0,
      fat: 20 - (index * 1.6) / 29,
      lean: 63 + (index * 0.7) / 29,
    };
  });
}

function renderChart({
  points = thirtyDays(),
  range = 30,
  isSettling = false,
}: { points?: BodySplitPoint[]; range?: WeightRange; isSettling?: boolean } = {}) {
  return render(
    <BodyCompositionChart
      data={prepareBodyCompositionChart({ points, range, today: TODAY })}
      isSettling={isSettling}
      name={NAME}
    />,
  );
}

const figure = () => screen.getByRole("img", { name: NAME });
const numberOf = (element: Element, name: string) => Number(element.getAttribute(name));

// The drawing's marks have no role of their own, because the whole figure is one image, so they are read off
// it by the token class that colours each kind.
function marksOf(chart: HTMLElement) {
  return {
    marker: Array.from(chart.querySelectorAll("circle")),
    lines: Array.from(chart.querySelectorAll("path")),
    grid: Array.from(chart.querySelectorAll("line")),
  };
}

describe("the Composition figure", () => {
  beforeEach(() => {
    stubSize(DESKTOP);
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should be one image named by the caller, with every part hidden from a screen reader", () => {
    renderChart();

    const chart = figure();

    expect(chart.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(within(chart).queryByRole("img")).toBeNull();
    for (const text of ["Body fat", "Lean mass", "Today"]) {
      expect(within(chart).getByText(text).closest("[aria-hidden]")).not.toBeNull();
    }
  });

  it("should caption the top plot Body fat and the bottom plot Lean mass", () => {
    renderChart();

    const chart = figure();
    const [bodyFat, leanMass] = [
      within(chart).getByText("Body fat"),
      within(chart).getByText("Lean mass"),
    ];

    expect(
      bodyFat.compareDocumentPosition(leanMass) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("should label the first day, the middle day and today under the plots", () => {
    renderChart();

    const chart = figure();

    expect(within(chart).getByText("Today")).toBeTruthy();
    expect(within(chart).getByText("18 Sep")).toBeTruthy();
    expect(within(chart).getByText("2 Oct")).toBeTruthy();
  });

  describe("the plots", () => {
    it("should give each plot an axis of its own, labelled in whole numbers", () => {
      renderChart();

      const chart = figure();

      // Body fat 18.4 to 20 reads 16 to 22 in ticks of 2. Lean mass 63 to 63.7 reads 62 to 65 in ticks of 1.
      for (const label of ["16", "18", "20", "22", "62", "63", "64", "65"]) {
        expect(within(chart).getByText(label)).toBeTruthy();
      }
    });

    it("should draw four grid lines per plot ending where the value column starts, at 1280", () => {
      renderChart();

      const { grid } = marksOf(figure());

      // Lowest tick first, so the rows run up each plot. The top plot is 106 high: 16 above its highest tick
      // and 8 below its lowest. The bottom plot starts 114 down.
      const expected = [98, 70.67, 43.33, 16, 212, 184.67, 157.33, 130];
      expect(grid).toHaveLength(expected.length);
      expected.forEach((y, position) => {
        expect(numberOf(grid[position] ?? document.body, "y1")).toBeCloseTo(y, 1);
      });
      for (const line of grid) {
        expect(numberOf(line, "x1")).toBe(0);
        expect(numberOf(line, "x2")).toBe(DESKTOP.width - 40);
      }
    });

    it("should make the plots 76 high under the large breakpoint, so the two and the gap fill 160", () => {
      stubSize(PHONE);
      renderChart();

      const rows = marksOf(figure()).grid.map((line) => numberOf(line, "y1"));

      expect(Math.min(...rows.slice(0, 4))).toBe(16);
      expect(Math.max(...rows.slice(0, 4))).toBe(68);
      expect(Math.min(...rows.slice(4))).toBe(84 + 16);
      expect(Math.max(...rows.slice(4))).toBe(84 + 68);
    });

    it("should put a marker of radius 4.5 on the latest value of each plot, 44 from the right", () => {
      renderChart();

      const { marker } = marksOf(figure());

      expect(marker).toHaveLength(2);
      for (const circle of marker) {
        expect(numberOf(circle, "r")).toBe(4.5);
        expect(numberOf(circle, "cx")).toBe(DESKTOP.width - 44);
      }
      // 18.4 is 3.6 below the top of its axis of 6, and 63.7 is 1.3 below the top of its axis of 3.
      const [fatMarker, leanMarker] = marker;
      expect(numberOf(fatMarker ?? document.body, "cy")).toBeCloseTo(
        16 + ((22 - 18.4) / 6) * 82,
        1,
      );
      expect(numberOf(leanMarker ?? document.body, "cy")).toBeCloseTo(
        114 + 16 + ((65 - 63.7) / 3) * 82,
        1,
      );
    });

    it("should start the first day at the left inset", () => {
      renderChart();

      const [fatLine] = marksOf(figure()).lines;

      expect(fatLine?.getAttribute("d")).toMatch(/^M12\.0 /);
    });

    it("should draw each line unbroken and solid", () => {
      renderChart();

      const { lines } = marksOf(figure());

      expect(lines).toHaveLength(2);
      for (const line of lines) {
        expect(line.classList.contains("stroke-chart-trend")).toBe(true);
        expect(line.getAttribute("class")).not.toContain("stroke-dasharray");
      }
    });

    it("should dash both lines, 5 on and 4 off, while the trend settles", () => {
      renderChart({ isSettling: true });

      for (const line of marksOf(figure()).lines) {
        expect(line.getAttribute("class")).toContain("[stroke-dasharray:5_4]");
      }
    });

    it("should not join two runs of readings", () => {
      const points = thirtyDays().map((point, index) => ({
        ...point,
        segment: index < 10 ? 0 : 1,
      }));
      renderChart({ points });

      expect(marksOf(figure()).lines).toHaveLength(4);
    });

    it("should leave a run of one day to its marker, with no line", () => {
      renderChart({ points: thirtyDays().slice(-1) });

      const { lines, marker } = marksOf(figure());

      expect(lines).toHaveLength(0);
      expect(marker).toHaveLength(2);
    });
  });

  describe("a range with no point", () => {
    it("should draw both grids and the days, and no value, line or marker", () => {
      renderChart({ points: [] });

      const chart = figure();
      const { grid, lines, marker } = marksOf(chart);

      expect(grid).toHaveLength(6);
      expect(lines).toHaveLength(0);
      expect(marker).toHaveLength(0);
      expect(within(chart).queryByText(/^\d+$/)).toBeNull();
      expect(within(chart).getByText("Today")).toBeTruthy();
    });
  });

  describe("the box", () => {
    it("should draw nothing until the column has a size", () => {
      stubSize({ width: 0, height: 0 });
      renderChart();

      const { grid, lines, marker } = marksOf(figure());

      expect(grid).toHaveLength(0);
      expect(lines).toHaveLength(0);
      expect(marker).toHaveLength(0);
    });

    it("should follow the column to a new width and the breakpoint to a new height", () => {
      renderChart();
      expect(numberOf(marksOf(figure()).marker[0] ?? document.body, "cx")).toBe(754 - 44);

      act(() => {
        resizeTo(PHONE);
      });

      const chart = figure();
      expect(numberOf(marksOf(chart).marker[0] ?? document.body, "cx")).toBe(PHONE.width - 44);
      expect(chart.querySelector("svg")?.getAttribute("viewBox")).toBe(
        `0 0 ${PHONE.width} ${PHONE.height}`,
      );
      for (const line of marksOf(chart).grid) {
        expect(numberOf(line, "x2")).toBe(PHONE.width - 40);
      }
    });

    it("should be the weight chart's box: 160 high under the large breakpoint and 220 from it", () => {
      renderChart();

      const svg = figure().querySelector("svg");

      expect(svg?.getAttribute("class")).toContain("h-[160px]");
      expect(svg?.getAttribute("class")).toContain("lg:h-[220px]");
      expect(figure().getAttribute("class")).toContain("pt-3");
    });
  });
});
