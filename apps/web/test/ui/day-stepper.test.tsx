import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { compileUtilities, reducedMotionRules } from "./compileUtilities";

import { DayStepper } from "@/components/ui/DayStepper";

// Thursday 15 October 2026. The stepper reads the calendar day in UTC here, so the tests do not
// depend on the machine's time zone.
const today = new Date("2026-10-15T12:00:00Z");
const yesterday = new Date("2026-10-14T12:00:00Z");
const olderDay = new Date("2026-10-12T12:00:00Z");

function renderStepper(props: Partial<React.ComponentProps<typeof DayStepper>> = {}) {
  return render(<DayStepper date={today} today={today} timeZone="UTC" {...props} />);
}

describe("DayStepper", () => {
  afterEach(() => {
    cleanup();
  });

  describe("the label", () => {
    it("should say Today with the date in words under it", () => {
      renderStepper();

      expect(screen.getByText("Today")).toBeTruthy();
      expect(screen.getByText("15 October")).toBeTruthy();
    });

    it("should say Yesterday with the date in words under it", () => {
      renderStepper({ date: yesterday });

      expect(screen.getByText("Yesterday")).toBeTruthy();
      expect(screen.getByText("14 October")).toBeTruthy();
    });

    it("should say Tomorrow for the day after today", () => {
      renderStepper({ date: new Date("2026-10-16T12:00:00Z") });

      expect(screen.getByText("Tomorrow")).toBeTruthy();
    });

    it("should write an older day as a short date and invite a change", () => {
      renderStepper({ date: olderDay });

      expect(screen.getByText("Mon 12 Oct")).toBeTruthy();
      expect(screen.getByText("Tap to change")).toBeTruthy();
    });
  });

  describe("the buttons", () => {
    it("should name the date button by its label and date", () => {
      renderStepper({ date: yesterday });

      expect(
        screen.getByRole("button", { name: "Yesterday, 14 October. Choose a date" }),
      ).toBeTruthy();
    });

    it("should ask for the day before when Previous day is pressed", () => {
      const onChange = vi.fn();
      renderStepper({ onChange });

      fireEvent.click(screen.getByRole("button", { name: "Previous day" }));

      expect(onChange).toHaveBeenCalledWith(new Date("2026-10-14T12:00:00Z"));
    });

    it("should ask for the day after when Next day is pressed", () => {
      const onChange = vi.fn();
      renderStepper({ date: yesterday, onChange });

      fireEvent.click(screen.getByRole("button", { name: "Next day" }));

      expect(onChange).toHaveBeenCalledWith(new Date("2026-10-15T12:00:00Z"));
    });

    it("should disable Next day on today", () => {
      renderStepper();

      expect(screen.getByRole("button", { name: "Next day" })).toHaveProperty("disabled", true);
    });

    it("should disable Next day on a day after today", () => {
      renderStepper({ date: new Date("2026-10-16T12:00:00Z") });

      expect(screen.getByRole("button", { name: "Next day" })).toHaveProperty("disabled", true);
    });

    it("should enable Next day before today", () => {
      renderStepper({ date: yesterday });

      expect(screen.getByRole("button", { name: "Next day" })).toHaveProperty("disabled", false);
    });

    it("should open the date picker from the label and from the calendar button", () => {
      const onPickDate = vi.fn();
      renderStepper({ onPickDate });

      fireEvent.click(screen.getByRole("button", { name: "Today, 15 October. Choose a date" }));
      fireEvent.click(screen.getByRole("button", { name: "Choose a date" }));

      expect(onPickDate).toHaveBeenCalledTimes(2);
    });

    it.each(["Previous day", "Next day", "Choose a date"])(
      "should make %s a 44 px square",
      (name) => {
        renderStepper({ date: yesterday });
        const classes = screen.getByRole("button", { name }).className;

        expect(classes).toContain("h-control-md");
        expect(classes).toContain("w-control-md");
      },
    );

    it("should make the label button at least 44 px tall", () => {
      renderStepper();

      expect(
        screen.getByRole("button", { name: "Today, 15 October. Choose a date" }).className,
      ).toContain("min-h-touch-target");
    });

    it("should show a focus ring on the label button for the keyboard", () => {
      renderStepper();

      expect(
        screen.getByRole("button", { name: "Today, 15 October. Choose a date" }).className,
      ).toContain("focus-visible:ring-2");
    });
  });

  describe("a popover opened from the calendar button", () => {
    it("should hand the calendar button to a screen that opens a popover from it", () => {
      const calendarButtonRef = createRef<HTMLButtonElement>();
      renderStepper({ calendarButtonRef });

      expect(calendarButtonRef.current).toBe(screen.getByRole("button", { name: "Choose a date" }));
    });

    it("should say the popover is open or shut on the calendar button when the screen tells it", () => {
      const { rerender } = renderStepper({ isPickerOpen: false });
      const calendarButton = () => screen.getByRole("button", { name: "Choose a date" });

      expect(calendarButton().getAttribute("aria-haspopup")).toBe("dialog");
      expect(calendarButton().getAttribute("aria-expanded")).toBe("false");

      rerender(<DayStepper date={today} today={today} timeZone="UTC" isPickerOpen />);

      expect(calendarButton().getAttribute("aria-expanded")).toBe("true");
    });

    it("should say nothing of a popover when the screen has none", () => {
      renderStepper();
      const calendarButton = screen.getByRole("button", { name: "Choose a date" });

      expect(calendarButton.getAttribute("aria-haspopup")).toBeNull();
      expect(calendarButton.getAttribute("aria-expanded")).toBeNull();
    });
  });

  describe("the wipe", () => {
    it("should wipe the label in", () => {
      renderStepper();

      expect(screen.getByText("Today").parentElement?.className).toContain("animate-wipe-in");
    });

    it("should not animate under prefers-reduced-motion", async () => {
      renderStepper();
      const css = await compileUtilities(screen.getByText("Today").parentElement?.className ?? "");

      expect(reducedMotionRules(css, "motion-reduce\\:animate-none")).toContain("animation: none");
    });

    it("should mirror the wipe when stepping back and not when stepping forward", () => {
      renderStepper({ date: yesterday });
      const wipe = () => screen.getByText("Yesterday").parentElement;

      fireEvent.click(screen.getByRole("button", { name: "Previous day" }));
      expect(wipe()?.className).toContain("-scale-x-100");

      fireEvent.click(screen.getByRole("button", { name: "Next day" }));
      expect(wipe()?.className).not.toContain("-scale-x-100");
    });
  });
});
