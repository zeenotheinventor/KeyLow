import { cleanup, render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkingLine } from "@/components/assistant/WorkingLine";

// The line's polite note is the only node with this attribute, which is how a test reads what a screen reader is told.
function announced(container: HTMLElement): string {
  return container.querySelector("[aria-live='polite']")?.textContent ?? "";
}

describe("WorkingLine", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("should be a status that shows the words of the step", () => {
    render(<WorkingLine text="Looking up toast" />);

    expect(screen.getByRole("status").textContent).toBe("Looking up toast");
  });

  it("should draw the animated Ki-Lo logo before the words, hidden from a screen reader", () => {
    render(<WorkingLine text="Looking up toast" />);
    const status = screen.getByRole("status");

    const mark = status.firstElementChild;
    expect(mark?.tagName.toLowerCase()).toBe("svg");
    expect(mark?.getAttribute("aria-hidden")).toBe("true");
    expect(mark?.classList.contains("size-5")).toBe(true);
    expect(mark?.querySelectorAll("[class*='animate-loading']")).toHaveLength(5);
  });

  it("should not be a live region itself, which would read every step", () => {
    render(<WorkingLine text="Looking up toast" />);

    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("off");
  });

  it("should announce the words once when it mounts", () => {
    const { container } = render(<WorkingLine text="Looking up toast" />);

    expect(announced(container)).toBe("Looking up toast");
  });

  it("should hold each step's words for 700 ms before the next replace them", () => {
    const { rerender } = render(<WorkingLine text="Looking up toast" />);

    rerender(<WorkingLine text="Thinking" />);
    expect(screen.getByRole("status").textContent).toBe("Looking up toast");

    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(screen.getByRole("status").textContent).toBe("Thinking");
  });

  it("should announce no step before 5 seconds have passed since the last announcement", () => {
    const { container, rerender } = render(<WorkingLine text="Looking up toast" />);

    rerender(<WorkingLine text="Thinking" />);
    act(() => {
      vi.advanceTimersByTime(700);
    });
    rerender(<WorkingLine text="Saving" />);
    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(screen.getByRole("status").textContent).toBe("Saving");
    expect(announced(container)).toBe("Looking up toast");
  });

  it("should announce a step once 5 seconds have passed", () => {
    const { container, rerender } = render(<WorkingLine text="Looking up toast" />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    rerender(<WorkingLine text="Thinking" />);

    expect(screen.getByRole("status").textContent).toBe("Thinking");
    expect(announced(container)).toBe("Thinking");
  });
});
