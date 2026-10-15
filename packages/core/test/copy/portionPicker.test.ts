import { describe, expect, it } from "vitest";

import {
  LOG_SEARCH,
  PORTION_PICKER,
  describeAmountBasis,
  describeLastLogged,
  describePer100Heading,
  describePortionCount,
  describePortionWithSize,
  describeScannedCode,
} from "../../src/copy";

describe("portion picker wording", () => {
  it("should pin the drawn words", () => {
    expect(PORTION_PICKER.addAction).toBe("Add");
    expect(PORTION_PICKER.amountLabel).toBe("Amount");
    expect(PORTION_PICKER.unitLabel).toBe("Unit");
    expect(PORTION_PICKER.noAmountBasis).toBe("For this amount");
    expect(PORTION_PICKER.noValue).toBe("\u2013");
  });

  it("should title the search sheet for logging, with an Undo for the plus", () => {
    expect(LOG_SEARCH.title).toBe("Log food");
    expect(LOG_SEARCH.undo).toBe("Undo");
  });

  it("should head the list of the food's own values for its basis", () => {
    expect(describePer100Heading("per_100g")).toBe("Per 100 g");
    expect(describePer100Heading("per_100ml")).toBe("Per 100 ml");
  });

  it("should write the scanned code on the line under the hero", () => {
    expect(describeScannedCode("5201054013410")).toBe("Scanned 5201054013410");
  });
});

describe("describeAmountBasis", () => {
  it("should write grams and millilitres as typed", () => {
    expect(describeAmountBasis({ unit: "g", quantity: 150 })).toBe("For 150 g");
    expect(describeAmountBasis({ unit: "ml", quantity: 250 })).toBe("For 250 ml");
  });

  it("should round a gram amount the way the diary does", () => {
    expect(describeAmountBasis({ unit: "g", quantity: 2.25 })).toBe("For 2.3 g");
  });

  it("should write one portion with its size", () => {
    expect(
      describeAmountBasis({
        unit: "portion",
        quantity: 1,
        portionLabel: "1 medium",
        portionSize: { amount: 100, unit: "g" },
      }),
    ).toBe("For 1 medium (100 g)");
  });

  it("should write several portions with the count and the whole size", () => {
    expect(
      describeAmountBasis({
        unit: "portion",
        quantity: 2,
        portionLabel: "1 bar",
        portionSize: { amount: 45, unit: "g" },
      }),
    ).toBe("For 2 × 1 bar (90 g)");
  });

  it("should write a portion measured in millilitres", () => {
    expect(
      describeAmountBasis({
        unit: "portion",
        quantity: 1,
        portionLabel: "1 glass",
        portionSize: { amount: 200, unit: "ml" },
      }),
    ).toBe("For 1 glass (200 ml)");
  });
});

describe("describePortionCount", () => {
  it("should say portion for one and portions otherwise", () => {
    expect(describePortionCount(1)).toBe("portion");
    expect(describePortionCount(2)).toBe("portions");
    expect(describePortionCount(0.5)).toBe("portions");
  });
});

describe("describePortionWithSize", () => {
  it("should write the size after the portion's name", () => {
    expect(describePortionWithSize("1 medium", { amount: 100, unit: "g" })).toBe(
      "1 medium (100 g)",
    );
    expect(describePortionWithSize("1 glass", { amount: 200, unit: "ml" })).toBe(
      "1 glass (200 ml)",
    );
  });

  it("should not write the size twice when the label already says it", () => {
    expect(describePortionWithSize("30 g", { amount: 30, unit: "g" })).toBe("30 g");
    expect(describePortionWithSize("1 bar (45g)", { amount: 45, unit: "g" })).toBe("1 bar (45g)");
  });

  it("should not take 130 g for a label that says 30 g", () => {
    expect(describePortionWithSize("30 g", { amount: 130, unit: "g" })).toBe("30 g (130 g)");
  });
});

describe("describeLastLogged", () => {
  it("should say today and yesterday in words", () => {
    expect(describeLastLogged("50 g", 0, "Thu 15 Oct")).toBe("Last logged 50 g, today");
    expect(describeLastLogged("50 g", 1, "Wed 14 Oct")).toBe("Last logged 50 g, yesterday");
  });

  it("should write any other day as the date it is given", () => {
    expect(describeLastLogged("50 g", 5, "Sat 10 Oct")).toBe("Last logged 50 g, Sat 10 Oct");
  });
});
