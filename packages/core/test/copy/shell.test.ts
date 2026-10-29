import { describe, expect, it } from "vitest";

import {
  ADD_FOOD_BUTTON_LABEL,
  COMING_SOON_TITLE,
  MORE_SCREEN,
  PLACEHOLDER_BODIES,
  SEARCH_LAUNCHER,
  TAB_BAR_LABEL,
  TAB_TITLES,
  UPDATED_TOAST,
} from "../../src/copy";

describe("the tab shell copy", () => {
  it("should pin the titles of the destinations in the order the bar draws them", () => {
    expect(Object.values(TAB_TITLES)).toEqual(["Dashboard", "Diary", "More"]);
    expect(TAB_TITLES).toEqual({
      dashboard: "Dashboard",
      diary: "Diary",
      more: "More",
    });
  });

  it("should name the bar, the centre button and the search launcher as the boards do", () => {
    expect(TAB_BAR_LABEL).toBe("Main");
    expect(ADD_FOOD_BUTTON_LABEL).toBe("Find food");
    expect(SEARCH_LAUNCHER).toEqual({ label: "Search for a food", scanLabel: "Scan barcode" });
  });

  it("should pin the toast that says the app has been updated", () => {
    expect(UPDATED_TOAST).toBe("Ki-Lo has been updated!");
  });

  it("should pin the placeholder sentences the boards draw", () => {
    expect(COMING_SOON_TITLE).toBe("Coming soon");
    expect(PLACEHOLDER_BODIES).toEqual({
      diary: "Your logged foods will appear here, day by day.",
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
        targets: {
          title: "Targets",
          subtitle: "Set by you",
          subtitleFromProgram: "From your programme",
        },
        program: { title: "Programme", subtitleWithoutProgram: "Let Ki-Lo set your targets" },
        recipes: { title: "Recipes" },
      },
      body: { title: "Body", weight: { title: "Weight" } },
      settings: {
        title: "Settings",
        appearance: {
          title: "Appearance",
          options: { dark: "Dark", light: "Light", system: "Match device" },
        },
        bodyMap: {
          title: "Body map",
          options: { twoD: "2D", threeD: "3D" },
          femaleNote:
            "3D draws the male body for now. Your figure is female, so the body map stays 2D.",
        },
        reminders: { title: "Reminders" },
        about: { title: "About" },
      },
      account: { title: "Account", signOut: "Sign out" },
    });
  });
});
