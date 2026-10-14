import type { BarcodeInvalidReason } from "../foods/barcode";
import type { NutrientBasis } from "../schemas/food";

export const FOOD_FORM_BUTTONS = {
  create: "Create food",
  copy: "Save to your foods",
  edit: "Save changes",
};

/** The banner on a shared food that is missing values. The body names the missing values. */
export const FOOD_REVIEW_BANNER = {
  title: "Needs review",
  action: "Copy to your foods",
};

export const describeNameProblem = (problem: "required" | "too_long"): string =>
  problem === "required" ? "Name is required" : "Name must be 200 characters or fewer";

export type FoodFormNutrient = "kcal" | "protein_g" | "fat_g" | "carbs_g" | "fibre_g";
export type NutrientProblem = "required" | "negative" | "not_a_number";

const NUTRIENT_SUBJECTS: Readonly<Record<FoodFormNutrient, string>> = {
  kcal: "Energy",
  protein_g: "Protein",
  fat_g: "Fat",
  carbs_g: "Carbohydrate",
  fibre_g: "Fibre",
};

const NUTRIENT_PROBLEM_ENDINGS: Readonly<Record<NutrientProblem, string>> = {
  required: "is required",
  negative: "cannot be negative",
  not_a_number: "must be a number",
};

export const describeNutrientProblem = (
  nutrient: FoodFormNutrient,
  problem: NutrientProblem,
): string => `${NUTRIENT_SUBJECTS[nutrient]} ${NUTRIENT_PROBLEM_ENDINGS[problem]}`;

/** `position` counts from 1, as the user reads the list of portions. */
export const describePortionLabelProblem = (position: number): string =>
  `Portion ${position} needs a label`;

export const describePortionAmountProblem = (position: number): string =>
  `Portion ${position} needs an amount above 0`;

/** The web form shows one message for a portion that fails both checks. */
export const describePortionLabelAndAmountProblem = (position: number): string =>
  `Portion ${position} needs a label and an amount above 0`;

export const FOOD_FORM_BARCODE_PROBLEMS: Readonly<Record<BarcodeInvalidReason, string>> = {
  not_digits: "Barcode can only contain digits",
  bad_length: "Barcode must have 8, 12, 13 or 14 digits",
  bad_check_digit: "Barcode check digit is wrong",
  not_upc_e: "Barcode is not a valid product code",
};

/** For a barcode the schema rejected although the code normalises, which should not happen. */
export const FOOD_FORM_BARCODE_NOT_VALID = "Barcode is not valid";

/**
 * The labels, notes and outcomes of the web food form, as its boards draw them. A sentence that
 * names a portion or a unit is a function below.
 */
export const FOOD_FORM = {
  back: "Back",
  cancel: "Cancel",
  titles: { create: "New food", copy: "Copy to your foods", edit: "Edit food" },
  copyIntro:
    "Check each value and fill in the ones that are blank. Saving adds a food of your own and leaves the original as it is.",
  details: "Details",
  portions: "Portions",
  required: "Required",
  name: "Name",
  namePlaceholder: "e.g. Greek yoghurt",
  optionalPlaceholder: "Optional",
  brand: "Brand",
  barcode: "Barcode",
  barcodeFromEntry: "Filled in from the barcode you entered",
  barcodeFromCopy: "Kept from the product you are copying",
  nutritionNote: "Energy, protein, carbohydrate and fat are required.",
  basis: "Basis",
  basisOptions: { per_100g: "Per 100 g", per_100ml: "Per 100 ml" },
  nutrients: {
    kcal: "Energy",
    protein_g: "Protein",
    carbs_g: "Carbohydrate",
    fat_g: "Fat",
    fibre_g: "Fibre (optional)",
  },
  notGivenBySource: "Not given by the source",
  usCarbsNote: "This product's carbohydrate included fibre. Enter the carbohydrate without fibre.",
  portionLabelPlaceholder: "e.g. 1 slice",
  amount: "Amount",
  addPortion: "Add portion",
  remove: "Remove",
  makeDefault: "Default",
  validationSummary: "Check the fields marked below and try again.",
  saving: "Saving",
  saveFailed: "Your food could not be saved. Check your connection and try again.",
  savedWithoutPortions:
    "Your food was saved, but its portions were not. Edit the food to add them again.",
  editTheFood: "Edit the food",
  changesSavedWithoutPortions:
    "Your changes to the food were saved, but its portions were not. Try saving again.",
  cannotEdit: {
    title: "Cannot edit this food",
    body: "This food comes from a shared database and cannot be edited.",
  },
};

/** The name of one control in a portion row, which tells a screen reader which row it is in. `position` counts from 1. */
export const describePortionField = (
  field: "label" | "remove" | "default",
  position: number,
): string => {
  switch (field) {
    case "label":
      return `Portion ${position} label`;
    case "remove":
      return `Remove portion ${position}`;
    case "default":
      return `Portion ${position} is the default`;
  }
};

const amountUnit = (basis: NutrientBasis): string => (basis === "per_100g" ? "g" : "ml");

/** The name of a portion's amount field, with the unit that follows the basis. `position` counts from 1. */
export const describePortionAmountField = (position: number, basis: NutrientBasis): string =>
  `Amount for portion ${position} (${amountUnit(basis)})`;

/** Says which unit every portion amount is in: grams under a per 100 g basis, millilitres under per 100 ml. */
export const describeAmountUnitNote = (basis: NutrientBasis): string =>
  `Each amount is in ${amountUnit(basis)}, to match the basis.`;
