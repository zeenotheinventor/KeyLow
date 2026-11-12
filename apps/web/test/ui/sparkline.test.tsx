import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { SparklineProps } from "@/components/ui/Sparkline";

import { Sparkline } from "@/components/ui/Sparkline";

const RISING = [40, 42.5, 45, 47.5, 50, 55];

function sparkline(props: Partial<SparklineProps> = {}) {
  return <Sparkline label="Barbell row, up 15 kg" points={RISING} {...props} />;
}

function drawing() {
  const svg = document.querySelector("svg");
  if (svg === null) {
    throw new Error("The sparkline has no drawing");
  }
  return {
    svg,
    lines: Array.from(svg.querySelectorAll("path")),
    dots: Array.from(svg.querySelectorAll("circle")),
  };
}

function firstOf<Mark extends Element>(marks: readonly Mark[]): Mark {
  const [mark] = marks;
  if (mark === undefined) {
    throw new Error("Expected a mark and found none");
  }
  return mark;
}

const numberOf = (element: Element, name: string) => Number(element.getAttribute(name));
const hasClass = (element: Element, name: string) => element.classList.contains(name);

afterEach(cleanup);

describe("Sparkline", () => {
  describe("accessibility", () => {
    it("should be an image named by the label", () => {
      render(sparkline());

      expect(screen.getByRole("img", { name: "Barbell row, up 15 kg" })).toBe(drawing().svg);
    });

    it("should hide from a screen reader when decorative", () => {
      render(sparkline({ decorative: true }));

      expect(screen.queryByRole("img")).toBeNull();
      expect(drawing().svg.getAttribute("aria-hidden")).toBe("true");
    });
  });

  describe("the default size", () => {
    it("should be 64 by 20", () => {
      render(sparkline());

      const { svg } = drawing();
      expect(numberOf(svg, "width")).toBe(64);
      expect(numberOf(svg, "height")).toBe(20);
      expect(svg.getAttribute("viewBox")).toBe("0 0 64 20");
    });

    it("should draw the line 1.5 wide, inset 3, from the first reading to the last", () => {
      render(sparkline());

      const line = firstOf(drawing().lines);
      expect(line.getAttribute("d")).toMatch(/^M3 17 /);
      expect(line.getAttribute("d")).toMatch(/L61 3$/);
      expect(hasClass(line, "stroke-[1.5]")).toBe(true);
      expect(line.getAttribute("stroke-linecap")).toBe("round");
      expect(line.getAttribute("stroke-linejoin")).toBe("round");
    });

    it("should put a dot of 2 in the marker colour on the latest reading", () => {
      render(sparkline());

      const dot = firstOf(drawing().dots);
      expect(drawing().dots).toHaveLength(1);
      expect(numberOf(dot, "r")).toBe(2);
      expect(numberOf(dot, "cx")).toBe(61);
      expect(numberOf(dot, "cy")).toBe(3);
      expect(hasClass(dot, "fill-chart-marker")).toBe(true);
    });

    it("should draw a line in the chart's trend colour", () => {
      render(sparkline());

      expect(hasClass(firstOf(drawing().lines), "stroke-chart-trend")).toBe(true);
    });
  });

  describe("gaps", () => {
    it("should break the line at a skipped week", () => {
      render(sparkline({ points: [40, 42.5, 45, null, null, 50, 52.5, 55] }));

      expect(drawing().lines).toHaveLength(2);
    });

    it("should draw a reading with a gap either side as a dot of 1.5 and no line", () => {
      render(sparkline({ points: [40, 42.5, null, 47.5, null, 52.5, 55] }));

      const { lines, dots } = drawing();
      expect(lines).toHaveLength(2);
      expect(dots.map((dot) => numberOf(dot, "r")).sort()).toEqual([1.5, 2]);
    });

    it("should draw a reading alone as the dot of the latest", () => {
      render(sparkline({ points: [null, null, 47.5, null] }));

      const { lines, dots } = drawing();
      expect(lines).toHaveLength(0);
      expect(dots).toHaveLength(1);
      expect(numberOf(firstOf(dots), "r")).toBe(2);
    });

    it("should draw nothing without a reading", () => {
      render(sparkline({ points: [null, null] }));

      expect(drawing().lines).toHaveLength(0);
      expect(drawing().dots).toHaveLength(0);
    });

    it("should place a series with its front padded with gaps by its date", () => {
      render(sparkline({ points: [null, null, null, 40, 50] }));

      expect(firstOf(drawing().lines).getAttribute("d")).toMatch(/^M\d+(\.\d+)? 17 L61 3$/);
    });
  });

  describe("tones", () => {
    it("should draw a positive line and dot in the success ink", () => {
      render(sparkline({ tone: "positive" }));

      const { lines, dots } = drawing();
      expect(hasClass(firstOf(lines), "stroke-success-ink")).toBe(true);
      expect(hasClass(firstOf(dots), "fill-success-ink")).toBe(true);
    });

    it("should draw a negative line and dot in the danger colour", () => {
      render(sparkline({ tone: "negative" }));

      const { lines, dots } = drawing();
      expect(hasClass(firstOf(lines), "stroke-danger")).toBe(true);
      expect(hasClass(firstOf(dots), "fill-danger")).toBe(true);
    });
  });

  describe("the wide size", () => {
    it("should be 128 by 40 with the line 2 wide, inset 4", () => {
      render(sparkline({ size: "wide" }));

      const { svg, lines } = drawing();
      expect(numberOf(svg, "width")).toBe(128);
      expect(numberOf(svg, "height")).toBe(40);
      expect(firstOf(lines).getAttribute("d")).toMatch(/^M4 36 /);
      expect(hasClass(firstOf(lines), "stroke-2")).toBe(true);
    });

    it("should put a dot of 3.5 ringed 2 in the surface colour on the latest reading", () => {
      render(sparkline({ size: "wide" }));

      const dot = firstOf(drawing().dots);
      expect(numberOf(dot, "r")).toBe(3.5);
      expect(numberOf(dot, "cx")).toBe(124);
      expect(hasClass(dot, "stroke-surface")).toBe(true);
      expect(hasClass(dot, "stroke-2")).toBe(true);
    });

    it("should draw each reading alone as a dot of 2", () => {
      render(sparkline({ size: "wide", points: [40, null, 47.5, null, 52.5] }));

      const radii = drawing().dots.map((dot) => numberOf(dot, "r"));
      expect(radii.sort()).toEqual([2, 2, 3.5]);
    });
  });
});
