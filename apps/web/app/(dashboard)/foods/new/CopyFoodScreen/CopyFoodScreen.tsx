"use client";

import { useFoodWithPortions } from "@keylow/api-client";
import { FOOD_DETAIL, FOOD_FORM } from "@keylow/core/copy";
import { canBeCopiedToYourFoods } from "@keylow/core/foods";
import { Lock } from "lucide-react";

import type { CopyFoodScreenProps } from "./types";

import { FoodForm } from "@/components/foods/FoodForm";
import { FoodFormPage } from "@/components/foods/FoodFormPage";
import { FoodLoadNotice } from "@/components/foods/FoodLoadNotice";
import { EmptyState } from "@/components/ui/EmptyState";

export function CopyFoodScreen({ fromId }: CopyFoodScreenProps) {
  const state = useFoodWithPortions(fromId);

  if (state.status !== "ready") {
    return (
      <FoodFormPage backLabel={FOOD_DETAIL.back}>
        <FoodLoadNotice state={state} />
      </FoodFormPage>
    );
  }

  // A food no one can own has no form to copy into.
  if (!canBeCopiedToYourFoods(state.food)) {
    return (
      <FoodFormPage backLabel={FOOD_FORM.back}>
        <EmptyState
          icon={Lock}
          headingLevel={1}
          size="page"
          title={FOOD_FORM.cannotEdit.title}
          body={FOOD_FORM.cannotEdit.body}
        />
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
