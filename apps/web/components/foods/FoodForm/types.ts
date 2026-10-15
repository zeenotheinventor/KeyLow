import type { CustomFoodValidationError } from "@keylow/api-client";
import type { FoodFormNutrient } from "@keylow/core/copy";
import type { FoodFormFields, PortionFormFields } from "@keylow/core/foods";
import type { Food, FoodPortion } from "@keylow/core/schemas";

/** A food already saved by the user, with its portions, which the form edits instead of creating. */
export type FoodFormExistingFood = { food: Food; portions: FoodPortion[] };

export type FoodFormProps = {
  /** A barcode that came from a scan. It pre-fills the barcode field and cannot be changed. */
  scannedBarcode?: string | undefined;
  existing?: FoodFormExistingFood;
  /**
   * A food, usually a shared one, to start a new food from. Its details, nutrients and portions
   * pre-fill the form, and saving creates a new food of the user's own. The original is never
   * changed. Leave `existing` out when passing this.
   */
  copyOf?: FoodFormExistingFood;
};

/** One portion as the form holds it. The amount is text until the form is validated. */
export type PortionFormValues = PortionFormFields & { key: string };

/** Every number is text while the user types, and only becomes a number when the form is validated. */
export type FoodFormValues = FoodFormFields & { portions: PortionFormValues[] };

/** What is wrong with one portion row: one sentence for the row, and which of its two fields to flag. */
export type PortionError = { sentence: string; isLabelInvalid: boolean; isAmountInvalid: boolean };

/** The sentence for each field that failed validation, in the words the mobile form uses. */
export type FormErrors = {
  name?: string;
  barcode?: string;
  nutrients: Partial<Record<FoodFormNutrient, string>>;
  /** By the portion's position in the list, from 0. */
  portions: Partial<Record<number, PortionError>>;
};

export type FormIssue = CustomFoodValidationError["issues"][number];
