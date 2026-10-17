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
import { useEffect, useRef } from "react";
import { AccessibilityInfo, View } from "react-native";

import { MacroTile } from "./MacroTile";
import { Card, Text } from "../../ui";

import type { MacroHeroProps } from "./types";

/**
 * The energy of a food as a large numeral, with its protein, carbohydrate and fat and their share of it.
 * With `amount` it shows the values and the caption of the chosen amount instead of the food's own. With
 * `amount.region` it is the recipe editor's Per serving card: a region of its own that tells a screen
 * reader when its values change, with a line under the macros in place of the note about the shares.
 */
export function MacroHero(props: MacroHeroProps) {
  const { amount } = props;
  const values = amount === undefined ? props.food : amount.values;
  // Only an amount can have no values: the food's own always have, even if one is not given.
  const hasNoAmount = values === null;
  const shares = energyShares(
    values ?? { kcal: null, protein_g: null, carbs_g: null, fat_g: null },
  );
  const basis = props.amount === undefined ? describeBasis(props.food.basis) : props.amount.caption;
  const region = amount?.region;
  // The caption only explains the shares, so it goes when none is drawn.
  const hasShares = Object.values(shares).some((share) => share !== null);

  // A change is told once it happens: what the card shows when it first appears is already on the screen.
  const announcement = region?.announcement ?? "";
  const lastAnnouncement = useRef(announcement);
  useEffect(() => {
    if (announcement !== lastAnnouncement.current) {
      lastAnnouncement.current = announcement;
      if (announcement !== "") {
        AccessibilityInfo.announceForAccessibility(announcement);
      }
    }
  }, [announcement]);

  return (
    <Card
      aria-label={region === undefined ? `${FOOD_DETAIL.macrosLabel}, ${basis}` : region.name}
      role={region === undefined ? "group" : "region"}
    >
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
        {region === undefined ? (
          hasShares ? (
            <Text tone="muted" variant="caption">
              {SHARES_OF_ENERGY_ARE_ESTIMATES}
            </Text>
          ) : null
        ) : region.footnote === undefined ? null : (
          <Text tone="muted" variant="caption">
            {region.footnote}
          </Text>
        )}
      </View>
    </Card>
  );
}
