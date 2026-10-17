import { useFoodWithPortions } from "@keylow/api-client";

import { frozenFoodOf, ingredientWithAmount } from "../../lib/ingredientFromAmount";
import { PortionPicker } from "../PortionPicker";

import type { IngredientAmountStepProps } from "./types";

/**
 * The amount step of an ingredient already in a recipe: the portion picker in its ingredient mode, drawn
 * from the ingredient's own snapshot (its hero, its values per 100 g, the amount it starts at) with the chips
 * of the food's portions as they are now. The values never come from the live food, so a food edited since
 * moves nothing here; the live food only decides which portions the chips offer, and only while it is there
 * to take them from. Save hands back the ingredient with the new amount, and Remove from recipe asks for it to
 * go. Neither writes anything: the editor's draft is the editor's until Save.
 */
export function IngredientAmountStep({
  ingredient,
  onSave,
  onRemove,
  onBack,
}: IngredientAmountStepProps) {
  const liveFood = useFoodWithPortions(ingredient.food_id);
  const livePortions =
    liveFood.status === "ready" && liveFood.food.deleted_at === null
      ? { portions: liveFood.portions, loggedPortionId: ingredient.portion_id }
      : undefined;

  return (
    <PortionPicker
      food={frozenFoodOf(ingredient)}
      livePortions={livePortions}
      mode="edit-ingredient"
      snapshot={ingredient.snapshot}
      onBack={onBack}
      onRemove={onRemove}
      onSubmit={(amount) => {
        onSave(ingredientWithAmount(ingredient, amount));
      }}
    />
  );
}
