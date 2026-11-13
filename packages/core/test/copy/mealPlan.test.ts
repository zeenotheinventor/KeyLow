import { describe, expect, it } from "vitest";

import { collectStrings } from "./collectStrings";
import {
  DIARY_PLAN_ITEM,
  FIRST_PLAN_VARIETY_WORDS,
  MEAL_PLAN_WORDS,
  PLAN_SETTINGS_WORDS,
  REPEAT_LIMIT_CHOICES,
  describePlanBandFigures,
  describePlanConfirmCaption,
  describePlanConfirmedBody,
  describePlanDayTotals,
  describePlanDaySubtitle,
  describePlanDayTitle,
  describePlanPrefill,
  describePlanRowCaption,
  describePlanRowTitle,
  describePlanShortBody,
  describePlanShortTitle,
  describePlanTolerance,
  describeReplanPrefill,
} from "../../src/copy";

describe("the words of the Plan screens", () => {
  it("should use no em dash, no double hyphen and no semicolon", () => {
    const strings = collectStrings([
      MEAL_PLAN_WORDS,
      DIARY_PLAN_ITEM,
      PLAN_SETTINGS_WORDS,
      FIRST_PLAN_VARIETY_WORDS,
      REPEAT_LIMIT_CHOICES,
    ]);

    expect(strings.filter((text) => /—|--|;/.test(text))).toEqual([]);
  });

  it("should name the screen and the More sheet item as the boards do", () => {
    expect(MEAL_PLAN_WORDS.title).toBe("Meal plan");
    expect(MEAL_PLAN_WORDS.settingsLabel).toBe("Plan settings");
    expect(DIARY_PLAN_ITEM).toEqual({
      label: "Meal plan",
      caption: "Plan your week from your recipes and foods",
    });
  });
});

describe("the repeat limit answers", () => {
  it("should offer once a week to seven times a week and No limit, which the profile stores as 0", () => {
    expect(REPEAT_LIMIT_CHOICES.map(({ value, title }) => [value, title])).toEqual([
      [1, "Once a week"],
      [2, "Twice a week"],
      [3, "3 times a week"],
      [4, "4 times a week"],
      [5, "5 times a week"],
      [6, "6 times a week"],
      [7, "7 times a week"],
      [0, "No limit"],
    ]);
  });

  it("should say Zee's words under No limit", () => {
    expect(REPEAT_LIMIT_CHOICES.at(-1)?.description).toBe(
      "You don't mind eating the same thing again and again.",
    );
  });

  it("should word the first plan banner for the starting limit of two", () => {
    expect(FIRST_PLAN_VARIETY_WORDS.title).toBe("Recipes repeat up to twice a week");
  });
});

describe("the day words", () => {
  it("should title a day as the board does and subtitle it with the plan's run", () => {
    expect(describePlanDayTitle("2026-11-18")).toBe("Wednesday 18");
    expect(describePlanDaySubtitle("2026-11-16", "2026-11-22")).toBe(
      "Meal plan · Mon 16 to Sun 22 Nov",
    );
  });

  it("should write a day's figures against its target", () => {
    expect(
      describePlanDayTotals({ kcal: 1296, protein_g: 86 }, { kcal: 1300, protein_g: 90 }),
    ).toBe("1,296 of 1,300 kcal · P 86 of 90 g");
  });

  it("should write a figure alone when the day has no target for it", () => {
    expect(
      describePlanDayTotals({ kcal: 1296, protein_g: 86 }, { kcal: 1300, protein_g: null }),
    ).toBe("1,296 of 1,300 kcal · P 86 g");
  });

  it("should leave out a figure the plan has no value for", () => {
    expect(
      describePlanDayTotals({ kcal: 1296, protein_g: null }, { kcal: 1300, protein_g: 90 }),
    ).toBe("1,296 of 1,300 kcal");
    expect(describePlanBandFigures({ kcal: 389, protein_g: 13 })).toBe("389 kcal · P 13 g");
  });

  it("should state the tolerance as Zee ruled it: 5 % on calories and 5 g on protein", () => {
    expect(describePlanTolerance({ kcal: 1300, protein_g: 90 })).toBe(
      "Within 5 % of 1,300 kcal and 5 g of 90 g protein.",
    );
    expect(describePlanTolerance({ kcal: 1300, protein_g: null })).toBe(
      "Within 5 % of 1,300 kcal.",
    );
    expect(describePlanTolerance({ kcal: null, protein_g: null })).toBeNull();
  });

  it("should say how many items Confirm day adds", () => {
    expect(describePlanConfirmCaption(8)).toBe(
      "Confirm day adds these 8 items to your diary at their times.",
    );
    expect(describePlanConfirmCaption(1)).toBe(
      "Confirm day adds this item to your diary at its time.",
    );
  });

  it("should say how many entries a confirmed day wrote", () => {
    expect(describePlanConfirmedBody(5)).toBe("5 entries are in your diary. Change them there.");
    expect(describePlanConfirmedBody(1)).toBe("1 entry is in your diary. Change it there.");
  });
});

describe("the diary plan row", () => {
  it("should say today, or the day's date", () => {
    expect(describePlanRowTitle("2026-11-18", true)).toBe("Planned for today");
    expect(describePlanRowTitle("2026-11-19", false)).toBe("Planned for Thu 19 Nov");
  });

  it("should count meals and give the figures", () => {
    expect(describePlanRowCaption({ mealCount: 3, kcal: 1294, protein: 93 })).toBe(
      "3 meals · 1,294 kcal · P 93 g · not confirmed",
    );
    expect(describePlanRowCaption({ mealCount: 1, kcal: null, protein: null })).toBe(
      "1 meal · not confirmed",
    );
  });
});

describe("the short day banner", () => {
  it("should capitalise a title that opens with a word and leave one that opens with a figure", () => {
    expect(describePlanShortTitle([{ nutrient: "protein_g", target: 90, achieved: null }])).toBe(
      "Missing a protein figure",
    );
    expect(describePlanShortTitle([{ nutrient: "kcal", target: 1300, achieved: 1120 }])).toBe(
      "180 kcal under",
    );
  });

  it("should say only that it can be confirmed when no figure is known", () => {
    expect(describePlanShortBody([{ nutrient: "protein_g", target: 90, achieved: null }], [])).toBe(
      "Confirm it as it is, or regenerate the day with other words.",
    );
  });
});

describe("the assistant prefills", () => {
  it("should leave the person to finish a replan, and offer the days to plan", () => {
    expect(describeReplanPrefill("2026-11-18")).toBe("Replan Wed 18 Nov: ");
    expect(describePlanPrefill("2026-11-18", "2026-11-22")).toBe(
      "Plan my meals for Wed 18 to Sun 22 Nov",
    );
  });
});
