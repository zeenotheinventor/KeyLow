import { amountUnit } from "../foods/foodForm";
import { MAX_GRAMS_PER_100, MAX_KCAL_PER_100 } from "../schemas/nutrients";

import type { BarcodeInvalidReason } from "../foods/barcode";
import type { NutrientBasis } from "../schemas/food";

export const FOOD_FORM_BUTTONS = {
  create: "Create food",
  copy: "Save to your foods",
  edit: "Save changes",
  /** What the button says once a create has saved the food but not its portions and the next save updates it. */
  save: "Save",
};

/** The banner on a shared food that is missing values. The body names the missing values. */
export const FOOD_REVIEW_BANNER = {
  title: "Needs review",
  action: "Copy to your foods",
};

export const describeNameProblem = (problem: "required" | "too_long"): string =>
  problem === "required" ? "Name is required" : "Name must be 200 characters or fewer";

export type FoodFormNutrient = "kcal" | "protein_g" | "fat_g" | "carbs_g" | "fibre_g";
export type NutrientProblem = "required" | "negative" | "not_a_number" | "too_large";

const NUTRIENT_SUBJECTS: Readonly<Record<FoodFormNutrient, string>> = {
  kcal: "Energy",
  protein_g: "Protein",
  fat_g: "Fat",
  carbs_g: "Carbohydrate",
  fibre_g: "Fibre",
};

const NUTRIENT_PROBLEM_ENDINGS: Readonly<Record<Exclude<NutrientProblem, "too_large">, string>> = {
  required: "is required",
  negative: "cannot be negative",
  not_a_number: "must be a number",
};

const describeLargestAmount = (nutrient: FoodFormNutrient): string =>
  nutrient === "kcal" ? `${MAX_KCAL_PER_100} kcal` : `${MAX_GRAMS_PER_100} g`;

export const describeNutrientProblem = (
  nutrient: FoodFormNutrient,
  problem: NutrientProblem,
): string =>
  problem === "too_large"
    ? `${NUTRIENT_SUBJECTS[nutrient]} cannot be more than ${describeLargestAmount(nutrient)} per 100 g or 100 ml`
    : `${NUTRIENT_SUBJECTS[nutrient]} ${NUTRIENT_PROBLEM_ENDINGS[problem]}`;

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
  close: "Close",
  cancel: "Cancel",
  titles: { create: "New food", copy: "Copy to your foods", edit: "Edit food" },
  copyIntro:
    "Check each value and fill in the ones that are blank. Saving adds a food of your own and leaves the original as it is.",
  details: "Details",
  portions: "Portions",
  required: "Required",
  /** What a screen reader adds to a field that shows a value and cannot be changed. */
  readOnly: "Read only",
  name: "Name",
  namePlaceholder: "e.g. Greek yoghurt",
  optionalPlaceholder: "Optional",
  brand: "Brand",
  barcode: "Barcode",
  barcodeFromEntry: "Filled in from the barcode you entered",
  barcodeFromScan: "Filled in from the barcode you scanned",
  barcodeFromCopy: "Kept from the product you are copying",
  nutritionNote: "Energy, protein, carbohydrate and fat are required.",
  basis: "Basis",
  /** The mobile form's name for the basis control, which the boards draw as "Nutrition basis". */
  nutritionBasis: "Nutrition basis",
  basisOptions: { per_100g: "Per 100 g", per_100ml: "Per 100 ml" },
  nutrients: {
    kcal: "Energy",
    protein_g: "Protein",
    carbs_g: "Carbohydrate",
    fat_g: "Fat",
    fibre_g: "Fibre (optional)",
  },
  notGivenBySource: "Not given by the source",
  /** The mobile form's cue under a required nutrient the copied food leaves blank, as its boards draw it. */
  nutrientNotGiven: "Not given",
  usCarbsNote: "This product's carbohydrate included fibre. Enter the carbohydrate without fibre.",
  portionLabel: "Portion label",
  portionLabelPlaceholder: "e.g. 1 slice",
  amount: "Amount",
  addPortion: "Add portion",
  remove: "Remove",
  makeDefault: "Default",
  /** For stored portions with more than one default, which the form's switches cannot produce. */
  onlyOneDefaultPortion: "At most one portion can be the default",
  validationSummary: "Check the fields marked below and try again.",
  saving: "Saving",
  saveFailed: "Your food could not be saved. Check your connection and try again.",
  /** The mobile form's notices above Save, a title and one sentence each, as its boards draw them. */
  saveFailedNotice: {
    title: "Your food could not be saved",
    body: "Check your connection and try again.",
  },
  detailsNotValidNotice: {
    title: "Some details are not valid",
    body: "Check the fields and try again.",
  },
  portionsNotSavedNotice: {
    title: "Portions not saved",
    body: "Your food was saved but its portions were not. Save again to add them.",
  },
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

/** The name of one portion's group of fields, which tells a screen reader which row the fields are in. `position` counts from 1. */
export const describePortionGroup = (position: number): string => `Portion ${position}`;

/**
 * The name of a portion's label field. It starts with the visible label, "Portion label", whole, so the
 * name contains what is drawn, and then says which portion. `position` counts from 1.
 */
export const describePortionLabelField = (position: number): string =>
  `${FOOD_FORM.portionLabel}, portion ${position}`;

/** The name of a portion's remove button: by its label, or by its position while the label is blank. */
export const describeRemovePortion = (label: string, position: number): string =>
  label.trim() === "" ? describePortionField("remove", position) : `Remove portion ${label.trim()}`;

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

/** The name of a portion's amount field, with the unit that follows the basis. `position` counts from 1. */
export const describePortionAmountField = (position: number, basis: NutrientBasis): string =>
  `Amount for portion ${position} (${amountUnit(basis)})`;

/** Says which unit every portion amount is in: grams under a per 100 g basis, millilitres under per 100 ml. */
export const describeAmountUnitNote = (basis: NutrientBasis): string =>
  `Each amount is in ${amountUnit(basis)}, to match the basis.`;
