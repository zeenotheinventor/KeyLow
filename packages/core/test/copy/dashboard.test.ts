import { describe, expect, it } from "vitest";

import {
  DASHBOARD_CARD,
  DASHBOARD_LOADING_NAME,
  DASHBOARD_LOAD_FAILED,
  describeDashboardCard,
  describeTargetCaption,
} from "../../src/copy";

const targets = { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 };

// The board's sample day: seven foods, 1,039 kcal.
const sampleTotals = { kcal: 1039, protein_g: 86, carbs_g: 129.1, fat_g: 19 };

// The same day with the lasagne on top, 2,412 kcal.
const overTotals = { kcal: 2412, protein_g: 150, carbs_g: 257.1, fat_g: 81 };

describe("the dashboard copy", () => {
  it("should pin the words of the card as the board draws them", () => {
    expect(DASHBOARD_CARD).toEqual({
      title: "Today",
      edit: "Edit",
      editName: "Edit targets",
      regionName: "Today's nutrition",
    });
  });

  it("should pin the loading name and the load failure as the boards draw them", () => {
    expect(DASHBOARD_LOADING_NAME).toBe("Loading today's nutrition");
    expect(DASHBOARD_LOAD_FAILED).toEqual({
      title: "Couldn't load today's nutrition",
      body: "Check your connection and try again.",
      action: "Try again",
    });
  });
});

describe("describeTargetCaption", () => {
  it("should write the calorie target with a thousands separator and kcal", () => {
    expect(describeTargetCaption(2200)).toBe("Target 2,200 kcal");
  });
});

describe("describeDashboardCard", () => {
  it("should name the card, then the ring and the three macros, joined with full stops", () => {
    expect(describeDashboardCard(sampleTotals, targets)).toBe(
      "Today, open the diary. 1,161 calories remaining of 2,200. Protein: 86 of 160 grams. Carbs: 129 of 220 grams. Fat: 19 of 70 grams",
    );
  });

  it("should say how far over target the ring and each bar are", () => {
    expect(describeDashboardCard(overTotals, targets)).toBe(
      "Today, open the diary. 212 calories over target of 2,200. Protein: 150 of 160 grams. Carbs: 257 of 220 grams, 37 over. Fat: 81 of 70 grams, 11 over",
    );
  });

  it("should read the whole target as remaining on a day with nothing logged", () => {
    expect(
      describeDashboardCard({ kcal: null, protein_g: null, carbs_g: null, fat_g: null }, targets),
    ).toBe(
      "Today, open the diary. 2,200 calories remaining of 2,200. Protein: 0 of 160 grams. Carbs: 0 of 220 grams. Fat: 0 of 70 grams",
    );
  });

  it("should read the grams and the calories eaten, with no target, when none is set", () => {
    expect(
      describeDashboardCard(sampleTotals, {
        kcal: null,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
      }),
    ).toBe(
      "Today, open the diary. 1,039 calories eaten, no target set. Protein: 86 grams. Carbs: 129 grams. Fat: 19 grams",
    );
  });
});
