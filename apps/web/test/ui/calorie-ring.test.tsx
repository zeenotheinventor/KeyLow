import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { compileUtilities, reducedMotionRules } from "./compileUtilities";

import type { CalorieRingProps } from "@/components/ui/CalorieRing";

import { CalorieRing } from "@/components/ui/CalorieRing";

// The day on the diary canvas: 1,039 eaten of 2,200, so 1,161 left. The over day is a lasagne on top.
const under = { eaten: 1039, target: 2200 };
const over = { eaten: 2412, target: 2200 };
// The ring's line is 14 across at 200, so the circle through its middle has this length.
const circumference = Math.PI * (200 - 14);

function renderRing(props: Partial<CalorieRingProps> = {}) {
  return render(<CalorieRing {...under} {...props} />);
}

const mediaListeners = new Set<() => void>();
let isReducedMotionOn = false;

function setReducedMotion(isReduced: boolean) {
  isReducedMotionOn = isReduced;
  mediaListeners.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return isReducedMotionOn && query === "(prefers-reduced-motion: reduce)";
    },
    addEventListener: (_type: string, listener: () => void) => mediaListeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => mediaListeners.delete(listener),
  }));
}

// The person switches the system setting while the page is open.
function switchReducedMotion(isReduced: boolean) {
  isReducedMotionOn = isReduced;
  act(() => {
    mediaListeners.forEach((listener) => {
      listener();
    });
  });
}

// The fills start empty and take their share two frames after the first draw.
function whipIn() {
  wait(50);
}

function wait(milliseconds: number) {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

describe("CalorieRing", () => {
  beforeEach(() => {
    setReducedMotion(false);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("reading", () => {
    it("should be one image that says what was eaten, the target and what is left", () => {
      renderRing();

      expect(screen.getByRole("img", { name: "1,161 calories remaining of 2,200" })).toBeTruthy();
    });

    it("should print the calories left as the numeral, under a caption", () => {
      renderRing();

      expect(screen.getByText("1,161")).toBeTruthy();
      expect(screen.getByText("remaining")).toBeTruthy();
    });

    it("should print the eaten and target lines", () => {
      renderRing();

      expect(screen.getByText("1,039 eaten")).toBeTruthy();
      expect(screen.getByText("2,200 target (est.)")).toBeTruthy();
    });

    it("should use the caption it is given while the day is under target", () => {
      renderRing({ label: "left today" });

      expect(screen.getByText("left today")).toBeTruthy();
    });
  });

  describe("estimate", () => {
    it("should say the target is an estimate by default", () => {
      renderRing();

      expect(screen.getByText("2,200 target (est.)")).toBeTruthy();
    });

    it("should leave (est.) off when the target is not an estimate", () => {
      renderRing({ estimate: false });

      expect(screen.getByText("2,200 target")).toBeTruthy();
      expect(screen.queryByText(/est\./)).toBeNull();
    });
  });

  describe("size", () => {
    it("should draw the numeral at 44 over 48, as the diary canvas sets it", () => {
      renderRing();

      const numeral = screen.getByText("1,161");
      expect(numeral.className).toContain("text-[44px]");
      expect(numeral.className).toContain("leading-[48px]");
    });

    it("should be 200 across with a 14 line by default", () => {
      renderRing();

      const track = within(screen.getByRole("img")).getByTestId("ring-track");
      expect(track.closest("svg")?.getAttribute("width")).toBe("200");
      expect(track.getAttribute("stroke-width")).toBe("14");
      expect(track.getAttribute("r")).toBe("93");
    });

    it("should keep the text 28 in from the ring's edge, as the diary canvas draws it", async () => {
      renderRing();
      const textBox = screen.getByText("1,161").parentElement;
      const css = await compileUtilities(textBox?.getAttribute("class") ?? "");

      expect(css).toMatch(/\.inset-7\s*\{[^}]*inset:\s*1\.75rem/);
    });

    it("should be compact under 180: a heading size numeral and no eaten or target lines", () => {
      renderRing({ size: 160 });

      expect(screen.getByText("1,161").className).toContain("text-h1");
      expect(screen.queryByText("1,039 eaten")).toBeNull();
      expect(screen.queryByText(/target/)).toBeNull();
    });
  });

  describe("fill", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    });

    it("should fill the share that was eaten, from twelve o'clock", () => {
      renderRing();
      whipIn();

      const arc = screen.getByTestId("ring-eaten-arc");
      expect(Number(arc.getAttribute("stroke-dashoffset"))).toBeCloseTo(
        circumference * (1 - 1039 / 2200),
        3,
      );
    });

    it("should draw no outline while the day is under target", () => {
      renderRing();

      expect(screen.queryByTestId("ring-outer-outline")).toBeNull();
      expect(screen.queryByTestId("ring-inner-outline")).toBeNull();
    });

    it("should be full, with no outline, at the target", () => {
      renderRing({ eaten: 2200 });
      whipIn();

      expect(Number(screen.getByTestId("ring-eaten-arc").getAttribute("stroke-dashoffset"))).toBe(
        0,
      );
      expect(screen.queryByTestId("ring-outer-outline")).toBeNull();
    });

    it("should draw no calories arc while nothing is eaten, so a round cap leaves no dot", () => {
      renderRing({ eaten: 0 });

      expect(screen.queryByTestId("ring-eaten-arc")).toBeNull();
    });
  });

  describe("over target", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    });

    it("should fill the ring completely in the calories colour", () => {
      renderRing(over);
      whipIn();

      const arc = screen.getByTestId("ring-eaten-arc");
      expect(Number(arc.getAttribute("stroke-dashoffset"))).toBe(0);
      expect(arc.getAttribute("class")).toContain("stroke-calories");
    });

    it("should gain an outline outside the stroke, a 1 px gap then a 1.5 px line", () => {
      renderRing(over);

      const outer = screen.getByTestId("ring-outer-outline");
      expect(outer.getAttribute("r")).toBe("101.75");
      expect(outer.getAttribute("stroke-width")).toBe("1.5");
    });

    it("should gain an outline inside the stroke, with the same gap and line", () => {
      renderRing(over);

      const inner = screen.getByTestId("ring-inner-outline");
      expect(inner.getAttribute("r")).toBe("84.25");
      expect(inner.getAttribute("stroke-width")).toBe("1.5");
    });

    it("should keep the outline to the same radii when the ring is a different size", () => {
      renderRing({ ...over, size: 160, stroke: 10 });

      // r + stroke / 2 + 1.75 and r - stroke / 2 - 1.75, with r = 75.
      expect(screen.getByTestId("ring-outer-outline").getAttribute("r")).toBe("81.75");
      expect(screen.getByTestId("ring-inner-outline").getAttribute("r")).toBe("68.25");
    });

    it.each(["ring-outer-outline", "ring-inner-outline"])(
      "should draw %s in the calories colour mixed 55 per cent with white, which both themes resolve",
      async (testId) => {
        renderRing(over);
        const css = await compileUtilities(screen.getByTestId(testId).getAttribute("class") ?? "");

        expect(css).toContain("stroke: color-mix(in srgb,rgb(var(--kl-calories)) 55%,white)");
      },
    );

    it("should let the outer outline show outside the svg", () => {
      renderRing(over);

      expect(screen.getByTestId("ring-track").closest("svg")?.getAttribute("class")).toContain(
        "overflow-visible",
      );
    });

    it("should draw no warning arc, gap or class", () => {
      renderRing(over);

      expect(screen.getByRole("img").innerHTML).not.toContain("warning");
    });

    it("should keep the numeral and the caption in primary and secondary ink, and read the amount over", () => {
      renderRing(over);

      expect(screen.getByText("212").className).toContain("text-text-primary");
      expect(screen.getByText("over target").className).toContain("text-text-secondary");
      expect(screen.getByRole("img", { name: "212 calories over target of 2,200" })).toBeTruthy();
    });

    it("should never turn to danger", () => {
      renderRing(over);

      expect(screen.getByRole("img").innerHTML).not.toContain("danger");
    });

    it("should keep the numeral and caption in their usual ink while under target", () => {
      renderRing();

      expect(screen.getByText("1,161").className).toContain("text-text-primary");
      expect(screen.getByText("remaining").className).toContain("text-text-secondary");
    });
  });

  describe("no target", () => {
    const noTarget = { eaten: 1039, target: 0 };

    it("should be named by the calories eaten and say no target is set", () => {
      renderRing(noTarget);

      expect(screen.getByRole("img", { name: "1,039 calories eaten, no target set" })).toBeTruthy();
    });

    it("should print the calories eaten as the numeral under the caption eaten", () => {
      renderRing(noTarget);

      expect(screen.getByText("1,039")).toBeTruthy();
      expect(screen.getByText("eaten")).toBeTruthy();
    });

    it("should keep the caption eaten whatever label it is given", () => {
      renderRing({ ...noTarget, label: "left today" });

      expect(screen.getByText("eaten")).toBeTruthy();
      expect(screen.queryByText("left today")).toBeNull();
    });

    it("should print no eaten or target lines", () => {
      renderRing(noTarget);

      expect(screen.queryByText("1,039 eaten")).toBeNull();
      expect(screen.queryByText(/target/)).toBeNull();
    });

    it("should draw only the track: no fill and no outline", () => {
      renderRing(noTarget);

      expect(screen.getByTestId("ring-track")).toBeTruthy();
      expect(screen.queryByTestId("ring-eaten-arc")).toBeNull();
      expect(screen.queryByTestId("ring-outer-outline")).toBeNull();
    });
  });

  describe("count up", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("should show the number at once on the first draw", () => {
      renderRing();

      expect(screen.getByText("1,161").className).not.toContain("animate-flash");
    });

    it("should count to a new number over 400 ms, without jumping", () => {
      const { rerender } = renderRing();

      rerender(<CalorieRing eaten={1500} target={2200} />);
      wait(100);
      const midway = Number(screen.getByText(/^[\d,]+$/).textContent.replace(",", ""));

      expect(midway).toBeLessThan(1161);
      expect(midway).toBeGreaterThan(700);
      wait(400);
      expect(screen.getByText("700")).toBeTruthy();
    });

    it("should flash the accent when the count arrives", () => {
      const { rerender } = renderRing();

      rerender(<CalorieRing eaten={1500} target={2200} />);
      wait(500);

      expect(screen.getByText("700").className).toContain("animate-flash");
    });

    it("should jump straight to a new number, and never flash, with reduced motion", () => {
      setReducedMotion(true);
      const { rerender } = renderRing();

      rerender(<CalorieRing eaten={1500} target={2200} />);

      expect(screen.getByText("700").className).not.toContain("animate-flash");
      wait(500);
      expect(screen.getByText("700").className).not.toContain("animate-flash");
    });
  });

  describe("reduced motion", () => {
    it("should draw a day whose calories are not a number without throwing", () => {
      setReducedMotion(true);

      expect(() => renderRing({ eaten: Number.NaN })).not.toThrow();
    });

    it("should not show a stale number when reduced motion is switched off", () => {
      vi.useFakeTimers();
      setReducedMotion(true);
      const { rerender } = renderRing();
      rerender(<CalorieRing eaten={1500} target={2200} />);
      expect(screen.getByText("700")).toBeTruthy();

      switchReducedMotion(false);

      expect(screen.queryByText("1,161")).toBeNull();
      // Nothing counts from the old number towards the target, so it holds at the target and never flashes.
      wait(100);
      expect(screen.getByText("700")).toBeTruthy();
      wait(500);
      expect(screen.getByText("700").className).not.toContain("animate-flash");
    });

    it("should draw the fill without a transition", async () => {
      renderRing(over);
      const css = await compileUtilities(
        screen.getByTestId("ring-eaten-arc").getAttribute("class") ?? "",
      );

      expect(reducedMotionRules(css, "motion-reduce\\:transition-none")).toContain("transition");
    });

    it("should hold the numeral still instead of flashing", async () => {
      renderRing();
      const css = await compileUtilities(`motion-reduce:animate-none animate-flash`);

      expect(reducedMotionRules(css, "motion-reduce\\:animate-none")).toContain("animation");
      expect(css).toContain("@keyframes flash");
    });
  });
});
