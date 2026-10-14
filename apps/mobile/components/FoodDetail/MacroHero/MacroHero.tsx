import {
  ENERGY_NOT_GIVEN,
  FOOD_DETAIL,
  FOOD_MACRO_LABELS,
  SHARES_OF_ENERGY_ARE_ESTIMATES,
  describeBasis,
} from "@keylow/core/copy";
import { formatCalories } from "@keylow/core/format";
import { energyShares } from "@keylow/core/search";
import { View } from "react-native";

import { MacroTile } from "./MacroTile";
import { Card, Text } from "../../ui";

import type { MacroHeroProps } from "./types";

/** The energy of a food as a large numeral, with its protein, carbohydrate and fat and their share of it. */
export function MacroHero({ food }: MacroHeroProps) {
  const shares = energyShares(food);
  const basis = describeBasis(food.basis);
  // The caption only explains the shares, so it goes when none is drawn.
  const hasShares = Object.values(shares).some((share) => share !== null);

  return (
    <Card aria-label={`${FOOD_DETAIL.macrosLabel}, ${basis}`} role="group">
      <View className="gap-4">
        <View className="flex-row items-baseline gap-[6px]">
          {food.kcal === null ? (
            <Text tone="muted" variant="h1">
              {ENERGY_NOT_GIVEN}
            </Text>
          ) : (
            <>
              <Text variant="display-numeral">{formatCalories(food.kcal)}</Text>
              <Text tone="secondary" variant="body-strong">
                kcal
              </Text>
            </>
          )}
          <Text className="ml-auto" tone="muted" variant="caption">
            {basis}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <MacroTile
            grams={food.protein_g}
            label={FOOD_MACRO_LABELS.protein}
            macro="protein"
            share={shares.protein}
          />
          <MacroTile
            grams={food.carbs_g}
            label={FOOD_MACRO_LABELS.carbs}
            macro="carbs"
            share={shares.carbs}
          />
          <MacroTile
            grams={food.fat_g}
            label={FOOD_MACRO_LABELS.fat}
            macro="fat"
            share={shares.fat}
          />
        </View>
        {hasShares ? (
          <Text tone="muted" variant="caption">
            {SHARES_OF_ENERGY_ARE_ESTIMATES}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
