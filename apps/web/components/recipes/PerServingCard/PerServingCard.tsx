import {
  RECIPE_EDITOR,
  describeRecipePer100,
  describeRecipePerServing,
  describeRecipePerServingCard,
} from "@keylow/core/copy";

import type { PerServingCardProps } from "./types";

import { MacroHero } from "@/components/foods/FoodDetail/MacroHero";

/**
 * The recipe editor's Per serving card: the energy of one serving with its protein, carbs and fat, what a
 * serving weighs, and the energy per 100 g. With nothing to work out (no ingredients, or servings that are
 * not a number above 0) it shows dashes. The card is a region that announces its values politely, so the
 * screen hands it the numbers once typing has stopped. Every figure and sentence is core's.
 */
export function PerServingCard({ card }: PerServingCardProps) {
  const regionName = RECIPE_EDITOR.perServingRegionName;

  if (card === null) {
    return (
      <MacroHero
        amount={{
          caption: RECIPE_EDITOR.perServingNoValue,
          values: null,
          region: { name: regionName, announcement: "" },
        }}
      />
    );
  }

  return (
    <MacroHero
      amount={{
        caption: describeRecipePerServing(card.servingGrams),
        values: card.perServing,
        region: {
          name: regionName,
          footnote: describeRecipePer100(card.per100gBasis, card.per100g.kcal),
          announcement: describeRecipePerServingCard(card.perServing),
        },
      }}
    />
  );
}
