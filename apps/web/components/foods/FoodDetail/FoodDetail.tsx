"use client";

import { useFoodWithPortions } from "@keylow/api-client";
import { FOOD_DETAIL, describeNutritionHeading } from "@keylow/core/copy";
import { DATA_SOURCE_ATTRIBUTION, requiresConfirmation } from "@keylow/core/foods";

import { BackToFoodsLink } from "./BackToFoodsLink";
import { FoodAttribution } from "./FoodAttribution";
import { FoodHeader } from "./FoodHeader";
import { MacroHero } from "./MacroHero";
import { MissingValuesReview } from "./MissingValuesReview";
import { nutrientRows } from "./nutrientRows";
import { PortionList } from "./PortionList";
import { FoodLoadNotice } from "../FoodLoadNotice";

import type { FoodDetailProps } from "./types";

import { NutrientTable } from "@/components/ui/NutrientTable";

export function FoodDetail({ id }: FoodDetailProps) {
  const state = useFoodWithPortions(id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <BackToFoodsLink />
      {state.status === "ready" ? (
        <>
          <FoodHeader food={state.food} />
          {requiresConfirmation(state.food) && (
            <MissingValuesReview
              foodId={state.food.id}
              fieldsMissing={state.food.quality.fields_missing ?? []}
              carbsConvention={state.food.quality.carbs_convention}
            />
          )}
          <MacroHero food={state.food} />
          <div className="flex flex-col gap-2">
            <NutrientTable
              caption={describeNutritionHeading(state.food.basis)}
              rows={nutrientRows(state.food)}
            />
            {state.food.quality.carbs_convention === "us_total" && (
              <p className="px-1 text-caption text-text-secondary">{FOOD_DETAIL.usCarbsNote}</p>
            )}
          </div>
          {state.portions.length > 0 && <PortionList portions={state.portions} />}
          {state.food.source !== "user" && (
            <FoodAttribution attribution={DATA_SOURCE_ATTRIBUTION[state.food.source]} />
          )}
        </>
      ) : (
        <FoodLoadNotice state={state} />
      )}
    </div>
  );
}
