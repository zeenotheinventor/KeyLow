import { describe, expect, it } from "vitest";

import {
  FOODS_TO_AVOID,
  YOUR_FOOD,
  describeAvoidedFoodName,
  describeAvoidedKindConflict,
  describeRemoveAvoidedFood,
} from "../../src/copy";

describe("FOODS_TO_AVOID", () => {
  it("should hold the words of the Foods to avoid screen as the board writes them", () => {
    expect(FOODS_TO_AVOID).toEqual({
      title: "Foods to avoid",
      back: "Back to Assistant",
      intro: "The assistant leaves these out of the recipes and meal plans it suggests.",
      fieldLabel: "Food",
      placeholder: "Add a food, such as peanuts",
      kindLabel: "Kind",
      dislike: "Dislike",
      allergy: "Allergy",
      add: "Add",
      listTitle: "Your list",
      disclaimer:
        "Allergies are matched by food name only. Ki-Lo has no allergen data, so a food can contain peanuts without saying so. Always check labels and ingredients yourself.",
      emptyTitle: "Nothing on your list yet",
      emptyBody:
        "Add a food above and the assistant will leave it out of the recipes and meal plans it suggests.",
      duplicate: "That is already on your list.",
      loadFailedTitle: "Couldn't load your list",
      loadFailedBody: "Check your connection and try again.",
      removeFailed: "Not removed. Check your connection and try again.",
    });
  });

  it("should say that an allergy is matched by name only", () => {
    expect(FOODS_TO_AVOID.disclaimer).toContain("matched by food name only");
  });
});

describe("YOUR_FOOD", () => {
  it("should hold the words of the group on the Assistant settings screen as the board writes them", () => {
    expect(YOUR_FOOD).toEqual({
      groupTitle: "Your food",
      groupCaption: "The assistant uses these when it suggests recipes and meal plans.",
      avoidRowSubtitle: "Dislikes and allergies",
    });
  });
});

describe("describeAvoidedFoodName", () => {
  it("should start the name with a capital, as the board writes Peanuts", () => {
    expect(describeAvoidedFoodName("peanuts")).toBe("Peanuts");
  });

  it("should leave the rest of the name as it was typed", () => {
    expect(describeAvoidedFoodName("blue cheese")).toBe("Blue cheese");
  });
});

describe("describeRemoveAvoidedFood", () => {
  it("should name the food in lower case, as the board's Remove peanuts does", () => {
    expect(describeRemoveAvoidedFood("Peanuts")).toBe("Remove peanuts");
  });
});

describe("describeAvoidedKindConflict", () => {
  it("should say a dislike has to be removed before it can be added as an allergy", () => {
    expect(describeAvoidedKindConflict("mushrooms", "dislike")).toBe(
      "Mushrooms is on your list as a dislike. Remove it first to add it as an allergy.",
    );
  });

  it("should say an allergy has to be removed before it can be added as a dislike", () => {
    expect(describeAvoidedKindConflict("peanuts", "allergy")).toBe(
      "Peanuts is on your list as an allergy. Remove it first to add it as a dislike.",
    );
  });
});
