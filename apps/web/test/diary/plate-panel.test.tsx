import { setPlateQuantity } from "@keylow/core/plate";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PlatePanelProps } from "@/components/diary/AddFoodDialog/PlatePanel";

import { PlatePanel } from "@/components/diary/AddFoodDialog/PlatePanel";
import {
  dayBarsFor,
  goldenPlate,
  overPlate,
} from "@/components/diary/AddFoodDialog/PlatePanel/goldenPlate";

const noop = () => undefined;

function panelProps(overrides: Partial<PlatePanelProps> = {}): PlatePanelProps {
  return {
    items: goldenPlate,
    dayBars: dayBarsFor(goldenPlate),
    time: "19:20",
    isNow: true,
    onTimeChange: noop,
    onAmountChange: noop,
    onRemove: noop,
    onClear: noop,
    ...overrides,
  };
}

function renderPanel(overrides: Partial<PlatePanelProps> = {}) {
  return render(<PlatePanel {...panelProps(overrides)} />);
}

const rows = () => within(screen.getByRole("list", { name: "Foods on your plate" }));
const totals = () => within(screen.getByRole("region", { name: "Totals" }));
const amountField = (name: string) => {
  const field = screen.getByRole("textbox", { name });
  if (!(field instanceof HTMLInputElement)) throw new Error(`${name} is not an input`);
  return field;
};

afterEach(() => {
  cleanup();
});

describe("PlatePanel", () => {
  describe("the heading", () => {
    it("should say Your plate with the count of foods", () => {
      renderPanel();

      expect(screen.getByRole("heading", { level: 3, name: "Your plate" })).toBeTruthy();
      expect(screen.getByText("4 foods")).toBeTruthy();
    });

    it("should say 1 food for one", () => {
      renderPanel({ items: goldenPlate.slice(0, 1), dayBars: undefined });

      expect(screen.getByText("1 food")).toBeTruthy();
    });

    it("should draw what it is given before the heading, such as the Results link", () => {
      renderPanel({ resultsLink: <button type="button">Results</button> });
      const link = screen.getByRole("button", { name: "Results" });
      const heading = screen.getByRole("heading", { name: "Your plate" });

      expect(link.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("should clear the plate with Clear plate", () => {
      const onClear = vi.fn();
      renderPanel({ onClear });

      fireEvent.click(screen.getByRole("button", { name: "Clear plate" }));

      expect(onClear).toHaveBeenCalledTimes(1);
    });
  });

  describe("the rows", () => {
    it("should list the four foods in the order they were added, under the name Foods on your plate", () => {
      renderPanel();

      expect(rows().getAllByRole("listitem")).toHaveLength(4);
      expect(
        rows()
          .getAllByRole("listitem")
          .map((row) => row.textContent.slice(0, 12)),
      ).toEqual(["Chicken and ", "Greek yoghur", "Banana95 kca", "Semi-skimmed"]);
    });

    it("should write each row's amount and its unit word", () => {
      renderPanel();

      expect(amountField("Amount of Chicken and rice, servings").value).toBe("1");
      expect(amountField("Amount of Semi-skimmed milk, ml").value).toBe("200");
      expect(rows().getByText("medium")).toBeTruthy();
    });

    it("should say Recipe under the recipe and nothing under the foods", () => {
      renderPanel();

      expect(rows().getAllByText("Recipe")).toHaveLength(1);
    });

    it("should hand on a typed amount with the row's key", () => {
      const onAmountChange = vi.fn();
      renderPanel({ onAmountChange });

      fireEvent.change(amountField("Amount of Semi-skimmed milk, ml"), {
        target: { value: "300" },
      });

      expect(onAmountChange).toHaveBeenCalledExactlyOnceWith("milk", "300");
    });

    it("should hand on a removal with the row's key", () => {
      const onRemove = vi.fn();
      renderPanel({ onRemove });

      fireEvent.click(screen.getByRole("button", { name: "Remove Banana from your plate" }));

      expect(onRemove).toHaveBeenCalledExactlyOnceWith("banana");
    });

    it("should open a row on a press on its name, when it can be opened", () => {
      const onOpenRow = vi.fn();
      renderPanel({ onOpenRow });

      fireEvent.click(screen.getByRole("button", { name: /^Banana, 1 medium, 95 kilocalories/ }));

      expect(onOpenRow).toHaveBeenCalledExactlyOnceWith(goldenPlate[2]);
    });

    it("should leave the names as plain text when it cannot open a row", () => {
      renderPanel();

      expect(screen.queryByRole("button", { name: /change amount or unit/ })).toBeNull();
    });

    it("should dim the names and ignore a press while opening is off", () => {
      const onOpenRow = vi.fn();
      renderPanel({ onOpenRow, isOpenDisabled: true });
      const open = screen.getByRole("button", { name: /^Banana, 1 medium/ });

      fireEvent.click(open);

      expect(open.getAttribute("aria-disabled")).toBe("true");
      expect(onOpenRow).not.toHaveBeenCalled();
    });

    it("should say why an amount is not valid under its row, and count the row as nothing", () => {
      renderPanel({ items: setPlateQuantity(goldenPlate, "milk", ""), dayBars: undefined });

      expect(screen.getByRole("alert").textContent).toBe("Enter an amount above 0.");
      expect(totals().getByText("566")).toBeTruthy();
    });
  });

  describe("the totals", () => {
    it("should be a region named Totals with what the plate comes to", () => {
      renderPanel();

      expect(totals().getByText("On your plate")).toBeTruthy();
      expect(totals().getByText("658")).toBeTruthy();
      expect(totals().getByText("Protein 57 g")).toBeTruthy();
      expect(totals().getByText("Carbs 79 g")).toBeTruthy();
      expect(totals().getByText("Fat 12 g")).toBeTruthy();
    });

    it("should show the day's four bars with the plate's share under a heading, as a card", () => {
      renderPanel();
      const strip = totals().getByRole("group", { name: /^Today with your plate\. Calories: / });

      expect(totals().getByText("Today with your plate")).toBeTruthy();
      expect(strip.getAttribute("aria-label")).toContain(
        "Calories: 1,697 of 2,200 kilocalories, 658 on your plate",
      );
      expect(within(strip).getByText("1,697")).toBeTruthy();
    });

    it("should leave out the bars and their heading until the day is read", () => {
      renderPanel({ dayBars: undefined });

      expect(totals().queryByRole("group")).toBeNull();
      expect(totals().queryByText("Today with your plate")).toBeNull();
      expect(totals().getByText("658")).toBeTruthy();
    });

    it("should read 2,257 kcal for the over plate, with calories and carbs outlined", () => {
      renderPanel({ items: overPlate, dayBars: dayBarsFor(overPlate) });
      const strip = totals().getByRole("group", { name: /^Today with your plate/ });

      expect(within(strip).getByText("2,257")).toBeTruthy();
      expect(within(strip).getByText("295")).toBeTruthy();
      expect(within(strip).getByText("157")).toBeTruthy();
      expect(within(strip).getByText("46")).toBeTruthy();
      expect(strip.getAttribute("aria-label")).toContain("Calories: 2,257 of 2,200 kilocalories");
      expect(strip.getAttribute("aria-label")).toContain("over target");
    });
  });

  describe("the time", () => {
    it("should be a row below the scrolling part that says Now and the time", () => {
      renderPanel();
      const time = screen.getByRole("button", { name: "Time, now, 19:20, change" });
      const scroller = screen.getByRole("list", { name: "Foods on your plate" }).parentElement;

      expect(scroller?.className).toContain("overflow-y-auto");
      expect(scroller?.contains(screen.getByRole("region", { name: "Totals" }))).toBe(true);
      expect(scroller?.contains(time)).toBe(false);
      expect(time.textContent).toBe("TimeNow · 19:20");
    });

    it("should hand on the time that is chosen", () => {
      const onTimeChange = vi.fn();
      renderPanel({ onTimeChange });

      fireEvent.click(screen.getByRole("button", { name: "Time, now, 19:20, change" }));
      fireEvent.click(
        within(screen.getByRole("listbox", { name: "Hours" })).getByRole("option", { name: "18" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Done" }));

      expect(onTimeChange).toHaveBeenCalledExactlyOnceWith("18:20");
    });
  });

  describe("while the plate is logged", () => {
    it("should dim and stop Clear plate, every row and the time, and keep the totals readable", () => {
      const onClear = vi.fn();
      renderPanel({ isLogging: true, onClear, onOpenRow: noop });
      const clear = screen.getByRole("button", { name: "Clear plate" });

      fireEvent.click(clear);

      expect(onClear).not.toHaveBeenCalled();
      expect(clear.className).toContain("opacity-40");
      for (const row of rows().getAllByRole("listitem")) {
        expect(row.className).toContain("opacity-40");
      }
      expect(
        screen.getByRole("button", { name: "Time, now, 19:20, change" }).hasAttribute("disabled"),
      ).toBe(true);
      expect(screen.getByRole("region", { name: "Totals" }).className).not.toContain("opacity-40");
    });
  });
});
