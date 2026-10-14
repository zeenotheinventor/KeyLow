import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithRouter } from "./appRouter";
import { compileUtilities, reducedMotionRules } from "./compileUtilities";

import type { FoodRowContent } from "@/components/ui/FoodRow";

import { FoodRow } from "@/components/ui/FoodRow";

const chickenBreast = [
  { text: "Chicken", matched: true },
  { text: " ", matched: false },
  { text: "breast", matched: true },
  { text: ", meal prep", matched: false },
];

const macros = {
  protein: "31",
  carbs: "0",
  fat: "3.6",
  description: "protein 31 grams, fat 3.6 grams, carbohydrate 0 grams",
};

type RowDetails = Partial<FoodRowContent>;

function renderRow(details: RowDetails = {}) {
  return render(
    <ul>
      <FoodRow nameSegments={chickenBreast} href="/foods/chicken" {...details} />
    </ul>,
  );
}

function renderButtonRow(details: RowDetails = {}, onClick: () => void = () => undefined) {
  return render(
    <ul>
      <FoodRow nameSegments={chickenBreast} onClick={onClick} {...details} />
    </ul>,
  );
}

// The name is cut into segments, and the test library's name computation drops the space that sits
// alone in a segment, so the space between the words is optional here. Browsers keep it.
const chickenBreastName = "Chicken\\s*breast, meal prep";

describe("FoodRow", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be a list item holding a link named by the food", () => {
    renderRow();

    const link = screen.getByRole("link", { name: new RegExp(chickenBreastName) });

    expect(link.getAttribute("href")).toBe("/foods/chicken");
    expect(screen.getByRole("listitem")).toBeTruthy();
  });

  it("should open the page through the router, so the app is not loaded again", () => {
    const { push } = renderWithRouter(
      <ul>
        <FoodRow nameSegments={chickenBreast} href="/foods/chicken" />
      </ul>,
    );

    const notCancelled = fireEvent.click(
      screen.getByRole("link", { name: new RegExp(chickenBreastName) }),
    );

    expect(notCancelled).toBe(false);
    expect(push).toHaveBeenCalledExactlyOnceWith("/foods/chicken", expect.anything());
  });

  it("should write the matched parts of the name in bold", () => {
    renderRow();

    const bold = screen.getByText("Chicken");
    const plain = screen.getByText(", meal prep");

    expect(bold.className).toContain("font-semibold");
    expect(plain.className).toContain("font-normal");
  });

  it("should show the brand after the name", () => {
    renderRow({ brand: "Northfield Mills" });

    expect(
      screen.getByRole("link", { name: new RegExp(`${chickenBreastName} · Northfield Mills`) }),
    ).toBeTruthy();
  });

  it("should show the energy with its unit", () => {
    renderRow({ energy: "165" });

    expect(screen.getByRole("link", { name: /165\s*kcal/ })).toBeTruthy();
  });

  describe("macros", () => {
    it("should show each macro beside its letter", () => {
      renderRow({ macros });

      expect(screen.getByText("31").parentElement?.textContent).toBe("31 P");
      expect(screen.getByText("0").parentElement?.textContent).toBe("0 C");
      expect(screen.getByText("3.6").parentElement?.textContent).toBe("3.6 F");
    });

    it("should spell the macros out for a screen reader and hide the letters", () => {
      renderRow({ macros });

      expect(screen.getByText(macros.description)).toBeTruthy();
      expect(screen.getByText("31").closest("[aria-hidden=true]")).toBeTruthy();
    });

    it("should note the basis when it is not per 100 g", () => {
      renderRow({ macros, basis: "per 100 ml" });

      expect(screen.getByText("per 100 ml")).toBeTruthy();
    });

    it("should show a note instead of the macros when it has one", () => {
      renderRow({ note: "Energy not given" });

      expect(screen.getByText("Energy not given")).toBeTruthy();
    });
  });

  describe("as a button", () => {
    it("should report a click", () => {
      const onClick = vi.fn();
      renderButtonRow({}, onClick);

      fireEvent.click(screen.getByRole("button", { name: new RegExp("Chicken\\s*breast") }));

      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("busy", () => {
    it("should say what is happening and mark itself busy", () => {
      renderButtonRow({ busyLabel: "Adding to your foods" });

      const button = screen.getByRole("button", { name: /Adding to your foods/ });

      expect(button.getAttribute("aria-busy")).toBe("true");
      expect(button.getAttribute("aria-disabled")).toBe("true");
    });

    it("should ignore clicks while busy", () => {
      const onClick = vi.fn();
      renderButtonRow({ busyLabel: "Adding to your foods" }, onClick);

      fireEvent.click(screen.getByRole("button"));

      expect(onClick).not.toHaveBeenCalled();
    });

    it("should stay at full strength", () => {
      renderButtonRow({ busyLabel: "Adding to your foods" });

      expect(screen.getByRole("button").className).not.toContain("opacity-50");
    });

    it("should swap the spinner for a pulse under prefers-reduced-motion", async () => {
      renderButtonRow({ busyLabel: "Adding to your foods" });
      const spinner = screen.getByRole("button").querySelector("svg.animate-spin");
      const css = await compileUtilities(spinner?.getAttribute("class") ?? "");

      expect(reducedMotionRules(css, "motion-reduce\\:animate-pulse")).toContain("animation");
    });
  });

  describe("disabled", () => {
    it("should be unavailable and dimmed", () => {
      renderButtonRow({ disabled: true });

      const button = screen.getByRole("button");

      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.className).toContain("opacity-50");
    });

    it("should ignore clicks", () => {
      const onClick = vi.fn();
      renderButtonRow({ disabled: true }, onClick);

      fireEvent.click(screen.getByRole("button"));

      expect(onClick).not.toHaveBeenCalled();
    });

    it("should not be reachable as a link", () => {
      renderRow({ disabled: true });

      expect(screen.getByRole("link").getAttribute("href")).toBeNull();
    });
  });

  describe("reduced motion", () => {
    it("should drop the press scale under prefers-reduced-motion", async () => {
      renderRow();
      const css = await compileUtilities(screen.getByRole("link").className);

      expect(reducedMotionRules(css, "motion-reduce\\:active\\:scale-100")).toContain("transform");
    });
  });
});
