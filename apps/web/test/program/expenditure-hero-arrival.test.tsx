import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExpenditureHeroView } from "@keylow/core/program";

import { ExpenditureHeroCard } from "@/components/program/ExpenditureHeroCard";

const HERO: ExpenditureHeroView = {
  name: "Your estimate, 2,580 kilocalories a day, likely 2,430 to 2,730",
  muKcal: 2580,
  isSettling: false,
  rangeText: "Likely 2,430 to 2,730 kcal",
  captionText: "Worked out from your weigh-ins and your food.",
};
const ARRIVAL = { fromKcal: 2500 };

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

// Frames are run by hand, so a test chooses when each one comes and what the clock says then, as a tab that
// was in the background does when its frames come late.
let clock = 0;
let queuedFrames = new Map<number, FrameRequestCallback>();
let lastFrameId = 0;

function frameAt(time: number) {
  clock = time;
  const due = [...queuedFrames.values()];
  queuedFrames = new Map();
  act(() => {
    for (const run of due) {
      run(time);
    }
  });
}

// Runs frames 16 ms apart until `milliseconds` have gone by.
function wait(milliseconds: number) {
  const end = clock + milliseconds;
  while (clock < end) {
    frameAt(Math.min(clock + 16, end));
  }
}

// The figure the eye sees: the numeral the card draws, hidden from a screen reader while it counts.
const numeral = () => {
  const [figure] = screen.getAllByText(/^[\d,]+$/, { selector: "span[aria-hidden]" });
  if (figure === undefined) {
    throw new Error("The card should draw its figure");
  }
  return figure;
};
const shownKcal = () => Number(numeral().textContent.replaceAll(",", ""));

beforeEach(() => {
  clock = 0;
  queuedFrames = new Map();
  lastFrameId = 0;
  vi.stubGlobal("requestAnimationFrame", (run: FrameRequestCallback) => {
    lastFrameId += 1;
    queuedFrames.set(lastFrameId, run);
    return lastFrameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    queuedFrames.delete(id);
  });
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  setReducedMotion(false);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("the estimate card when a check-in has just arrived", () => {
  it("should show the estimate at once and flash nothing when no check-in has arrived", () => {
    render(<ExpenditureHeroCard view={HERO} arrival={null} />);
    wait(50);

    expect(screen.getByText("2,580").className).not.toContain("animate-flash");
    expect(screen.getByText("2,580").getAttribute("aria-hidden")).toBeNull();
  });

  it("should not move when the estimate changes without a check-in having arrived", () => {
    const { rerender } = render(<ExpenditureHeroCard view={HERO} arrival={null} />);

    rerender(<ExpenditureHeroCard view={{ ...HERO, muKcal: 2600 }} arrival={null} />);
    wait(100);

    expect(screen.getByText("2,600")).toBeTruthy();
  });

  it("should begin at the estimate before the check-in, in the accent", () => {
    render(<ExpenditureHeroCard view={HERO} arrival={ARRIVAL} />);

    expect(shownKcal()).toBe(2500);
    expect(numeral().className).toContain("animate-flash");
  });

  it("should count up to the new estimate over 400 ms without jumping", () => {
    render(<ExpenditureHeroCard view={HERO} arrival={ARRIVAL} />);

    wait(100);
    const midway = shownKcal();
    expect(midway).toBeGreaterThan(2500);
    expect(midway).toBeLessThan(2580);

    wait(500);
    expect(shownKcal()).toBe(2580);
  });

  it("should end on the right figure when the tab was in the background for the whole count", () => {
    render(<ExpenditureHeroCard view={HERO} arrival={ARRIVAL} />);
    wait(16);

    // A hidden tab pauses its frames, and the next one comes half a minute late.
    frameAt(30_000);

    expect(shownKcal()).toBe(2580);
  });

  it("should give a screen reader the final figure alone, never a number on the way", () => {
    render(<ExpenditureHeroCard view={HERO} arrival={ARRIVAL} />);
    const hiddenFigures = new Set<string>();

    for (let frame = 0; frame < 30; frame += 1) {
      hiddenFigures.add(numeral().textContent);
      wait(16);
    }

    expect(hiddenFigures.size).toBeGreaterThan(2);
    const heard = screen
      .getAllByText(/^[\d,]+$/)
      .filter((figure) => figure.getAttribute("aria-hidden") === null);
    expect(heard.map((figure) => figure.textContent)).toEqual(["2,580"]);
  });

  it("should show the estimate at once, with no flash, under reduced motion", () => {
    setReducedMotion(true);

    render(<ExpenditureHeroCard view={HERO} arrival={ARRIVAL} />);

    expect(shownKcal()).toBe(2580);
    expect(numeral().className).not.toContain("animate-flash");
    wait(500);
    expect(shownKcal()).toBe(2580);
  });

  it("should not jump back when the arrival is gone from a later draw", () => {
    const { rerender } = render(<ExpenditureHeroCard view={HERO} arrival={ARRIVAL} />);
    wait(600);

    rerender(<ExpenditureHeroCard view={HERO} arrival={null} />);
    wait(100);

    expect(shownKcal()).toBe(2580);
  });
});
