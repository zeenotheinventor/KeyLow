import type { FoodFormValues } from "./types";
import type { FormNutrient } from "@keylow/core/foods";

export type NutrientFieldName = FormNutrient;

export type TextFieldName = keyof Pick<
  FoodFormValues,
  "name" | "brand" | "barcode" | NutrientFieldName
>;
