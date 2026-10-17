import { Keyboard, View } from "react-native";

import { AddIngredientAmountStep } from "../AddIngredientAmountStep";
import { FoodSearch } from "../FoodSearch";

import type { AddIngredientSheetProps, ChosenFood } from "./types";

/**
 * The recipe editor's way to add an ingredient: the food search in its ingredient mode and, once a food is
 * chosen, its amount step over it. The search stays where it is under the step, so Back returns to the same
 * results for the same words. A screen reader cannot reach the search while the step is open. Nothing is
 * written here: Add to recipe hands the ingredient to the editor, whose draft is the editor's until Save.
 */
export function AddIngredientSheet({
  chosen,
  onChoose,
  onBackToResults,
  onClose,
  onAdd,
}: AddIngredientSheetProps) {
  // The search field may hold the keyboard, which would stay up under the amount step.
  function choose(next: ChosenFood) {
    Keyboard.dismiss();
    onChoose(next);
  }

  return (
    <View className="flex-1 bg-background">
      <View
        aria-hidden={chosen !== undefined}
        className="flex-1"
        importantForAccessibility={chosen === undefined ? "auto" : "no-hide-descendants"}
      >
        <FoodSearch
          ingredient={{
            onOpenRecent: (recent) => {
              choose({ foodId: recent.foodId, recent });
            },
          }}
          onClose={onClose}
          onOpenFood={(foodId) => {
            choose({ foodId });
          }}
        />
      </View>
      {chosen === undefined ? null : (
        <View accessibilityViewIsModal className="absolute inset-0 bg-background">
          <AddIngredientAmountStep
            // Another food is another page, so the amount and the unit start afresh.
            key={chosen.foodId}
            foodId={chosen.foodId}
            recent={chosen.recent}
            onAdd={onAdd}
            onBack={onBackToResults}
          />
        </View>
      )}
    </View>
  );
}
