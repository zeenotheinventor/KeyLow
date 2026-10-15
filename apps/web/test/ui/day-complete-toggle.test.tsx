import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { compileUtilities, reducedMotionRules } from "./compileUtilities";

import { DayCompleteToggle } from "@/components/ui/DayCompleteToggle";

describe("DayCompleteToggle", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be an off switch that offers to mark the day complete", () => {
    render(<DayCompleteToggle />);

    const toggle = screen.getByRole("switch", { name: /Mark day complete/ });

    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText("Complete days feed the expenditure estimate")).toBeTruthy();
  });

  it("should be an on switch that says the day is complete", () => {
    render(<DayCompleteToggle complete />);

    const toggle = screen.getByRole("switch", { name: /Day complete/ });

    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Counted in your expenditure estimate")).toBeTruthy();
  });

  it("should ask for complete when an off switch is pressed", () => {
    const onChange = vi.fn();
    render(<DayCompleteToggle onChange={onChange} />);

    fireEvent.click(screen.getByRole("switch"));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("should ask for not complete when an on switch is pressed", () => {
    const onChange = vi.fn();
    render(<DayCompleteToggle complete onChange={onChange} />);

    fireEvent.click(screen.getByRole("switch"));

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("should not respond when disabled", () => {
    const onChange = vi.fn();
    render(<DayCompleteToggle disabled onChange={onChange} />);

    fireEvent.click(screen.getByRole("switch"));

    expect(screen.getByRole("switch")).toHaveProperty("disabled", true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("should show a focus ring for the keyboard", () => {
    render(<DayCompleteToggle />);

    expect(screen.getByRole("switch").className).toContain("focus-visible:ring-2");
  });

  // The slash is a decorative flourish hidden from assistive technology, so it has no role or name
  // to query by. A test id is the only way to find it.
  describe("the slash", () => {
    // The diary keeps one toggle mounted and answers a press by setting `complete`, so the parent is
    // played here by a rerender after the press.
    function pressAndAccept(rerender: (ui: React.ReactElement) => void) {
      fireEvent.click(screen.getByRole("switch"));
      rerender(<DayCompleteToggle complete />);
    }

    it("should not draw the slash when it first shows a complete day", () => {
      render(<DayCompleteToggle complete />);

      expect(screen.queryByTestId("day-complete-slash")).toBeNull();
    });

    it("should draw the slash and punch the label in when a press from off is accepted", () => {
      const { rerender } = render(<DayCompleteToggle complete={false} />);

      pressAndAccept(rerender);

      expect(screen.queryByTestId("day-complete-slash")?.getAttribute("aria-hidden")).toBe("true");
      expect(screen.getByText("Day complete").className).toContain("animate-punch");
    });

    it("should play nothing when the day becomes complete with no press", () => {
      const { rerender } = render(<DayCompleteToggle complete={false} />);

      rerender(<DayCompleteToggle complete />);

      expect(screen.queryByTestId("day-complete-slash")).toBeNull();
      expect(screen.getByText("Day complete").className).not.toContain("animate-punch");
    });

    it("should still play it when the parent accepts the press after a delay", () => {
      vi.useFakeTimers();
      const { rerender } = render(<DayCompleteToggle complete={false} />);
      fireEvent.click(screen.getByRole("switch"));

      act(() => {
        vi.advanceTimersByTime(500);
      });
      rerender(<DayCompleteToggle complete />);
      vi.useRealTimers();

      expect(screen.queryByTestId("day-complete-slash")).not.toBeNull();
      expect(screen.getByText("Day complete").className).toContain("animate-punch");
    });

    it("should play only for the pressed completion, not for an outside unmark and re-mark", () => {
      const { rerender } = render(<DayCompleteToggle complete={false} />);
      pressAndAccept(rerender);

      rerender(<DayCompleteToggle complete={false} />);
      rerender(<DayCompleteToggle complete />);

      expect(screen.queryByTestId("day-complete-slash")).toBeNull();
      expect(screen.getByText("Day complete").className).not.toContain("animate-punch");
    });

    it("should stay quiet when the day is unmarked", () => {
      const { rerender } = render(<DayCompleteToggle complete />);

      rerender(<DayCompleteToggle complete={false} />);

      expect(screen.queryByTestId("day-complete-slash")).toBeNull();
      expect(screen.getByText("Mark day complete").className).not.toContain("animate-punch");
    });

    it("should not animate the slash or the punch under prefers-reduced-motion", async () => {
      const { rerender } = render(<DayCompleteToggle complete={false} />);
      pressAndAccept(rerender);
      const classes = [
        screen.queryByTestId("day-complete-slash")?.className,
        screen.getByText("Day complete").className,
      ].join(" ");
      const css = await compileUtilities(classes);

      expect(reducedMotionRules(css, "motion-reduce\\:animate-none")).toContain("animation: none");
    });
  });
});
