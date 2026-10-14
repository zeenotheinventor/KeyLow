import { FOOD_DETAIL, FOOD_REVIEW_BANNER, describeMissingValues } from "@keylow/core/copy";
import { requiresConfirmation } from "@keylow/core/foods";
import { vars } from "nativewind";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FoodHeader } from "./FoodHeader";
import { MacroHero } from "./MacroHero";
import { PortionList } from "./PortionList";
import { FoodFormScreen } from "../FoodFormScreen";
import { NutrientTable } from "../NutrientTable";
import { Banner, Button } from "../ui";

import type { FoodDetailProps } from "./types";

// The boards leave 34 below the last block, which is the bottom inset of an iPhone. A taller navigation bar takes its own height instead.
const MINIMUM_BOTTOM_PADDING = 34;

/**
 * A food as the food detail boards draw it, under the sheet's "Food" header: its name and source, the
 * energy card, an Edit action for the user's own food or the review notice for a shared one with values
 * missing, then the nutrition and the portions. Values are per 100 g or 100 ml. The source's licence credit
 * is not here but on the About screen, reached from More.
 */
export function FoodDetail({ food, portions, onEdit, onCopy }: FoodDetailProps) {
  const { source } = food;
  const insets = useSafeAreaInsets();

  return (
    <FoodFormScreen isTitleHeading={false} title={FOOD_DETAIL.title}>
      {/* The padding is a runtime value no class can name, so it goes through a variable. */}
      <View
        className="flex-1"
        style={vars({ "--content-bottom": Math.max(insets.bottom, MINIMUM_BOTTOM_PADDING) })}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-4 px-4 pb-[var(--content-bottom)] pt-1"
        >
          <FoodHeader food={food} />
          <MacroHero food={food} />

          {source === "user" ? (
            <Button fullWidth icon="Pencil" variant="secondary" onPress={onEdit}>
              {FOOD_DETAIL.edit}
            </Button>
          ) : null}

          {requiresConfirmation(food) ? (
            <Banner
              action={{ label: FOOD_REVIEW_BANNER.action, onPress: onCopy }}
              body={describeMissingValues(
                food.quality.fields_missing ?? [],
                food.quality.carbs_convention,
              )}
              title={FOOD_REVIEW_BANNER.title}
              variant="review"
            />
          ) : null}

          <NutrientTable
            food={food}
            note={
              food.quality.carbs_convention === "us_total" ? FOOD_DETAIL.usCarbsNote : undefined
            }
          />

          {portions.length === 0 ? null : <PortionList portions={portions} />}
        </ScrollView>
      </View>
    </FoodFormScreen>
  );
}
