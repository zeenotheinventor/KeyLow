import { describe, expect, it } from "vitest";

import {
  PALATE_WORDS,
  describeAvoidSummary,
  describeBandFoods,
  describeEmptyPalate,
  describeFoodDetail,
  describeGroupTitle,
  describeNotTrue,
  describeRareGroupDetail,
  describeRareSummary,
  describeRecipeDetail,
  describeShowAll,
  describeUndo,
  describeUsualMostDays,
  describeUsualMostWeeks,
} from "../../src/copy";

describe("PALATE_WORDS", () => {
  it("should hold the words of the palate screen as the board writes them", () => {
    expect(PALATE_WORDS).toEqual({
      title: "What you usually eat",
      subLine: "Your habits, as the assistant sees them",
      back: "Back to Assistant",
      caption:
        "From what you logged in the last 90 days. The assistant uses this when it suggests recipes and meal plans.",
      usualFoods: "Usual foods",
      usualRecipes: "Usual recipes",
      byTimeOfDay: "By time of day",
      rarelyOrNever: "Rarely or never",
      foodsYouAvoid: "Foods you avoid",
      morning: "Morning",
      midday: "Midday",
      evening: "Evening",
      notTrue: "Not true",
      correctedDetail: "You said this is not usual",
      undo: "Undo",
      allergy: "Allergy",
      dislike: "Dislike",
      foodsToAvoidLink: "Foods to avoid",
      avoidCaption: "Allergies are matched by food name only. Always check labels yourself.",
      noneYet: "None yet",
      noneYetCaption: "The assistant already leaves these out, even before it knows your habits.",
      emptyTitle: "Not enough to go on yet",
      loadFailedTitle: "Couldn't load what you usually eat",
      loadFailedBody: "Check your connection and try again.",
    });
  });

  it("should never speak in the first person", () => {
    expect(JSON.stringify(PALATE_WORDS)).not.toMatch(/\bI\b/);
  });
});

describe("the summary sentences", () => {
  it("should word the foods eaten on most days", () => {
    expect(describeUsualMostDays(["apples", "broccoli", "eggs", "bread"])).toBe(
      "You eat apples, broccoli, eggs and bread on most days.",
    );
  });

  it("should word the foods that come up most weeks, with a capital, and one name in a sentence with no verb to agree", () => {
    expect(describeUsualMostWeeks(["yogurt", "porridge oats", "chicken", "rice"])).toBe(
      "Yogurt, porridge oats, chicken and rice come up most weeks.",
    );
    for (const name of ["apples", "eggs", "porridge oats"]) {
      expect(describeUsualMostWeeks([name])).toBe(`You eat ${name} most weeks.`);
    }
  });

  it("should word the groups rarely or never logged with a comma before the or", () => {
    expect(describeRareSummary(["legumes and nuts", "sweets and snacks", "drinks"])).toBe(
      "You rarely or never log legumes and nuts, sweets and snacks, or drinks.",
    );
    expect(describeRareSummary(["legumes and nuts", "sweets and snacks"])).toBe(
      "You rarely or never log legumes and nuts, or sweets and snacks.",
    );
    expect(describeRareSummary(["drinks"])).toBe("You rarely or never log drinks.");
  });

  it("should word what the person avoids, with allergy after each allergy", () => {
    expect(
      describeAvoidSummary([
        { label: "Peanuts", kind: "allergy" },
        { label: "Mushrooms", kind: "dislike" },
        { label: "coriander", kind: "dislike" },
      ]),
    ).toBe("You avoid peanuts (allergy), mushrooms and coriander.");
  });
});

describe("the rows and details", () => {
  it("should word a food's days and typical amount", () => {
    expect(describeFoodDetail(28, 100)).toBe("28 days · usually 100 g");
    expect(describeFoodDetail(28, 110.4)).toBe("28 days · usually 110 g");
    expect(describeFoodDetail(5, 4.5)).toBe("5 days · usually 4.5 g");
    expect(describeFoodDetail(5, null)).toBe("5 days");
  });

  it("should word a recipe's days and typical servings", () => {
    expect(describeRecipeDetail(14, 1)).toBe("14 days · usually 1 serving");
    expect(describeRecipeDetail(14, 2)).toBe("14 days · usually 2 servings");
    expect(describeRecipeDetail(14, 1.5)).toBe("14 days · usually 1.5 servings");
    expect(describeRecipeDetail(14, null)).toBe("14 days");
  });

  it("should word a time of day as a list of up to three names", () => {
    expect(describeBandFoods(["yogurt", "apples", "porridge oats"])).toBe(
      "Yogurt, apples and porridge oats",
    );
  });

  it("should word a group's title and how rarely it was logged", () => {
    expect(describeGroupTitle("legumes and nuts")).toBe("Legumes and nuts");
    expect(describeRareGroupDetail(0)).toBe("Not logged in the last 90 days");
    expect(describeRareGroupDetail(1)).toBe("Logged once in the last 90 days");
  });

  it("should name the item in the accessible name of Not true", () => {
    expect(describeNotTrue("Eggs, chicken, whole, boiled")).toBe(
      "Not true: Eggs, chicken, whole, boiled",
    );
  });

  it("should name the item an Undo button is on, and how many a Show all opens", () => {
    expect(describeUndo("Eggs, chicken, whole, boiled")).toBe("Undo, Eggs, chicken, whole, boiled");
    expect(describeShowAll(10)).toBe("Show all 10");
  });

  it("should count the days logged when there are too few to go on", () => {
    expect(describeEmptyPalate(2)).toBe(
      "Log your food on 4 days and this page shows what you usually eat. So far you have logged 2 days.",
    );
    expect(describeEmptyPalate(1)).toBe(
      "Log your food on 4 days and this page shows what you usually eat. So far you have logged 1 day.",
    );
    expect(describeEmptyPalate(0)).toContain("So far you have logged 0 days.");
  });
});
