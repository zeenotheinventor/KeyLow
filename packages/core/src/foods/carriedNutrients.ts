import type { CustomFoodInput } from "../schemas/food";

type CarriedKey = "sat_fat_g" | "sugars_g" | "salt_g";

/** The three values a copy of a food carries invisibly, each present only when it is kept. */
export type CarriedNutrients = Pick<CustomFoodInput, CarriedKey>;

/**
 * The saturated fat, sugars and salt that "Copy to your foods" carries from the shared food into the
 * input of the new custom food. A null on the source is left out of the result, never passed as
 * null. Saturated fat is dropped when it is greater than the edited fat, and sugars when they are
 * greater than the edited carbs, because a part cannot exceed its whole. Salt has no rule.
 */
export function carriedNutrients(
  source: { [Key in CarriedKey]: number | null },
  input: Pick<CustomFoodInput, "fat_g" | "carbs_g">,
): CarriedNutrients {
  return {
    ...(source.sat_fat_g !== null && source.sat_fat_g <= input.fat_g
      ? { sat_fat_g: source.sat_fat_g }
      : {}),
    ...(source.sugars_g !== null && source.sugars_g <= input.carbs_g
      ? { sugars_g: source.sugars_g }
      : {}),
    ...(source.salt_g !== null ? { salt_g: source.salt_g } : {}),
  };
}
