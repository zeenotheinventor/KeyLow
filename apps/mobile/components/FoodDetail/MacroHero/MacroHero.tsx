import {
  ENERGY_NOT_GIVEN,
  FOOD_DETAIL,
  FOOD_MACRO_LABELS,
  PORTION_PICKER,
  SHARES_OF_ENERGY_ARE_ESTIMATES,
  describeBasis,
} from "@keylow/core/copy";
import { formatCalories } from "@keylow/core/format";
import { energyShares } from "@keylow/core/search";
import { View } from "react-native";

import { MacroTile } from "./MacroTile";
import { Card, Text } from "../../ui";

import type { MacroHeroProps } from "./types";

/**
 * The energy of a food as a large numeral, with its protein, carbohydrate and fat and their share of it.
 * With `amount` it shows the values and the caption of the chosen amount instead of the food's own.
 */
export function MacroHero({ food, amount }: MacroHeroProps) {
  const values = amount === undefined ? food : amount.values;
  // Only an amount can have no values: the food's own always have, even if one is not given.
  const hasNoAmount = values === null;
  const shares = energyShares(
    values ?? { kcal: null, protein_g: null, carbs_g: null, fat_g: null },
  );
  const basis = amount === undefined ? describeBasis(food.basis) : amount.caption;
  // The caption only explains the shares, so it goes when none is drawn.
  const hasShares = Object.values(shares).some((share) => share !== null);

  return (
    <Card aria-label={`${FOOD_DETAIL.macrosLabel}, ${basis}`} role="group">
      <View className="gap-4">
        <View className="flex-row items-baseline gap-[6px]">
          {hasNoAmount ? (
            <>
              <Text tone="muted" variant="display-numeral">
                {PORTION_PICKER.noValue}
              </Text>
              <Text tone="secondary" variant="body-strong">
                kcal
              </Text>
            </>
          ) : values.kcal === null ? (
            <Text tone="muted" variant="h1">
              {ENERGY_NOT_GIVEN}
            </Text>
          ) : (
            <>
              <Text variant="display-numeral">{formatCalories(values.kcal)}</Text>
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
            grams={values?.protein_g ?? null}
            isBlank={hasNoAmount}
            label={FOOD_MACRO_LABELS.protein}
            macro="protein"
            share={shares.protein}
          />
          <MacroTile
            grams={values?.carbs_g ?? null}
            isBlank={hasNoAmount}
            label={FOOD_MACRO_LABELS.carbs}
            macro="carbs"
            share={shares.carbs}
          />
          <MacroTile
            grams={values?.fat_g ?? null}
            isBlank={hasNoAmount}
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
