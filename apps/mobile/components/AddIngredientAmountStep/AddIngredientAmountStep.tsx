import { useFoodWithPortions, useRefreshOutdatedOffFood } from "@keylow/api-client";
import { ADD_INGREDIENT, FOOD_FORM } from "@keylow/core/copy";
import { newIngredient } from "@keylow/core/recipes";
import { vars } from "nativewind";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { amountForPicker, amountLastLogged } from "../../lib/amountLastLogged";
import { FoodLoadStateBody } from "../FoodLoadState";
import { PortionPicker } from "../PortionPicker";
import { SheetHeader } from "../ui";

import type { AddIngredientAmountStepProps } from "./types";

/**
 * The amount step of a food that is about to join a recipe: the portion picker in its add-ingredient mode,
 * drawn from the food as it is now, with its chips from the food's portions. Add to recipe hands back the
 * ingredient, which freezes the food's values into the recipe as they are today. Nothing is written: the
 * editor's draft is the editor's until Save. A branded food stored before the portion rules is refreshed
 * while the step is open, as in the diary's picker, so its new portions appear as chips. While the food
 * loads, or if it cannot be read, a header with Back stands in, so the search is never left behind.
 */
export function AddIngredientAmountStep({
  foodId,
  recent,
  onAdd,
  onBack,
}: AddIngredientAmountStepProps) {
  const state = useFoodWithPortions(foodId);
  // Before the early return below, so the hooks keep their order. A branded food stored before the portion
  // rules is asked for once, and its new portions reach the chips with no spinner and no message.
  useRefreshOutdatedOffFood(state.status === "ready" ? state.food : undefined);
  const insets = useSafeAreaInsets();

  if (state.status !== "ready") {
    return (
      // The top inset is a runtime value no class can name, so it goes through a variable.
      <View
        className="flex-1 bg-background pt-[var(--inset-top)]"
        style={vars({ "--inset-top": insets.top })}
      >
        <SheetHeader
          isTitleHeading={false}
          leading={{ icon: "ChevronLeft", label: FOOD_FORM.back, onPress: onBack }}
          title={ADD_INGREDIENT.title}
        />
        <FoodLoadStateBody state={state.status} />
      </View>
    );
  }

  const { food, portions } = state;
  const lastAmount = recent === undefined ? undefined : amountLastLogged(recent, portions);

  return (
    <PortionPicker
      food={food}
      initialAmount={lastAmount === undefined ? undefined : amountForPicker(lastAmount)}
      mode="add-ingredient"
      portions={portions}
      onBack={onBack}
      onSubmit={(amount) => {
        onAdd(newIngredient(food, amount, portions));
      }}
    />
  );
}
