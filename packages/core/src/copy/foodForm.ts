import type { BarcodeInvalidReason } from "../foods/barcode";

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
