import {
  FOOD_CREATED_NOTE,
  OPEN_IN_YOUR_FOODS,
  describeFoodCreatedRowName,
  describeFoodCreatedSub,
  describeFoodCreatedTitle,
  describeFoodCreatedUndone,
} from "../../copy/assistantFoodCards";
import { formatCalories, formatGrams } from "../../format/numbers";

import type { AssistantCardDraft } from "./entryCardEntry";

export type FoodCreatedCardFood = {
  id: string;
  name: string;
  /** The label of the one natural portion ("1 bar"), or null for a food with only a per 100 g label. */
  portionLabel: string | null;
  /** The label's figures, per portion or per 100 g, as the person gave them. */
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

/**
 * The card after a `create_custom_food`: "Added food My protein bar", the label's figures, a note that
 * nothing was logged and a link to the food. Undo removes the food from the person's foods.
 */
export function buildFoodCreatedCard(food: FoodCreatedCardFood): AssistantCardDraft {
  return {
    kind: "food_created",
    title: describeFoodCreatedTitle(food.name),
    sub: describeFoodCreatedSub(food.portionLabel),
    rows: [
      {
        name: describeFoodCreatedRowName(food.portionLabel),
        amountText: `P ${formatGrams(food.protein_g)} g · C ${formatGrams(food.carbs_g)} g · F ${formatGrams(food.fat_g)} g`,
        time: null,
        kcalText: `${formatCalories(food.kcal)} kcal`,
        match: null,
        matchedFood: null,
        estimate: false,
      },
    ],
    totalText: null,
    note: FOOD_CREATED_NOTE,
    link: { label: OPEN_IN_YOUR_FOODS, target: { screen: "own_food", foodId: food.id } },
    undo: "available",
    undoneSub: describeFoodCreatedUndone(food.name),
  };
}
