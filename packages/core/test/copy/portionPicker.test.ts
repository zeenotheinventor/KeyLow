import { describe, expect, it } from "vitest";

import {
  LOG_SEARCH,
  PORTION_PICKER,
  describeAmountBasis,
  describeLastLogged,
  describePer100Heading,
  describePortionCount,
  describePortionNoun,
  describePortionUnit,
  describePortionWithSize,
  describeScannedCode,
  describeVolumeBasis,
} from "../../src/copy";

describe("portion picker wording", () => {
  it("should pin the drawn words", () => {
    expect(PORTION_PICKER.addAction).toBe("Add");
    expect(PORTION_PICKER.amountLabel).toBe("Amount");
    expect(PORTION_PICKER.unitLabel).toBe("Unit");
    expect(PORTION_PICKER.noAmountBasis).toBe("For this amount");
    expect(PORTION_PICKER.noValue).toBe("\u2013");
  });

  it("should say Undo failed in its own words, and what Recent says when it cannot load", () => {
    expect(LOG_SEARCH.undoFailed).toBe("Couldn't undo. Try again.");
    expect(LOG_SEARCH.recentFailed).toEqual({
      title: "Couldn't load recent foods",
      body: "Check your connection and try again.",
    });
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

describe("describeVolumeBasis", () => {
  it("should write millilitres with the weight they come to", () => {
    expect(describeVolumeBasis({ unit: "ml", quantity: 250, weightInGrams: 257.5 })).toBe(
      "For 250 ml (258 g)",
    );
  });

  it("should write millilitres alone when there is no weight to give", () => {
    expect(describeVolumeBasis({ unit: "ml", quantity: 250, weightInGrams: null })).toBe(
      "For 250 ml",
    );
  });

  it("should write a spoon count with the millilitres it is, then the weight", () => {
    expect(
      describeVolumeBasis({
        unit: "spoon",
        quantity: 2,
        spoonLabel: "1 tbsp",
        volumeMl: 30,
        weightInGrams: 27.6,
      }),
    ).toBe("For 2 tbsp (30 ml, 28 g)");
    expect(
      describeVolumeBasis({
        unit: "spoon",
        quantity: 1,
        spoonLabel: "1 tsp",
        volumeMl: 5,
        weightInGrams: 5,
      }),
    ).toBe("For 1 tsp (5 ml, 5 g)");
  });

  it("should write a spoon count with the millilitres alone when there is no weight", () => {
    expect(
      describeVolumeBasis({
        unit: "spoon",
        quantity: 2,
        spoonLabel: "1 tbsp",
        volumeMl: 30,
        weightInGrams: null,
      }),
    ).toBe("For 2 tbsp (30 ml)");
  });

  it("should round the way the diary does, a tenth below 10 and whole above", () => {
    expect(
      describeVolumeBasis({
        unit: "spoon",
        quantity: 1.5,
        spoonLabel: "1 tsp",
        volumeMl: 7.5,
        weightInGrams: 6.9,
      }),
    ).toBe("For 1.5 tsp (7.5 ml, 6.9 g)");
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

  it("should not take a label that says 130 g for one that says 30 g", () => {
    expect(describePortionWithSize("130 g", { amount: 30, unit: "g" })).toBe("130 g (30 g)");
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

describe("describePortionNoun", () => {
  it.each([
    ["1 medium", "medium"],
    ["1 medium (100 g)", "medium"],
    ["1 slice", "slice"],
    ["1 tbsp", "tbsp"],
    ["1 cup", "cup"],
    ["1 bar (45g)", "bar"],
    ["1 serving", "serving"],
    ["1 pot (170 g)", "pot"],
    ["1 x 400 g tin", "tin"],
    ["1 \u00d7 330 ml can", "can"],
    ["Box of 6", "box of 6"],
    ["1 Pot", "pot"],
    ["Slice", "slice"],
  ])("should take the noun of %j to be %j", (label, noun) => {
    expect(describePortionNoun(label)).toBe(noun);
  });

  it.each([
    "30 g",
    "100g",
    "250 ml",
    "1 oz",
    "",
    "   ",
    "1",
    "1 portion of the whole packet as sold",
  ])("should find no noun in %j", (label) => {
    expect(describePortionNoun(label)).toBeUndefined();
  });
});

describe("describePortionUnit", () => {
  it("should give the spoon noun after the amount field of a spoon", () => {
    expect(describePortionUnit("1 tbsp", 2)).toBe("tbsp");
    expect(describePortionUnit("1 tsp", 1)).toBe("tsp");
  });

  it("should be the noun when the label gives one, whatever the count", () => {
    expect(describePortionUnit("1 medium (100 g)", 1)).toBe("medium");
    expect(describePortionUnit("1 medium (100 g)", 2)).toBe("medium");
  });

  it("should be portion or portions when the label gives no noun", () => {
    expect(describePortionUnit("30 g", 1)).toBe("portion");
    expect(describePortionUnit("30 g", 3)).toBe("portions");
  });

  it("should not read a label that counts more than one as a single item", () => {
    expect(describePortionUnit("6 nuggets", 1)).toBe("portion");
    expect(describePortionUnit("6 nuggets", 2)).toBe("portions");
    expect(describePortionUnit("1/2 pizza", 1)).toBe("portion");
  });
});
