import { weekOf } from "@keylow/core/diary";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "storybook/test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { compileUtilities } from "./compileUtilities";

import type { WeekStripProps } from "@/components/ui/WeekStrip";

import { WeekStrip } from "@/components/ui/WeekStrip";

// The week on the diary canvas: Monday 12 to Sunday 18 October 2026, today Thursday the 15th.
const today = "2026-10-15";
const completeDays = new Set(["2026-10-12", "2026-10-13"]);
const daysOf = (localDate: string, complete: ReadonlySet<string> = completeDays) =>
  weekOf(localDate).map((day) => ({ localDate: day, isComplete: complete.has(day) }));

function renderStrip(props: Partial<WeekStripProps> = {}) {
  const onSelectDay = vi.fn();
  const onWeekChange = vi.fn();
  render(
    <WeekStrip
      days={daysOf(today)}
      selectedDate={today}
      today={today}
      onSelectDay={onSelectDay}
      onWeekChange={onWeekChange}
      {...props}
    />,
  );
  return { onSelectDay, onWeekChange };
}

// The pill is found by its date, today and complete words. Selection is carried by aria-pressed, so
// the name is matched from its start and does not depend on whether core also words the selection.
const dayButton = (namePrefix: string) =>
  screen.getByRole("button", { name: new RegExp(`^${namePrefix}(,|$)`) });
const group = () => screen.getByRole("group");

// A finger down at one point and up at another, as a touch screen reports it.
function swipe(from: [number, number], to: [number, number]) {
  fireEvent.touchStart(group(), { touches: [{ clientX: from[0], clientY: from[1] }] });
  fireEvent.touchEnd(group(), { changedTouches: [{ clientX: to[0], clientY: to[1] }] });
}

describe("WeekStrip", () => {
  afterEach(() => {
    cleanup();
  });

  describe("the group", () => {
    it("should be named This week while it shows the week that holds today", () => {
      renderStrip();

      expect(screen.getByRole("group", { name: "This week" })).toBeTruthy();
    });

    it("should be named for the Monday of an earlier week", () => {
      renderStrip({ days: daysOf("2026-10-12"), today: "2026-10-22", selectedDate: "2026-10-12" });

      expect(screen.getByRole("group", { name: "Week of Mon 12 October" })).toBeTruthy();
    });
  });

  describe("the days", () => {
    it("should show seven days, Monday to Sunday, each named in words by core", () => {
      renderStrip();

      const names = screen
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label"));

      expect(names).toEqual([
        expect.stringMatching(/^Monday 12 October, complete$/),
        expect.stringMatching(/^Tuesday 13 October, complete$/),
        expect.stringMatching(/^Wednesday 14 October$/),
        expect.stringMatching(/^Thursday 15 October, today/),
        expect.stringMatching(/^Friday 16 October$/),
        expect.stringMatching(/^Saturday 17 October$/),
        expect.stringMatching(/^Sunday 18 October$/),
      ]);
    });

    it("should print the date number and the two letter day on each pill", () => {
      renderStrip();

      const pill = dayButton("Thursday 15 October, today");

      expect(pill.textContent).toBe("15Th");
      expect(dayButton("Monday 12 October, complete").textContent).toBe("12Mo");
      expect(dayButton("Sunday 18 October").textContent).toBe("18Su");
    });

    it("should mark only the selected day as pressed", () => {
      renderStrip();

      const pressed = screen
        .getAllByRole("button")
        .filter((button) => button.getAttribute("aria-pressed") === "true");

      expect(pressed).toEqual([dayButton("Thursday 15 October, today")]);
      expect(dayButton("Wednesday 14 October").getAttribute("aria-pressed")).toBe("false");
    });

    it("should write a week that crosses a month end with the 1 after the 31", () => {
      renderStrip({
        days: daysOf("2026-10-28"),
        today: "2026-10-30",
        selectedDate: "2026-10-30",
      });

      expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
        "26Mo",
        "27Tu",
        "28We",
        "29Th",
        "30Fr",
        "31Sa",
        "1Su",
      ]);
      expect(dayButton("Sunday 1 November")).toBeTruthy();
    });

    it("should give no week control of its own", () => {
      renderStrip();

      expect(screen.getAllByRole("button")).toHaveLength(7);
    });
  });

  describe("choosing a day", () => {
    it("should ask for the day that was pressed", () => {
      const { onSelectDay } = renderStrip();

      fireEvent.click(dayButton("Wednesday 14 October"));

      expect(onSelectDay).toHaveBeenCalledWith("2026-10-14");
    });

    it("should do nothing for a day after today", () => {
      const { onSelectDay } = renderStrip();

      fireEvent.click(dayButton("Friday 16 October"));

      expect(onSelectDay).not.toHaveBeenCalled();
    });

    it("should mark a day after today as disabled and leave the others enabled", () => {
      renderStrip();

      expect(dayButton("Friday 16 October").getAttribute("aria-disabled")).toBe("true");
      expect(dayButton("Sunday 18 October").getAttribute("aria-disabled")).toBe("true");
      expect(dayButton("Thursday 15 October, today").getAttribute("aria-disabled")).not.toBe(
        "true",
      );
      expect(dayButton("Wednesday 14 October").getAttribute("aria-disabled")).not.toBe("true");
    });

    it("should make every day a tab stop, in order", async () => {
      renderStrip();

      await userEvent.tab();
      expect(document.activeElement).toBe(dayButton("Monday 12 October, complete"));
      await userEvent.tab();
      expect(document.activeElement).toBe(dayButton("Tuesday 13 October, complete"));
    });

    it("should select the focused day on Enter", async () => {
      const { onSelectDay } = renderStrip();

      dayButton("Wednesday 14 October").focus();
      await userEvent.keyboard("{Enter}");

      expect(onSelectDay).toHaveBeenCalledWith("2026-10-14");
    });

    it("should select the focused day on Space", async () => {
      const { onSelectDay } = renderStrip();

      dayButton("Tuesday 13 October, complete").focus();
      await userEvent.keyboard(" ");

      expect(onSelectDay).toHaveBeenCalledWith("2026-10-13");
    });

    it("should do nothing when Enter is pressed on a day after today", async () => {
      const { onSelectDay } = renderStrip();

      dayButton("Friday 16 October").focus();
      await userEvent.keyboard("{Enter}");

      expect(onSelectDay).not.toHaveBeenCalled();
    });
  });

  describe("the marks under a pill", () => {
    it("should show the accent dot under today", () => {
      renderStrip();

      expect(screen.getAllByTestId("today-dot")).toHaveLength(1);
    });

    it("should show a check under each complete day", () => {
      renderStrip();

      expect(screen.getAllByTestId("complete-check")).toHaveLength(2);
    });

    it("should show a check instead of the dot when today is complete", () => {
      renderStrip({ days: daysOf(today, new Set([today])) });

      expect(screen.queryByTestId("today-dot")).toBeNull();
      expect(screen.getAllByTestId("complete-check")).toHaveLength(1);
      expect(dayButton("Thursday 15 October, today, complete")).toBeTruthy();
    });

    it("should draw the dot 6 px across in the accent colour and the check in the success colour", async () => {
      renderStrip();

      const dotCss = await compileUtilities(screen.getByTestId("today-dot").className);
      const checkCss = await compileUtilities(
        screen.getAllByTestId("complete-check")[0]?.getAttribute("class") ?? "",
      );

      expect(dotCss).toContain("width: 0.375rem");
      expect(dotCss).toContain("--kl-accent");
      expect(dotCss).toContain("border-radius: 9999px");
      expect(checkCss).toContain("stroke: rgb(var(--kl-success)");
    });
  });

  describe("the look of a pill", () => {
    it("should be 56 px high with a 1 px border and the pill radius", async () => {
      renderStrip();

      const css = await compileUtilities(dayButton("Wednesday 14 October").className);

      expect(css).toContain("height: 3.5rem");
      expect(css).toContain("border-width: 1px");
      expect(css).toContain("border-radius: 999px");
    });

    it("should fill the selected day with the raised surface and the strong border", async () => {
      renderStrip();

      const css = await compileUtilities(dayButton("Thursday 15 October, today").className);

      expect(css).toContain("background-color: rgb(var(--kl-surface-raised)");
      expect(css).toContain("border-color: rgb(var(--kl-border-strong)");
    });

    it("should leave another day unfilled with the ordinary border", async () => {
      renderStrip();

      const className = dayButton("Wednesday 14 October").className;
      const css = await compileUtilities(className);

      expect(css).toContain("border-color: rgb(var(--kl-border)");
      expect(css).not.toContain("--kl-surface-raised");
    });

    it("should draw a day after today at half strength", async () => {
      renderStrip();

      const css = await compileUtilities(dayButton("Friday 16 October").className);
      const todayCss = await compileUtilities(dayButton("Wednesday 14 October").className);

      expect(css).toContain("opacity: 0.5");
      expect(todayCss).not.toContain("opacity: 0.5");
    });

    it("should set the date number in small bold tabular type and the day in the caption", () => {
      renderStrip();

      const pill = dayButton("Wednesday 14 October");

      expect(screen.getByText("14").className).toContain("text-body-strong");
      expect(screen.getByText("14").className).toContain("tabular-nums");
      expect(pill.textContent).toBe("14We");
      expect(screen.getByText("We").className).toContain("text-caption");
    });

    it("should show a focus ring for the keyboard", async () => {
      renderStrip();

      const css = await compileUtilities(dayButton("Wednesday 14 October").className);

      expect(css).toContain("focus-visible");
      expect(css).toContain("--tw-ring-color: rgb(var(--kl-focus-ring)");
    });
  });

  describe("the layout", () => {
    const split = (css: string) => {
      const [phone = "", wide = ""] = css.split("@media (min-width: 768px)");
      return { phone, wide };
    };

    it("should put the seven columns 56 px wide on a wide screen and an 8 px apart", async () => {
      renderStrip();

      const { phone, wide } = split(await compileUtilities(group().className));

      expect(wide).toContain("grid-template-columns: repeat(7,56px)");
      expect(phone).toContain("gap: 8px");
    });

    it("should share the width equally between the seven columns on a phone", async () => {
      renderStrip();

      const { phone } = split(await compileUtilities(group().className));

      expect(phone).toContain("grid-template-columns: repeat(7,minmax(0,1fr))");
    });
  });

  describe("changing week", () => {
    it("should ask for the previous week when swiped to the right", () => {
      const { onWeekChange } = renderStrip();

      swipe([100, 300], [220, 304]);

      expect(onWeekChange).toHaveBeenCalledWith("previous");
    });

    it("should ask for the next week when swiped to the left on an earlier week", () => {
      const { onWeekChange } = renderStrip({
        days: daysOf("2026-10-08"),
        selectedDate: "2026-10-08",
      });

      swipe([220, 300], [100, 296]);

      expect(onWeekChange).toHaveBeenCalledWith("next");
    });

    it("should not move to a week that starts after today", () => {
      const { onWeekChange } = renderStrip();

      swipe([220, 300], [100, 296]);

      expect(onWeekChange).not.toHaveBeenCalled();
    });

    it("should ignore a short drag", () => {
      const { onWeekChange } = renderStrip();

      swipe([100, 300], [130, 300]);

      expect(onWeekChange).not.toHaveBeenCalled();
    });

    it("should ignore a drag that is less than twice as far across as it is down", () => {
      const { onWeekChange } = renderStrip();

      swipe([100, 300], [200, 360]);

      expect(onWeekChange).not.toHaveBeenCalled();
    });

    it("should ignore a drag that is mostly downward", () => {
      const { onWeekChange } = renderStrip();

      swipe([100, 300], [170, 420]);

      expect(onWeekChange).not.toHaveBeenCalled();
    });

    it("should ignore a touch that is cancelled", () => {
      const { onWeekChange } = renderStrip();

      fireEvent.touchStart(group(), { touches: [{ clientX: 100, clientY: 300 }] });
      fireEvent.touchCancel(group());
      fireEvent.touchEnd(group(), { changedTouches: [{ clientX: 260, clientY: 300 }] });

      expect(onWeekChange).not.toHaveBeenCalled();
    });

    it("should let a horizontal swipe through to the page instead of scrolling the strip itself", async () => {
      renderStrip();

      const css = await compileUtilities(group().className);

      expect(css).toContain("--tw-pan-y: pan-y");
    });
  });
});
