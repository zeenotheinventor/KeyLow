import { describe, expect, it } from "vitest";

import {
  FOOD_FORM,
  FOOD_FORM_BARCODE_NOT_VALID,
  FOOD_FORM_BARCODE_PROBLEMS,
  FOOD_FORM_BUTTONS,
  FOOD_REVIEW_BANNER,
  describeAmountUnitNote,
  describeNameProblem,
  describeNutrientProblem,
  describePortionAmountField,
  describePortionField,
  describePortionAmountProblem,
  describePortionGroup,
  describePortionLabelAndAmountProblem,
  describePortionLabelField,
  describePortionLabelProblem,
  describeRemovePortion,
} from "../../src/copy";

describe("food form buttons and review banner", () => {
  it("should pin the button labels", () => {
    expect(FOOD_FORM_BUTTONS).toEqual({
      create: "Create food",
      copy: "Save to your foods",
      edit: "Save changes",
      save: "Save",
    });
  });

  it("should pin the review banner wording", () => {
    expect(FOOD_REVIEW_BANNER).toEqual({ title: "Needs review", action: "Copy to your foods" });
  });
});

describe("describeNameProblem", () => {
  it("should pin the drawn sentence", () => {
    expect(describeNameProblem("required")).toBe("Name is required");
  });

  it("should pin the length sentence", () => {
    expect(describeNameProblem("too_long")).toBe("Name must be 200 characters or fewer");
  });
});

describe("describeNutrientProblem", () => {
  it("should pin the drawn sentences", () => {
    expect(describeNutrientProblem("kcal", "required")).toBe("Energy is required");
    expect(describeNutrientProblem("fat_g", "negative")).toBe("Fat cannot be negative");
    expect(describeNutrientProblem("protein_g", "required")).toBe("Protein is required");
  });

  it.each([
    ["kcal", "Energy"],
    ["protein_g", "Protein"],
    ["fat_g", "Fat"],
    ["carbs_g", "Carbohydrate"],
    ["fibre_g", "Fibre"],
  ] as const)("should name %s as %s in all three sentences", (nutrient, subject) => {
    expect(describeNutrientProblem(nutrient, "required")).toBe(`${subject} is required`);
    expect(describeNutrientProblem(nutrient, "negative")).toBe(`${subject} cannot be negative`);
    expect(describeNutrientProblem(nutrient, "not_a_number")).toBe(`${subject} must be a number`);
  });
});

describe("portion problems", () => {
  it("should pin the drawn mobile sentences, one for each field", () => {
    expect(describePortionLabelProblem(1)).toBe("Portion 1 needs a label");
    expect(describePortionAmountProblem(1)).toBe("Portion 1 needs an amount above 0");
  });

  it("should number the portion", () => {
    expect(describePortionLabelProblem(3)).toBe("Portion 3 needs a label");
    expect(describePortionAmountProblem(3)).toBe("Portion 3 needs an amount above 0");
  });

  it("should pin the drawn web sentence for a portion missing both", () => {
    expect(describePortionLabelAndAmountProblem(1)).toBe(
      "Portion 1 needs a label and an amount above 0",
    );
  });
});

describe("barcode problems on the food form", () => {
  it("should keep the sentences the mobile form shows today", () => {
    expect(FOOD_FORM_BARCODE_PROBLEMS).toEqual({
      not_digits: "Barcode can only contain digits",
      bad_length: "Barcode must have 8, 12, 13 or 14 digits",
      bad_check_digit: "Barcode check digit is wrong",
      not_upc_e: "Barcode is not a valid product code",
    });
    expect(FOOD_FORM_BARCODE_NOT_VALID).toBe("Barcode is not valid");
  });
});

describe("the web food form copy", () => {
  it("should pin the headings, the back and cancel links and the copy introduction", () => {
    expect(FOOD_FORM.back).toBe("Back");
    expect(FOOD_FORM.readOnly).toBe("Read only");
    expect(FOOD_FORM.cancel).toBe("Cancel");
    expect(FOOD_FORM.titles).toEqual({
      create: "New food",
      copy: "Copy to your foods",
      edit: "Edit food",
    });
    expect(FOOD_FORM.copyIntro).toBe(
      "Check each value and fill in the ones that are blank. Saving adds a food of your own and leaves the original as it is.",
    );
  });

  it("should pin the section headings and field labels the boards draw", () => {
    expect(FOOD_FORM.details).toBe("Details");
    expect(FOOD_FORM.portions).toBe("Portions");
    expect(FOOD_FORM.required).toBe("Required");
    expect(FOOD_FORM.name).toBe("Name");
    expect(FOOD_FORM.namePlaceholder).toBe("e.g. Greek yoghurt");
    expect(FOOD_FORM.optionalPlaceholder).toBe("Optional");
    expect(FOOD_FORM.brand).toBe("Brand");
    expect(FOOD_FORM.barcode).toBe("Barcode");
    expect(FOOD_FORM.nutrients).toEqual({
      kcal: "Energy",
      protein_g: "Protein",
      carbs_g: "Carbohydrate",
      fat_g: "Fat",
      fibre_g: "Fibre (optional)",
    });
  });

  it("should pin the nutrition note and the basis choices", () => {
    expect(FOOD_FORM.nutritionNote).toBe("Energy, protein, carbohydrate and fat are required.");
    expect(FOOD_FORM.basis).toBe("Basis");
    expect(FOOD_FORM.basisOptions).toEqual({ per_100g: "Per 100 g", per_100ml: "Per 100 ml" });
  });

  it("should pin the notes under the barcode and the nutrients", () => {
    expect(FOOD_FORM.barcodeFromEntry).toBe("Filled in from the barcode you entered");
    expect(FOOD_FORM.barcodeFromCopy).toBe("Kept from the product you are copying");
    expect(FOOD_FORM.notGivenBySource).toBe("Not given by the source");
    expect(FOOD_FORM.nutrientNotGiven).toBe("Not given");
    expect(FOOD_FORM.usCarbsNote).toBe(
      "This product's carbohydrate included fibre. Enter the carbohydrate without fibre.",
    );
  });

  it("should pin the names of the header controls", () => {
    expect(FOOD_FORM.back).toBe("Back");
    expect(FOOD_FORM.close).toBe("Close");
  });

  it("should pin the portion row labels", () => {
    expect(FOOD_FORM.portionLabelPlaceholder).toBe("e.g. 1 slice");
    expect(FOOD_FORM.amount).toBe("Amount");
    expect(FOOD_FORM.addPortion).toBe("Add portion");
    expect(FOOD_FORM.remove).toBe("Remove");
    expect(FOOD_FORM.makeDefault).toBe("Default");
  });

  it("should pin the validation summary and the save outcomes", () => {
    expect(FOOD_FORM.validationSummary).toBe("Check the fields marked below and try again.");
    expect(FOOD_FORM.saving).toBe("Saving");
    expect(FOOD_FORM.saveFailed).toBe(
      "Your food could not be saved. Check your connection and try again.",
    );
    expect(FOOD_FORM.savedWithoutPortions).toBe(
      "Your food was saved, but its portions were not. Edit the food to add them again.",
    );
    expect(FOOD_FORM.editTheFood).toBe("Edit the food");
    expect(FOOD_FORM.changesSavedWithoutPortions).toBe(
      "Your changes to the food were saved, but its portions were not. Try saving again.",
    );
  });

  it("should pin the sentence for a shared food that cannot be edited", () => {
    expect(FOOD_FORM.cannotEdit).toEqual({
      title: "Cannot edit this food",
      body: "This food comes from a shared database and cannot be edited.",
    });
  });
});

describe("describePortionField", () => {
  it("should name the portion by its position for each of its controls", () => {
    expect(describePortionField("label", 2)).toBe("Portion 2 label");
    expect(describePortionField("remove", 2)).toBe("Remove portion 2");
    expect(describePortionField("default", 2)).toBe("Portion 2 is the default");
  });
});

describe("describePortionAmountField", () => {
  it("should name the amount by its portion and the unit that follows the basis", () => {
    expect(describePortionAmountField(2, "per_100g")).toBe("Amount for portion 2 (g)");
    expect(describePortionAmountField(1, "per_100ml")).toBe("Amount for portion 1 (ml)");
  });
});

describe("describeAmountUnitNote", () => {
  it("should name the unit that follows the basis", () => {
    expect(describeAmountUnitNote("per_100g")).toBe("Each amount is in g, to match the basis.");
    expect(describeAmountUnitNote("per_100ml")).toBe("Each amount is in ml, to match the basis.");
  });
});

describe("the mobile food form copy", () => {
  it("should pin the labels the mobile boards draw that the web form does not", () => {
    expect(FOOD_FORM.nutritionBasis).toBe("Nutrition basis");
    expect(FOOD_FORM.portionLabel).toBe("Portion label");
    expect(FOOD_FORM.barcodeFromScan).toBe("Filled in from the barcode you scanned");
  });

  it("should pin the sentence for stored portions that have more than one default", () => {
    expect(FOOD_FORM.onlyOneDefaultPortion).toBe("At most one portion can be the default");
  });

  it("should pin the two save notices as a title and a sentence each", () => {
    expect(FOOD_FORM.saveFailedNotice).toEqual({
      title: "Your food could not be saved",
      body: "Check your connection and try again.",
    });
    expect(FOOD_FORM.detailsNotValidNotice).toEqual({
      title: "Some details are not valid",
      body: "Check the fields and try again.",
    });
    expect(FOOD_FORM.portionsNotSavedNotice).toEqual({
      title: "Portions not saved",
      body: "Your food was saved but its portions were not. Save again to add them.",
    });
  });
});

describe("describePortionGroup", () => {
  it("should name the portion by its position", () => {
    expect(describePortionGroup(2)).toBe("Portion 2");
  });
});

describe("describePortionLabelField", () => {
  it("should keep the visible label whole at the start, so the name contains what is drawn", () => {
    expect(describePortionLabelField(2)).toBe("Portion label, portion 2");
    expect(describePortionLabelField(2).startsWith(FOOD_FORM.portionLabel)).toBe(true);
  });
});

describe("describeRemovePortion", () => {
  it("should name the portion by its label", () => {
    expect(describeRemovePortion("Slice", 1)).toBe("Remove portion Slice");
  });

  it("should trim the label", () => {
    expect(describeRemovePortion("  Slice ", 1)).toBe("Remove portion Slice");
  });

  it("should name the portion by its position while the label is empty", () => {
    expect(describeRemovePortion("", 3)).toBe("Remove portion 3");
    expect(describeRemovePortion("   ", 3)).toBe("Remove portion 3");
  });
});
