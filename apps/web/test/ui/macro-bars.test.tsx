import { stagger } from "@keylow/tokens";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { compileUtilities, reducedMotionRules } from "./compileUtilities";

import type { MacroBarsProps } from "@/components/ui/MacroBars";

import { MacroBars } from "@/components/ui/MacroBars";

const under: MacroBarsProps = {
  protein: { eaten: 86, target: 160 },
  carbs: { eaten: 129.1, target: 220 },
  fat: { eaten: 19, target: 70 },
};
// The lasagne day on the diary canvas: fat is 11 g over and carbs 37 g.
const over: MacroBarsProps = {
  protein: { eaten: 150, target: 160 },
  carbs: { eaten: 257, target: 220 },
  fat: { eaten: 81, target: 70 },
};
const noTarget: MacroBarsProps = {
  protein: { eaten: 86, target: 0 },
  carbs: { eaten: 129.1, target: 0 },
  fat: { eaten: 19, target: 0 },
};

// The fills start empty and take their share two frames after the first draw. The frames are fake,
// so the test steps them by hand instead of racing a real clock under load.
function whipIn() {
  act(() => {
    vi.advanceTimersByTime(50);
  });
}

const fillOf = (macro: string) => screen.getByTestId(`${macro}-fill`);
const capOf = (macro: string) => screen.getByTestId(`${macro}-cap`);
const percentOf = (element: HTMLElement, property: "--fill" | "--cap") =>
  parseFloat(element.style.getPropertyValue(property));

describe("MacroBars", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe("rows", () => {
    it("should name each macro in words and say its grams against the target", () => {
      render(<MacroBars {...under} />);

      expect(screen.getByRole("group", { name: "Protein: 86 of 160 grams" })).toBeTruthy();
      expect(screen.getByRole("group", { name: "Carbs: 129 of 220 grams" })).toBeTruthy();
      expect(screen.getByRole("group", { name: "Fat: 19 of 70 grams" })).toBeTruthy();
    });

    it("should print the grams eaten over the target", () => {
      render(<MacroBars {...under} />);

      const protein = screen.getByRole("group", { name: /Protein/ });
      expect(within(protein).getByText("Protein")).toBeTruthy();
      expect(within(protein).getByText("86")).toBeTruthy();
      expect(within(protein).getByText("/ 160 g")).toBeTruthy();
    });

    it("should fill each bar by the share eaten", () => {
      render(<MacroBars {...under} />);
      whipIn();

      expect(percentOf(fillOf("protein"), "--fill")).toBeCloseTo(53.75, 6);
      expect(percentOf(fillOf("fat"), "--fill")).toBeCloseTo((19 / 70) * 100, 6);
    });

    it("should draw no cap and no delta while under target", () => {
      render(<MacroBars {...under} />);

      expect(screen.queryByTestId("protein-cap")).toBeNull();
      expect(screen.queryByText(/^\+/)).toBeNull();
    });
  });

  describe("over target", () => {
    it("should say how many grams over in the row's name", () => {
      render(<MacroBars {...over} />);

      expect(screen.getByRole("group", { name: "Fat: 81 of 70 grams, 11 over" })).toBeTruthy();
      expect(screen.getByRole("group", { name: "Carbs: 257 of 220 grams, 37 over" })).toBeTruthy();
    });

    it("should print the delta with a plus sign, in the warning ink", () => {
      render(<MacroBars {...over} />);

      const fat = within(screen.getByRole("group", { name: /Fat/ }));
      expect(fat.getByText("+11 g").className).toContain("text-warning");
      expect(within(screen.getByRole("group", { name: /Carbs/ })).getByText("+37 g")).toBeTruthy();
    });

    it("should complete the fill and add a warning cap", () => {
      render(<MacroBars {...over} />);
      whipIn();

      expect(percentOf(fillOf("fat"), "--fill")).toBe(100);
      expect(capOf("fat").getAttribute("class")).toContain("bg-warning");
      expect(percentOf(capOf("fat"), "--cap")).toBeCloseTo((11 / 70) * 100, 6);
    });

    it("should hatch the cap in the surface colour, so it is not colour alone", async () => {
      render(<MacroBars {...over} />);
      const css = await compileUtilities(capOf("fat").getAttribute("class") ?? "");

      expect(css).toContain("repeating-linear-gradient(-45deg");
      expect(css).toContain("var(--kl-surface)");
    });

    it("should stop the cap at 35 per cent of the bar", () => {
      render(<MacroBars {...over} carbs={{ eaten: 400, target: 220 }} />);
      whipIn();

      expect(percentOf(capOf("carbs"), "--cap")).toBe(35);
    });

    it("should draw no cap for a macro that is still under", () => {
      render(<MacroBars {...over} />);

      expect(screen.queryByTestId("protein-cap")).toBeNull();
    });
  });

  describe("no target", () => {
    it("should keep the bar empty and show only the grams", () => {
      render(<MacroBars {...noTarget} />);
      whipIn();

      const protein = screen.getByRole("group", { name: "Protein: 86 grams" });
      expect(within(protein).getByText("86")).toBeTruthy();
      expect(within(protein).getByText("g")).toBeTruthy();
      expect(within(protein).queryByText(/\//)).toBeNull();
      expect(percentOf(fillOf("protein"), "--fill")).toBe(0);
    });
  });

  describe("compact", () => {
    it("should use a shorter bar", () => {
      render(<MacroBars {...under} compact />);

      expect(screen.getByTestId("protein-bar").className).toContain("h-1.5");
    });

    it("should use the regular bar by default", () => {
      render(<MacroBars {...under} />);

      expect(screen.getByTestId("protein-bar").className).toContain("h-2");
    });
  });

  describe("motion", () => {
    it("should start each bar a stagger later than the one above", () => {
      render(<MacroBars {...under} />);

      // The classes are literals so Tailwind sees them, and the token is what they must equal.
      expect(fillOf("protein").className).toContain(`delay-[${0 * stagger}ms]`);
      expect(fillOf("carbs").className).toContain(`delay-[${1 * stagger}ms]`);
      expect(fillOf("fat").className).toContain(`delay-[${2 * stagger}ms]`);
    });

    it("should draw without a transition under reduced motion", async () => {
      render(<MacroBars {...over} />);
      const css = await compileUtilities(
        `${fillOf("fat").getAttribute("class")} ${screen.getByTestId("fat-cap").getAttribute("class")}`,
      );

      expect(reducedMotionRules(css, "motion-reduce\\:transition-none")).toContain("transition");
    });
  });
});
