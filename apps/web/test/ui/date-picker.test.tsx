import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DatePickerProps } from "@/components/ui/DatePicker";

import { DatePicker } from "@/components/ui/DatePicker";

// Thursday 15 October 2026, with the 12th and 13th complete.
const baseProps = {
  selectedDate: "2026-10-15",
  today: "2026-10-15",
  completeDays: ["2026-10-12", "2026-10-13"],
};

function Harness(props: Partial<DatePickerProps>) {
  const opener = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button ref={opener} type="button">
        Opener
      </button>
      <DatePicker
        {...baseProps}
        opener={opener}
        onSelectDate={() => undefined}
        onClose={() => undefined}
        {...props}
      />
    </div>
  );
}

function renderPicker(props: Partial<DatePickerProps> = {}) {
  const onSelectDate = vi.fn();
  const onClose = vi.fn();
  const onMonthChange = vi.fn();
  render(
    <Harness
      onSelectDate={onSelectDate}
      onClose={onClose}
      onMonthChange={onMonthChange}
      {...props}
    />,
  );
  return { onSelectDate, onClose, onMonthChange };
}

const cell = (name: string) => within(screen.getByRole("grid")).getByRole("button", { name });

afterEach(() => {
  cleanup();
});

describe("DatePicker", () => {
  it("should be a dialog named Choose a date", () => {
    renderPicker();

    expect(screen.getByRole("dialog", { name: "Choose a date" })).toBeTruthy();
  });

  it("should head the month and year of the selected day", () => {
    renderPicker();

    expect(screen.getByRole("heading", { name: "October 2026" })).toBeTruthy();
    expect(screen.getByRole("grid", { name: "October 2026" })).toBeTruthy();
  });

  it("should head the columns Monday to Sunday, first", () => {
    renderPicker();

    const heads = screen.getAllByRole("columnheader");

    expect(heads.map((head) => head.getAttribute("aria-label"))).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
    expect(heads.map((head) => head.textContent).join("")).toBe("MTWTFSS");
  });

  it("should put the 1st of October 2026 under Thursday", () => {
    renderPicker();
    const cells = screen.getAllByRole("gridcell").slice(0, 7);

    expect(cells.map((cellElement) => cellElement.textContent)).toEqual([
      "",
      "",
      "",
      "1",
      "2",
      "3",
      "4",
    ]);
  });

  describe("the days", () => {
    it("should name today and the selected day", () => {
      renderPicker();

      expect(cell("15 October, today, selected")).toBeTruthy();
    });

    it("should name a complete day and mark it with a dot", () => {
      renderPicker();

      const button = cell("13 October, complete");

      expect(button.querySelector('[aria-hidden="true"]')).not.toBeNull();
      expect(cell("14 October").querySelector('[aria-hidden="true"]')).toBeNull();
    });

    it("should fill the selected day and ring today", () => {
      renderPicker({ selectedDate: "2026-10-13" });

      expect(cell("13 October, selected, complete").className).toContain("bg-accent");
      expect(cell("15 October, today").className).toContain("border-accent");
      expect(cell("15 October, today").className).not.toContain("bg-accent");
    });

    it("should disable the days after today", () => {
      renderPicker();

      expect(cell("16 October")).toHaveProperty("disabled", true);
      expect(cell("14 October")).toHaveProperty("disabled", false);
    });

    it("should be at least 40 px across", () => {
      renderPicker();

      expect(cell("14 October").className).toContain("size-11");
    });

    it("should select a day and close, returning focus to the opener", () => {
      const { onSelectDate, onClose } = renderPicker();

      fireEvent.click(cell("14 October"));

      expect(onSelectDate).toHaveBeenCalledExactlyOnceWith("2026-10-14");
      expect(onClose).toHaveBeenCalledOnce();
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Opener" }));
    });

    it("should do nothing when a day after today is pressed", () => {
      const { onSelectDate } = renderPicker();

      fireEvent.click(cell("16 October"));

      expect(onSelectDate).not.toHaveBeenCalled();
    });
  });

  describe("the months", () => {
    it("should step to the month before and say which month it loaded", () => {
      const { onMonthChange } = renderPicker();

      fireEvent.click(screen.getByRole("button", { name: "Previous month" }));

      expect(screen.getByRole("heading", { name: "September 2026" })).toBeTruthy();
      expect(onMonthChange).toHaveBeenCalledExactlyOnceWith("2026-09");
    });

    it("should not step past the current month", () => {
      renderPicker();

      expect(screen.getByRole("button", { name: "Next month" })).toHaveProperty("disabled", true);
    });

    it("should step forward again from an earlier month", () => {
      renderPicker();

      fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
      fireEvent.click(screen.getByRole("button", { name: "Next month" }));

      expect(screen.getByRole("heading", { name: "October 2026" })).toBeTruthy();
    });

    it("should open on the month of the selected day, which is not always this month", () => {
      renderPicker({ selectedDate: "2026-08-20" });

      expect(screen.getByRole("heading", { name: "August 2026" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Next month" })).toHaveProperty("disabled", false);
    });
  });

  describe("the keyboard", () => {
    it("should put focus on the selected day when it opens", () => {
      renderPicker({ selectedDate: "2026-10-13" });

      expect(document.activeElement).toBe(cell("13 October, selected, complete"));
    });

    it("should make only one day a tab stop", () => {
      renderPicker();
      const tabStops = screen
        .getAllByRole("gridcell")
        .map((gridcell) => gridcell.querySelector("button"))
        .filter((button) => button !== null && button.tabIndex === 0);

      expect(tabStops).toHaveLength(1);
    });

    it.each([
      ["ArrowLeft", "12 October, complete"],
      ["ArrowRight", "14 October"],
      ["ArrowUp", "6 October"],
      ["ArrowDown", "20 October"],
      ["Home", "12 October, complete"],
      ["End", "18 October"],
    ])("should move focus on %s", (key, name) => {
      renderPicker({ selectedDate: "2026-10-13", today: "2026-10-31" });

      fireEvent.keyDown(cell("13 October, selected, complete"), { key });

      expect(document.activeElement).toBe(cell(name));
    });

    it("should not move past today", () => {
      renderPicker();

      fireEvent.keyDown(cell("15 October, today, selected"), { key: "ArrowRight" });
      expect(document.activeElement).toBe(cell("15 October, today, selected"));
      expect(cell("15 October, today, selected").tabIndex).toBe(0);
      expect(cell("16 October").tabIndex).toBe(-1);

      fireEvent.keyDown(cell("15 October, today, selected"), { key: "ArrowDown" });
      expect(document.activeElement).toBe(cell("15 October, today, selected"));
    });

    it("should carry focus into the month before when the arrows leave this one", () => {
      const { onMonthChange } = renderPicker({ selectedDate: "2026-10-01" });

      fireEvent.keyDown(cell("1 October, selected"), { key: "ArrowLeft" });

      expect(screen.getByRole("heading", { name: "September 2026" })).toBeTruthy();
      expect(document.activeElement).toBe(cell("30 September"));
      expect(onMonthChange).toHaveBeenCalledExactlyOnceWith("2026-09");
    });

    it("should change month on PageUp and PageDown, keeping the day", () => {
      renderPicker({ selectedDate: "2026-10-13", today: "2026-12-31" });

      fireEvent.keyDown(cell("13 October, selected, complete"), { key: "PageUp" });
      expect(screen.getByRole("heading", { name: "September 2026" })).toBeTruthy();
      expect(document.activeElement).toBe(cell("13 September"));

      fireEvent.keyDown(cell("13 September"), { key: "PageDown" });
      expect(screen.getByRole("heading", { name: "October 2026" })).toBeTruthy();
      expect(document.activeElement).toBe(cell("13 October, selected, complete"));
    });

    it("should not take focus from a month button after a key that moved nothing", () => {
      renderPicker();
      fireEvent.keyDown(cell("15 October, today, selected"), { key: "ArrowRight" });
      const previous = screen.getByRole("button", { name: "Previous month" });

      previous.focus();
      fireEvent.click(previous);

      expect(screen.getByRole("heading", { name: "September 2026" })).toBeTruthy();
      expect(document.activeElement).toBe(previous);
    });

    it("should keep focus in the grid when Next month disables itself on the current month", () => {
      renderPicker();
      const previous = screen.getByRole("button", { name: "Previous month" });
      fireEvent.click(previous);
      const next = screen.getByRole("button", { name: "Next month" });

      next.focus();
      fireEvent.click(next);

      expect(next).toHaveProperty("disabled", true);
      expect(document.activeElement).not.toBe(document.body);
      expect(screen.getByRole("grid").contains(document.activeElement)).toBe(true);
    });

    it("should close on Escape and return focus to the opener", () => {
      const { onClose } = renderPicker();

      fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).toHaveBeenCalledOnce();
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Opener" }));
    });
  });

  describe("an outside press", () => {
    it("should close", () => {
      const { onClose } = renderPicker();

      act(() => {
        fireEvent.pointerDown(document.body);
      });

      expect(onClose).toHaveBeenCalledOnce();
    });

    it("should not close for a press inside it", () => {
      const { onClose } = renderPicker();

      fireEvent.pointerDown(screen.getByRole("heading", { name: "October 2026" }));

      expect(onClose).not.toHaveBeenCalled();
    });

    it("should leave a press on the opener to the opener, which toggles the picker", () => {
      const { onClose } = renderPicker();

      fireEvent.pointerDown(screen.getByRole("button", { name: "Opener" }));

      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
