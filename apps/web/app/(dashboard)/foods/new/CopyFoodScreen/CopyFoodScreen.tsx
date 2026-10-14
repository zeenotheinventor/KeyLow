"use client";

import { useFoodWithPortions } from "@keylow/api-client";
import { FOOD_DETAIL, FOOD_FORM } from "@keylow/core/copy";

import type { CopyFoodScreenProps } from "./types";

import { FoodForm } from "@/components/foods/FoodForm";
import { FoodFormPage } from "@/components/foods/FoodFormPage";
import { FoodLoadNotice } from "@/components/foods/FoodLoadNotice";

export function CopyFoodScreen({ fromId }: CopyFoodScreenProps) {
  const state = useFoodWithPortions(fromId);

  if (state.status !== "ready") {
    return (
      <FoodFormPage backLabel={FOOD_DETAIL.back}>
        <FoodLoadNotice state={state} />
      </FoodFormPage>
    );
  }

  return (
    <FoodFormPage
      backLabel={FOOD_FORM.back}
      title={FOOD_FORM.titles.copy}
      intro={FOOD_FORM.copyIntro}
    >
      <FoodForm copyOf={{ food: state.food, portions: state.portions }} />
    </FoodFormPage>
  );
}
