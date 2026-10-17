import {
  RECIPE_EDITOR,
  describeRecipePer100,
  describeRecipePerServing,
  describeRecipePerServingCard,
} from "@keylow/core/copy";

import { MacroHero } from "../FoodDetail/MacroHero";

import type { PerServingCardProps } from "./types";

/**
 * The recipe editor's Per serving card: the energy of one serving with its protein, carbs and fat, what a
 * serving weighs, and the energy per 100 g. With nothing to work out it shows dashes. The card is a region
 * that tells a screen reader when its values change, so the screen hands it the numbers once typing has
 * stopped. Every figure and sentence is core's.
 */
export function PerServingCard({ card }: PerServingCardProps) {
  const name = RECIPE_EDITOR.perServingRegionName;

  if (card === null) {
    return (
      <MacroHero
        amount={{
          caption: RECIPE_EDITOR.perServingNoValue,
          values: null,
          region: { name, announcement: "" },
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
          name,
          footnote: describeRecipePer100(card.per100gBasis, card.per100g.kcal),
          announcement: describeRecipePerServingCard(card.perServing),
        },
      }}
    />
  );
}
