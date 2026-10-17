import type { Food } from "@keylow/core/schemas";

export type PerHundredListProps = {
  /** The card's heading, such as "Per 100 g", "Per 100 ml" or "Per 100 g cooked". */
  heading: string;
  /** The values per 100 of what the heading says. A value that is null reads "not given". */
  values: Pick<Food, "kcal" | "protein_g" | "carbs_g" | "fat_g">;
};
