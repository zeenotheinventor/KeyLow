import type { Food } from "@keylow/core/schemas";

export type MacroHeroProps = {
  food: Pick<Food, "basis" | "kcal" | "protein_g" | "carbs_g" | "fat_g">;
};
