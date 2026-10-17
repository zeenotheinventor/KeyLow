import type { FoodTableVariant } from "@/components/ui/FoodTableHeader";
import type { ReactNode } from "react";

export type FoodTableProps = {
  /** Names the table for assistive technology, such as the hour it holds: "Foods at 08:00". */
  label: string;
  /** `recipe` heads the recipe library's table and takes `FoodRow`s with `layout="recipeTable"`. */
  variant?: FoodTableVariant | undefined;
  /** The rows: `FoodRow`s with `layout="table"`, or `"recipeTable"` for the `recipe` variant. */
  children: ReactNode;
};
