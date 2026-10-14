"use client";

import { useFoodWithPortions } from "@keylow/api-client";
import { FOOD_DETAIL, FOOD_FORM } from "@keylow/core/copy";
import { Lock } from "lucide-react";

import { FoodForm } from "@/components/foods/FoodForm";
import { FoodFormPage } from "@/components/foods/FoodFormPage";
import { FoodLoadNotice } from "@/components/foods/FoodLoadNotice";
import { EmptyState } from "@/components/ui/EmptyState";

export function EditFoodScreen({ id }: { id: string }) {
  const state = useFoodWithPortions(id);

  if (state.status !== "ready") {
    return (
      <FoodFormPage backLabel={FOOD_DETAIL.back}>
        <FoodLoadNotice state={state} />
      </FoodFormPage>
    );
  }

  if (state.food.source !== "user") {
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
    <FoodFormPage backLabel={FOOD_FORM.back} title={FOOD_FORM.titles.edit}>
      <FoodForm existing={{ food: state.food, portions: state.portions }} />
    </FoodFormPage>
  );
}
