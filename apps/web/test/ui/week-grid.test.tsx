import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { compileUtilities } from "./compileUtilities";

import type { WeekGridDay, WeekGridProps } from "@/components/ui/WeekGrid";

import { WeekGrid } from "@/components/ui/WeekGrid";

// The week of Monday 12 October 2026 on the web diary board, today the Thursday.
const day = (
  localDate: string,
  totals: [number, number, number, number] | null,
  isComplete = false,
): WeekGridDay => ({
  localDate,
  totals:
    totals === null
      ? null
      : { kcal: totals[0], protein_g: totals[1], carbs_g: totals[2], fat_g: totals[3] },
  isComplete,
});

const fullWeek: WeekGridDay[] = [
  day("2026-10-12", [2140, 158, 214, 66], true),
  day("2026-10-13", [2260, 149, 231, 74], true),
  day("2026-10-14", [1286, 111, 129, 35]),
  day("2026-10-15", [1039, 86, 129, 19]),
  day("2026-10-16", null),
  day("2026-10-17", null),
  day("2026-10-18", null),
];

function renderGrid(props: Partial<WeekGridProps> = {}) {
  const onCopyToToday = vi.fn<(localDate: string) => void>();
  render(
    <WeekGrid
      label="Week of Mon 12 Oct"
      days={fullWeek}
      today="2026-10-15"
      calorieTarget={2200}
      dayHref={(localDate) => `/diary?date=${localDate}`}
      onCopyToToday={onCopyToToday}
      {...props}
    />,
  );

  return { onCopyToToday };
}

const cellOf = (name: string) => screen.getByRole("listitem", { name });

afterEach(() => {
  cleanup();
});

describe("WeekGrid", () => {
  describe("the week", () => {
    it("should be one list named for the week, with the seven days and the average", () => {
      renderGrid();

      const list = screen.getByRole("list", { name: "Week of Mon 12 Oct" });

      expect(within(list).getAllByRole("listitem")).toHaveLength(8);
    });

    it("should name each cell for its day, and the last for the average", () => {
      renderGrid();

      for (const name of ["Mon 12", "Tue 13", "Wed 14", "Thu 15", "Fri 16", "Sat 17", "Sun 18"]) {
        expect(cellOf(name)).toBeTruthy();
      }
      expect(cellOf("Average")).toBeTruthy();
    });
  });

  describe("a day's link", () => {
    it("should open the day from its date", () => {
      renderGrid();

      expect(screen.getByRole("link", { name: "Mon 12" }).getAttribute("href")).toBe(
        "/diary?date=2026-10-12",
      );
      expect(screen.getByRole("link", { name: "Thu 15" }).getAttribute("href")).toBe(
        "/diary?date=2026-10-15",
      );
    });

    it("should not link a day that has not come, which opens nothing", () => {
      renderGrid();

      expect(screen.queryByRole("link", { name: "Fri 16" })).toBeNull();
      expect(within(cellOf("Fri 16")).getByText("Fri 16")).toBeTruthy();
    });

    it("should not link the average", () => {
      renderGrid();

      expect(screen.getAllByRole("link")).toHaveLength(4);
    });
  });

  describe("a day's numbers", () => {
    it("should print the calories against the target", () => {
      renderGrid();

      const monday = within(cellOf("Mon 12"));

      expect(monday.getByText("2,140")).toBeTruthy();
      expect(monday.getByText("/ 2,200 kcal")).toBeTruthy();
    });

    it("should print the macros on one line, always P, C, F", () => {
      renderGrid();

      expect(within(cellOf("Mon 12")).getByText("P 158 · C 214 · F 66 g")).toBeTruthy();
      expect(within(cellOf("Thu 15")).getByText("P 86 · C 129 · F 19 g")).toBeTruthy();
    });

    it("should print the calories alone when there is no target", () => {
      renderGrid({ calorieTarget: null });

      const monday = within(cellOf("Mon 12"));

      expect(monday.getByText("2,140")).toBeTruthy();
      expect(monday.getByText("kcal")).toBeTruthy();
      expect(monday.queryByText(/\//)).toBeNull();
    });
  });

  describe("the calories bar", () => {
    it("should be a meter named for the day, filled to the share of the target", () => {
      renderGrid();

      const meter = within(cellOf("Mon 12")).getByRole("meter", { name: "Mon 12 calories" });

      expect(meter.getAttribute("aria-valuenow")).toBe("2140");
      expect(meter.getAttribute("aria-valuemax")).toBe("2200");
      expect(meter.getAttribute("aria-valuetext")).toBe("2,140 of 2,200 kilocalories");
      expect(meter.style.getPropertyValue("--fill")).toBe("97.27272727272728%");
    });

    it("should be in the calories colour", () => {
      renderGrid();

      const meter = within(cellOf("Mon 12")).getByRole("meter", { name: "Mon 12 calories" });

      expect(within(meter).getByRole("presentation").className).toContain("bg-calories");
    });

    it("should draw no bar for a day without entries or without a target", () => {
      renderGrid({ calorieTarget: null });

      expect(screen.queryAllByRole("meter")).toHaveLength(0);
    });

    describe("over the target", () => {
      it("should be full and say so", () => {
        renderGrid();

        const meter = within(cellOf("Tue 13")).getByRole("meter", { name: "Tue 13 calories" });

        expect(meter.getAttribute("aria-valuenow")).toBe("2200");
        expect(meter.getAttribute("aria-valuetext")).toBe(
          "2,260 of 2,200 kilocalories, over target",
        );
        expect(meter.style.getPropertyValue("--fill")).toBe("100%");
      });

      it("should take a brighter outline of its own colour, a 1 px gap and then a 1.5 px ring", async () => {
        renderGrid();

        const meter = within(cellOf("Tue 13")).getByRole("meter", { name: "Tue 13 calories" });
        const css = await compileUtilities(meter.className);

        expect(css).toContain(
          "box-shadow: 0 0 0 1px rgb(var(--kl-background)),0 0 0 2.5px color-mix(in srgb,rgb(var(--kl-calories)) 55%,white)",
        );
      });

      it("should never use the warning or the danger colour", () => {
        renderGrid();

        const meter = within(cellOf("Tue 13")).getByRole("meter", { name: "Tue 13 calories" });
        const classes = [meter, ...within(meter).getAllByRole("presentation")]
          .map((element) => element.className)
          .join(" ");

        expect(classes).not.toMatch(/warning|danger/);
      });

      it("should draw no outline for a day under the target", () => {
        renderGrid();

        const meter = within(cellOf("Mon 12")).getByRole("meter", { name: "Mon 12 calories" });

        expect(meter.className).not.toContain("box-shadow");
      });
    });
  });

  describe("a day's state", () => {
    it("should say Complete for a complete day and Incomplete for the others", () => {
      renderGrid();

      expect(within(cellOf("Mon 12")).getByText("Complete")).toBeTruthy();
      expect(within(cellOf("Tue 13")).getByText("Complete")).toBeTruthy();
      expect(within(cellOf("Wed 14")).getByText("Incomplete")).toBeTruthy();
      expect(within(cellOf("Thu 15")).getByText("Incomplete")).toBeTruthy();
    });

    it("should draw Incomplete in the warning ink and Complete in the primary text", () => {
      renderGrid();

      expect(within(cellOf("Wed 14")).getByText("Incomplete").className).toContain(
        "text-warning-ink",
      );
      expect(within(cellOf("Mon 12")).getByText("Complete").className).toContain(
        "text-text-primary",
      );
    });

    it("should say nothing of a state for a day that has not come, or for the average", () => {
      renderGrid();

      expect(within(cellOf("Fri 16")).queryByText(/complete/i)).toBeNull();
      expect(within(cellOf("Average")).queryByText(/complete/i)).toBeNull();
    });
  });

  describe("a day without entries", () => {
    it("should say No entries yet and print no numbers", () => {
      renderGrid();

      const friday = within(cellOf("Fri 16"));

      expect(friday.getByText("No entries yet")).toBeTruthy();
      expect(friday.queryByText(/kcal/)).toBeNull();
      expect(friday.queryByRole("meter")).toBeNull();
    });

    it("should say No entries yet in the secondary text in the list and the muted text in the cards, as the board draws it", async () => {
      renderGrid();

      const css = await compileUtilities(
        within(cellOf("Fri 16")).getByText("No entries yet").className,
      );
      const [listRules, cardRules] = css.split("@media (min-width: 1280px)");

      expect(listRules).toMatch(/\.text-text-secondary\s*\{[^}]*--kl-text-secondary/);
      expect(listRules).not.toContain("--kl-text-muted");
      expect(cardRules).toMatch(/xl\\:text-text-muted\s*\{[^}]*--kl-text-muted/);
    });

    it("should dim a day that has not come to half strength", () => {
      renderGrid();

      expect(cellOf("Fri 16").className).toContain("opacity-50");
      expect(cellOf("Thu 15").className).not.toContain("opacity-50");
    });

    it("should say No entries yet for a day up to today that has none, without dimming it", () => {
      renderGrid({
        days: fullWeek.map((entry) =>
          entry.localDate === "2026-10-14" ? day(entry.localDate, null) : entry,
        ),
      });

      expect(within(cellOf("Wed 14")).getByText("No entries yet")).toBeTruthy();
      expect(cellOf("Wed 14").className).not.toContain("opacity-50");
    });
  });

  describe("Copy to today", () => {
    it("should be on each past day with entries, named for the day", () => {
      renderGrid();

      expect(
        screen.getAllByRole("button").map((button) => button.getAttribute("aria-label")),
      ).toEqual(["Copy to today, Mon 12", "Copy to today, Tue 13", "Copy to today, Wed 14"]);
    });

    it("should show the words Copy to today", () => {
      renderGrid();

      expect(within(cellOf("Mon 12")).getByRole("button").textContent).toBe("Copy to today");
    });

    it("should not be on today, a day to come, or the average", () => {
      renderGrid();

      expect(within(cellOf("Thu 15")).queryByRole("button")).toBeNull();
      expect(within(cellOf("Fri 16")).queryByRole("button")).toBeNull();
      expect(within(cellOf("Average")).queryByRole("button")).toBeNull();
    });

    it("should not be on a past day without entries", () => {
      renderGrid({
        days: fullWeek.map((entry) =>
          entry.localDate === "2026-10-14" ? day(entry.localDate, null) : entry,
        ),
      });

      expect(within(cellOf("Wed 14")).queryByRole("button")).toBeNull();
    });

    it("should ask to copy the day that was pressed", () => {
      const { onCopyToToday } = renderGrid();

      fireEvent.click(screen.getByRole("button", { name: "Copy to today, Tue 13" }));

      expect(onCopyToToday).toHaveBeenCalledExactlyOnceWith("2026-10-13");
    });

    it("should be disabled while a copy is on its way, so a double press copies once", () => {
      renderGrid({ isCopying: true });

      for (const button of screen.getAllByRole("button")) {
        expect(button).toHaveProperty("disabled", true);
      }
    });
  });

  describe("today", () => {
    it("should be framed with the strong border and lifted onto the raised surface", () => {
      renderGrid();

      expect(cellOf("Thu 15").className).toContain("xl:border-border-strong");
      expect(cellOf("Thu 15").className).toContain("bg-surface-raised");
      expect(cellOf("Wed 14").className).not.toContain("border-strong");
    });
  });

  describe("the average", () => {
    it("should cover Monday to today, leaving out the days to come", () => {
      renderGrid();

      const average = within(cellOf("Average"));

      expect(average.getByText("1,681")).toBeTruthy();
      expect(average.getByText("P 126 · C 176 · F 49 g")).toBeTruthy();
    });

    it("should say Mon to today", () => {
      renderGrid();

      expect(within(cellOf("Average")).getByText("Mon to today")).toBeTruthy();
    });

    it("should have a bar, over the same target", () => {
      renderGrid();

      expect(
        within(cellOf("Average")).getByRole("meter", { name: "Average calories" }),
      ).toBeTruthy();
    });

    it("should say No entries yet when no day up to today has entries", () => {
      renderGrid({ days: fullWeek.map((entry) => day(entry.localDate, null)) });

      expect(within(cellOf("Average")).getByText("No entries yet")).toBeTruthy();
    });
  });

  describe("the layout", () => {
    it("should be eight columns from the xl breakpoint and one card of rows below it", async () => {
      renderGrid();

      const list = screen.getByRole("list", { name: "Week of Mon 12 Oct" });
      const css = await compileUtilities(`${list.className} ${cellOf("Mon 12").className}`);

      expect(css).toMatch(
        /@media \(min-width: 1280px\)[^]*grid-template-columns: repeat\(8,minmax\(0,1fr\)\)/,
      );
      expect(list.className).toContain("overflow-hidden");
    });

    it("should be a row 56 px of content high with its padding around it, as the design draws it", async () => {
      renderGrid();

      const css = await compileUtilities(cellOf("Mon 12").className);

      expect(css).toContain("box-sizing: content-box");
      expect(css).toContain("min-height: 56px");
    });

    it("should be a 44 px target for the date link and Copy to today", () => {
      renderGrid();

      expect(screen.getByRole("link", { name: "Mon 12" }).className).toContain(
        "min-h-touch-target",
      );
      expect(screen.getByRole("button", { name: "Copy to today, Mon 12" }).className).toContain(
        "min-h-touch-target",
      );
    });
  });
});
