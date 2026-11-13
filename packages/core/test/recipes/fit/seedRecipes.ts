import type { FitIngredient } from "../../../src/recipes";

// Per 100 g values of the CoFID foods the eval user's recipes use (packages/db/data/cofid/subset.txt),
// and the two recipes of tools/assistant-evals/fixtures/diary.ts. Everything here is synthetic.
const per = (kcal: number, protein_g: number, fat_g: number, carbs_g: number, fibre_g: number) => ({
  kcal,
  protein_g,
  fat_g,
  carbs_g,
  fibre_g,
});

const oats = per(381, 10.9, 8.1, 70.7, 7.8);
const milk = per(63, 3.4, 3.6, 4.6, 0);
const banana = per(81, 1.2, 0.1, 20.3, 1.4);
const chicken = per(148, 32, 2.2, 0, 0);
const rice = per(131, 2.8, 0.4, 31.1, 0.5);
const broccoli = per(28, 3.3, 0.5, 2.8, 2.8);
const oil = per(899, 0, 99.9, 0, 0);

const ingredient = (
  foodId: string,
  per100: FitIngredient["per100"],
  grams: number,
): FitIngredient => ({ foodId, per100, grams, locked: false });

export const PORRIDGE_BOWL = {
  servings: 1,
  ingredients: [
    ingredient("oats", oats, 50),
    ingredient("milk", milk, 200),
    ingredient("banana", banana, 90),
  ],
};

export const CHICKEN_AND_RICE = {
  servings: 2,
  ingredients: [
    ingredient("chicken", chicken, 260),
    ingredient("rice", rice, 360),
    ingredient("broccoli", broccoli, 160),
    ingredient("oil", oil, 15),
  ],
};
