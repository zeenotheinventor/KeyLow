// What the model is told about a food. The repos read every food column and `food_portions.*`, so the
// projection here is what limits the fields: it is the one place that lists which of them leave the
// tool, and a column added to `foods` later reaches the model only by being added here.
import { isOurEstimate } from "../../core.ts";

import type { Food, FoodPortion, OffCandidate } from "../../core.ts";

type FoodFields = {
  id: string;
  name: string;
  brand: string | null;
  source: string;
  basis: Food["basis"];
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  fibre_g: number | null;
  // A search hit carries no food group, so it is absent there and read as none.
  food_group?: string | null;
};

// A portion is a weight or a volume, never both, so a liquid's portion has `ml` and no `grams`.
// The id is what a write tool takes to log the portion, so the model never has to guess it.
// `estimated` is present only when true: it marks a portion Ki-Lo generated (a shared estimate, or the
// one the app made for a person's own food). A portion the person typed, even one labelled "1 typical slice", is
// theirs and is never marked, which is why this asks `isOurEstimate` and not the label alone.
const portionView = ({ id, label, grams, ml }: FoodPortion, isEstimate: boolean) => ({
  id,
  label,
  grams,
  ml,
  ...(isEstimate ? { estimated: true as const } : {}),
});

// Null portions say they were not looked up, which an empty list would not: an empty list says the
// food has none.
export const foodView = (food: FoodFields, portions: readonly FoodPortion[] | null) => ({
  id: food.id,
  name: food.name,
  brand: food.brand,
  source: food.source,
  basis: food.basis,
  kcal: food.kcal,
  protein_g: food.protein_g,
  fat_g: food.fat_g,
  carbs_g: food.carbs_g,
  fibre_g: food.fibre_g,
  portions:
    portions === null
      ? null
      : portions.map((portion) =>
          portionView(
            portion,
            isOurEstimate({ ...food, food_group: food.food_group ?? null }, portion, portions),
          ),
        ),
});

// A live Open Food Facts candidate. It is not a food yet, so it has no id and no portions: `off_code` is
// what `get_food` takes to store it and answer it as a food. Its default portion is left out on purpose,
// because the stored food carries the portions the model logs with.
export const liveView = (candidate: OffCandidate) => ({
  off_code: candidate.code,
  name: candidate.name,
  brand: candidate.brand,
  basis: candidate.basis,
  kcal: candidate.kcal,
  protein_g: candidate.protein_g,
  fat_g: candidate.fat_g,
  carbs_g: candidate.carbs_g,
  fibre_g: candidate.fibre_g,
});
