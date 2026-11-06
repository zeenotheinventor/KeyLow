import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { compileUtilities } from "./compileUtilities";

import type { PlateRowProps } from "@/components/ui/PlateRow";

import { PlateRow } from "@/components/ui/PlateRow";

const chickenAndRice: PlateRowProps = {
  name: "Chicken and rice",
  isRecipe: true,
  energy: "374",
  macros: { protein: "32", carbs: "43", fat: "8.1" },
  amountText: "1",
  unitWord: "serving",
  unitsWord: "servings",
  onAmountChange: () => undefined,
  onRemove: () => undefined,
};

const milk: PlateRowProps = {
  name: "Semi-skimmed milk",
  energy: "92",
  macros: { protein: "7", carbs: "9.6", fat: "3.4" },
  amountText: "200",
  unitWord: "ml",
  unitsWord: "ml",
  onAmountChange: () => undefined,
  onRemove: () => undefined,
};

function renderRow(props: PlateRowProps = chickenAndRice) {
  return render(
    <ul>
      <PlateRow {...props} />
    </ul>,
  );
}

const amountField = (name: string) => screen.getByRole("textbox", { name });

afterEach(() => {
  cleanup();
});

describe("PlateRow", () => {
  describe("what it says", () => {
    it("should be a list item", () => {
      renderRow();

      expect(screen.getByRole("listitem")).toBeTruthy();
    });

    it("should write the name and the stats line, with the energy before the macros", () => {
      renderRow(milk);
      const row = screen.getByRole("listitem");

      expect(within(row).getByText("Semi-skimmed milk")).toBeTruthy();
      expect(row.textContent).toContain("92 kcal7 P9.6 C3.4 F");
    });

    it("should say Recipe under a recipe's name", () => {
      renderRow();

      expect(screen.getByText("Recipe")).toBeTruthy();
    });

    it("should say nothing under a food's name but its stats", () => {
      renderRow(milk);

      expect(screen.queryByText("Recipe")).toBeNull();
    });

    it("should read the amount and its unit word in the field", () => {
      renderRow();

      expect((amountField("Amount of Chicken and rice, servings") as HTMLInputElement).value).toBe(
        "1",
      );
      expect(screen.getByText("serving")).toBeTruthy();
    });
  });

  describe("the amount", () => {
    it("should be named Amount of the food, with the plural unit", () => {
      renderRow(milk);

      expect(amountField("Amount of Semi-skimmed milk, ml")).toBeTruthy();
    });

    it("should hand on what is typed", () => {
      const onAmountChange = vi.fn();
      renderRow({ ...milk, onAmountChange });

      fireEvent.change(amountField("Amount of Semi-skimmed milk, ml"), {
        target: { value: "300" },
      });

      expect(onAmountChange).toHaveBeenCalledExactlyOnceWith("300");
    });

    it("should select what is in it when it is focused, so typing replaces it", () => {
      renderRow(milk);
      const field = amountField("Amount of Semi-skimmed milk, ml") as HTMLInputElement;
      const select = vi.spyOn(field, "select");

      fireEvent.focus(field);

      expect(select).toHaveBeenCalledTimes(1);
    });

    it("should take the focus when it asks for it", () => {
      renderRow({ ...milk, autoFocus: true });

      expect(document.activeElement).toBe(amountField("Amount of Semi-skimmed milk, ml"));
    });

    it("should be 112 wide and 36 high", async () => {
      renderRow(milk);
      const field = amountField("Amount of Semi-skimmed milk, ml");
      const width = await compileUtilities(field.closest("div[class*='w-28']")?.className ?? "");
      const frame = await compileUtilities(field.parentElement?.className ?? "");

      expect(width).toContain("width: 7rem");
      expect(frame).toContain("height: 36px");
    });
  });

  describe("the remove button", () => {
    it("should be named for the food and take it off the plate", () => {
      const onRemove = vi.fn();
      renderRow({ ...milk, onRemove });

      fireEvent.click(
        screen.getByRole("button", { name: "Remove Semi-skimmed milk from your plate" }),
      );

      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it("should be a 44 px square", async () => {
      renderRow(milk);
      const css = await compileUtilities(
        screen.getByRole("button", { name: "Remove Semi-skimmed milk from your plate" }).className,
      );

      expect(css).toContain("height: 44px");
      expect(css).toContain("width: 44px");
    });
  });

  describe("opening the food", () => {
    it("should make the name and stats a button that says what a press does", () => {
      const onOpen = vi.fn();
      renderRow({ ...chickenAndRice, onOpen });

      fireEvent.click(
        screen.getByRole("button", {
          name: "Chicken and rice, 1 serving, 374 kilocalories, change amount or unit",
        }),
      );

      expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it("should leave the name as plain text when there is nothing to open", () => {
      renderRow();

      expect(screen.getAllByRole("button")).toHaveLength(1);
    });

    it("should dim the name and ignore a press while opening is off, and leave the rest working", () => {
      const onOpen = vi.fn();
      const onRemove = vi.fn();
      renderRow({ ...chickenAndRice, onOpen, onRemove, isOpenDisabled: true });
      const open = screen.getByRole("button", { name: /change amount or unit$/ });

      fireEvent.click(open);
      fireEvent.click(screen.getByRole("button", { name: /^Remove/ }));

      expect(open.getAttribute("aria-disabled")).toBe("true");
      expect(open.className).toContain("opacity-40");
      expect(onOpen).not.toHaveBeenCalled();
      expect(onRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe("while the plate logs", () => {
    it("should dim the row and stop every control", () => {
      const onOpen = vi.fn();
      const onRemove = vi.fn();
      renderRow({ ...chickenAndRice, onOpen, onRemove, disabled: true });

      fireEvent.click(screen.getByRole("button", { name: /change amount or unit$/ }));
      fireEvent.click(screen.getByRole("button", { name: /^Remove/ }));

      expect(screen.getByRole("listitem").className).toContain("opacity-40");
      expect(onOpen).not.toHaveBeenCalled();
      expect(onRemove).not.toHaveBeenCalled();
      expect(
        (amountField("Amount of Chicken and rice, servings") as HTMLInputElement).disabled,
      ).toBe(true);
    });
  });

  describe("an amount that is not valid", () => {
    it("should flag the field and say why under the row, once", () => {
      renderRow({ ...milk, amountText: "", error: "Enter an amount above 0." });
      const field = amountField("Amount of Semi-skimmed milk, ml");
      const message = screen.getByRole("alert");

      expect(field.getAttribute("aria-invalid")).toBe("true");
      expect(message.textContent).toBe("Enter an amount above 0.");
      expect(field.getAttribute("aria-describedby")).toBe(message.id);
      expect(screen.getAllByText("Enter an amount above 0.")).toHaveLength(1);
    });

    it("should draw the message under the whole row, not inside the narrow field", () => {
      renderRow({ ...milk, amountText: "", error: "Enter an amount above 0." });

      expect(screen.getByRole("listitem").contains(screen.getByRole("alert"))).toBe(true);
      expect(
        amountField("Amount of Semi-skimmed milk, ml")
          .closest("div[class*='w-28']")
          ?.contains(screen.getByRole("alert")),
      ).toBe(false);
    });

    it("should draw nothing for an empty error", () => {
      renderRow({ ...milk, error: "  " });

      expect(screen.queryByRole("alert")).toBeNull();
      expect(amountField("Amount of Semi-skimmed milk, ml").getAttribute("aria-invalid")).toBe(
        "false",
      );
    });
  });
});
