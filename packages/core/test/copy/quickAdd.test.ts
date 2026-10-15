import { describe, expect, it } from "vitest";

import { QUICK_ADD_FORM, describeQuickAddMacroField } from "../../src/copy";

describe("quick add wording", () => {
  it("should pin the drawn words of the form", () => {
    expect(QUICK_ADD_FORM).toEqual({
      title: "Quick add",
      editTitle: "Edit quick add",
      close: "Close",
      caloriesLabel: "Calories",
      labelLabel: "Label (optional)",
      labelPlaceholder: "For example, meal deal crisps",
    });
  });

  it("should name a macro field with its unit, as the board's field is named", () => {
    expect(describeQuickAddMacroField("Protein")).toBe("Protein in grams");
    expect(describeQuickAddMacroField("Carbohydrate")).toBe("Carbohydrate in grams");
  });
});
