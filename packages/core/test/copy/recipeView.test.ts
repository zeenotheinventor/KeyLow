import { describe, expect, it } from "vitest";

import { collectStrings } from "./collectStrings";
import {
  RECIPE_VIEW,
  describeEditRecipe,
  describeIngredientsFor,
  describeResetServings,
  describeServingsAnnouncement,
  describeServingsValue,
  describeStepsServingsNote,
} from "../../src/copy";

describe("RECIPE_VIEW", () => {
  it("should pin the strings of brief 25", () => {
    expect(RECIPE_VIEW).toEqual({
      edit: "Edit",
      servingsProblem: "Enter whole servings from 1 to 1,000.",
      fewerServings: "Fewer servings",
      moreServings: "More servings",
      offlineBody: "You can read and scale this recipe. Changes need a connection.",
    });
  });

  it("should end no button, label or message with a full stop except the two sentences", () => {
    expect(RECIPE_VIEW.edit.endsWith(".")).toBe(false);
    expect(RECIPE_VIEW.fewerServings.endsWith(".")).toBe(false);
    expect(RECIPE_VIEW.moreServings.endsWith(".")).toBe(false);
  });

  it("should be non-empty strings with no em dash", () => {
    for (const text of collectStrings(RECIPE_VIEW)) {
      expect(text.trim()).not.toBe("");
      expect(text).not.toContain("—");
    }
  });
});

describe("describeEditRecipe", () => {
  it("should name the recipe", () => {
    expect(describeEditRecipe("Chicken and rice")).toBe("Edit Chicken and rice");
  });
});

describe("the servings wording", () => {
  it.each([
    { servings: 4, value: "4 servings" },
    { servings: 6, value: "6 servings" },
    { servings: 1, value: "1 serving" },
    { servings: 2.5, value: "2.5 servings" },
    { servings: 0.5, value: "0.5 servings" },
    { servings: 1000, value: "1,000 servings" },
  ])("should write $servings as '$value' everywhere", ({ servings, value }) => {
    expect(describeServingsValue(servings)).toBe(value);
    expect(describeIngredientsFor(servings)).toBe(`For ${value}`);
    expect(describeResetServings(servings)).toBe(`Back to ${value}`);
    expect(describeStepsServingsNote(servings)).toBe(`The steps are written for ${value}.`);
  });

  it("should pin the sentences of the copy table", () => {
    expect(describeResetServings(4)).toBe("Back to 4 servings");
    expect(describeResetServings(1)).toBe("Back to 1 serving");
    expect(describeResetServings(2.5)).toBe("Back to 2.5 servings");
    expect(describeIngredientsFor(4)).toBe("For 4 servings");
    expect(describeIngredientsFor(1)).toBe("For 1 serving");
    expect(describeStepsServingsNote(4)).toBe("The steps are written for 4 servings.");
  });
});

describe("describeServingsAnnouncement", () => {
  it("should say the servings and the cooked weight in spoken grams", () => {
    expect(describeServingsAnnouncement(6, 1650)).toBe(
      "Ingredients for 6 servings, 1,650 grams cooked",
    );
  });

  it("should use the singular for one serving and one gram", () => {
    expect(describeServingsAnnouncement(1, 155)).toBe(
      "Ingredients for 1 serving, 155 grams cooked",
    );
    expect(describeServingsAnnouncement(1, 1)).toBe("Ingredients for 1 serving, 1 gram cooked");
    expect(describeServingsAnnouncement(1, 2.5)).toBe("Ingredients for 1 serving, 3 grams cooked");
  });

  it("should round the cooked weight to whole grams, as the yield line does", () => {
    expect(describeServingsAnnouncement(3, 412.5)).toBe(
      "Ingredients for 3 servings, 413 grams cooked",
    );
  });

  it("should leave the grams out when there is no cooked weight", () => {
    expect(describeServingsAnnouncement(6, null)).toBe("Ingredients for 6 servings");
  });
});
