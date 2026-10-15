import { describe, expect, it } from "vitest";

import {
  ADD_FOOD_BUTTON_LABEL,
  COMING_SOON_TITLE,
  MORE_SCREEN,
  PLACEHOLDER_BODIES,
  SEARCH_LAUNCHER,
  TAB_BAR_LABEL,
  TAB_TITLES,
} from "../../src/copy";

describe("the tab shell copy", () => {
  it("should pin the titles of the four destinations in the order the bar draws them", () => {
    expect(Object.values(TAB_TITLES)).toEqual(["Dashboard", "Diary", "Recipes", "More"]);
    expect(TAB_TITLES).toEqual({
      dashboard: "Dashboard",
      diary: "Diary",
      recipes: "Recipes",
      more: "More",
    });
  });

  it("should name the bar, the centre button and the search launcher as the boards do", () => {
    expect(TAB_BAR_LABEL).toBe("Main");
    expect(ADD_FOOD_BUTTON_LABEL).toBe("Find food");
    expect(SEARCH_LAUNCHER).toEqual({ label: "Search for a food", scanLabel: "Scan barcode" });
  });

  it("should pin the placeholder sentences the boards draw", () => {
    expect(COMING_SOON_TITLE).toBe("Coming soon");
    expect(PLACEHOLDER_BODIES).toEqual({
      dashboard: "Your weekly nutrition, weight trend and expenditure will appear here.",
      diary: "Your logged foods will appear here, day by day.",
      recipes: "Your recipes will appear here.",
    });
  });

  it("should pin the More screen's sections and rows as the board draws them", () => {
    expect(MORE_SCREEN).toEqual({
      food: {
        title: "Food",
        yourFoods: { title: "Your foods", subtitle: "Foods you created or copied" },
      },
      nutrition: {
        title: "Nutrition",
        targets: { title: "Targets", subtitle: "Set by you" },
      },
      body: { title: "Body", weight: { title: "Weight", subtitle: "Coming soon" } },
      settings: {
        title: "Settings",
        appearance: {
          title: "Appearance",
          options: { dark: "Dark", light: "Light", system: "Match device" },
        },
        about: { title: "About" },
      },
      account: { title: "Account", signOut: "Sign out" },
    });
  });
});
