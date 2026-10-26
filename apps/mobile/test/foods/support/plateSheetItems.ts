import { chickenAndRice } from "../../plate/support/plateItems";

import type { PlateItemBuilder } from "../../../lib/plate";
import type { PlateFoodItem } from "@keylow/core/plate";

const portionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function food(
  key: string,
  name: string,
  quantity: number,
  unit: PlateFoodItem["unit"],
  perUnit: PlateFoodItem["perUnit"],
): PlateFoodItem {
  return {
    kind: "food",
    key,
    foodId: `${name}-id`,
    name,
    quantityText: String(quantity),
    quantity,
    unit,
    perUnit,
  };
}

const yoghurt: PlateItemBuilder = (key) =>
  food(
    key,
    "Greek yoghurt 0% fat",
    1,
    { kind: "portion", portionId, label: "1 pot", size: { amount: 170, unit: "g" } },
    { kcal: 97, protein_g: 17.3, carbs_g: 6.5, fat_g: 0.3 },
  );

const banana: PlateItemBuilder = (key) =>
  food(
    key,
    "Banana",
    1,
    { kind: "portion", portionId, label: "1 medium", size: { amount: 100, unit: "g" } },
    { kcal: 95, protein_g: 1.2, carbs_g: 20.3, fat_g: 0.1 },
  );

export const milk: PlateItemBuilder = (key) =>
  food(
    key,
    "Semi-skimmed milk",
    200,
    { kind: "ml" },
    { kcal: 0.46, protein_g: 0.035, carbs_g: 0.048, fat_g: 0.017 },
  );

/**
 * The four foods of the `plate · open` board, in its order: Chicken and rice (a recipe, 374 kcal), Greek
 * yoghurt 0% fat (1 pot, 97), Banana (1 medium, 95) and Semi-skimmed milk (200 ml, 92), which come to 658 kcal.
 */
export const boardPlate: readonly PlateItemBuilder[] = [chickenAndRice, yoghurt, banana, milk];
