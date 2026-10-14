"use client";

import { useFoodWithPortions } from "@keylow/api-client";

import type { CopyFoodScreenProps } from "./types";

import { FoodForm } from "@/components/foods/FoodForm";
import { FoodLoadNotice } from "@/components/foods/FoodLoadNotice";

export function CopyFoodScreen({ fromId }: CopyFoodScreenProps) {
  const state = useFoodWithPortions(fromId);

  if (state.status !== "ready") {
    return <FoodLoadNotice state={state} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Review and save as my food</h1>
      <p className="text-sm text-text-muted">
        Check each value and fill in the ones that are blank. Saving adds a food of your own and
        leaves the original as it is.
      </p>
      <FoodForm copyOf={{ food: state.food, portions: state.portions }} />
    </div>
  );
}
