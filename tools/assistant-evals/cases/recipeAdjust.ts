// The recipeAdjust set (KEY-1037, M9 plan section 8): "make this recipe 30 g higher in protein" on the recipes of the kitchen
// world, through the real stack with `ASSISTANT_KITCHEN=1` on the served functions. It is opt in (`--set recipeAdjust`) at 90 %.
//
// "Eval chicken and rice" reaches +30 g protein by scaling its own amounts (the fitter says so in `fixtures/kitchenFacts.ts`),
// so that case makes no Opus call and writes no `recipe_generate` row. "Eval porridge bowl" and "Eval yogurt and apple bowl"
// cannot reach it by scaling, so they either come back with an adjustment that core verifies (one Opus call may add foods of the
// person's own) or with an honest refusal, and both are accepted. In every case the recipe rows are read before and after, and
// none may differ, because an adjustment is a draft and the original is never changed. `adjust_recipe` has no input to lock an
// ingredient, so the plan's "a locked ingredient kept" case cannot be asked of it, and the set has none.
import { anyOfRoutes } from "./entryGraders.ts";
import {
  generationRows,
  generationRowsAtMost,
  fitFlagIsTrue,
  lastTurnComplete,
  modelToldTheDrawnFigures,
  noDraft,
  oneDraft,
  recipeBookGuard,
  toolNotCalled,
} from "./kitchenGraders.ts";
import {
  adjustCalledOn,
  adjustedNumbersEqualCore,
  asksFor,
  draftIsOfTheRecipe,
  everyAdjustCallRefused,
  honestRefusal,
  linesAreFrozenFromTheRecipe,
  reachesTheTarget,
} from "./recipeAdjustGraders.ts";
import { kitchenWorldHolder } from "../src/kitchenWorld.ts";

import type { EvalCase, Grader } from "../src/case.ts";
import type { KitchenWorld } from "../src/kitchenWorld.ts";
import type { FitNutrient } from "@keylow/core/recipes";

const CHICKEN_AND_RICE = "Eval chicken and rice";
const PORRIDGE = "Eval porridge bowl";
const YOGURT_BOWL = "Eval yogurt and apple bowl";
const SALMON_BOWL = "Eval salmon and rice bowl";

type Change = Readonly<{
  id: string;
  recipe: string;
  message: string;
  nutrient: FitNutrient;
  /** What the person's words come to for the nutrient, from the recipe's own figure. */
  wanted: (before: number) => number;
  /** How far the call's target may be from that, for a value the model rounds (0.67 for a third). */
  allowance: number;
  /** True when scaling reaches it, so no Opus call is made and a refusal is not a good answer. */
  reachableByScaling: boolean;
  mustPass?: true;
}>;

const CHANGES: readonly Change[] = [
  {
    id: "recipe-adjust-protein-by-scaling",
    recipe: CHICKEN_AND_RICE,
    message: "Make my Eval chicken and rice recipe 30 g higher in protein",
    nutrient: "protein_g",
    wanted: (before) => before + 30,
    allowance: 0.5,
    reachableByScaling: true,
    mustPass: true,
  },
  {
    id: "recipe-adjust-protein-porridge",
    recipe: PORRIDGE,
    message: "Make my Eval porridge bowl recipe 30 g higher in protein",
    nutrient: "protein_g",
    wanted: (before) => before + 30,
    allowance: 0.5,
    reachableByScaling: false,
    mustPass: true,
  },
  {
    id: "recipe-adjust-a-third-fewer-carbs",
    recipe: CHICKEN_AND_RICE,
    message: "Make my Eval chicken and rice recipe a third lower in carbs",
    nutrient: "carbs_g",
    wanted: (before) => (before * 2) / 3,
    allowance: 1.5,
    reachableByScaling: true,
  },
  {
    id: "recipe-adjust-fewer-calories",
    recipe: SALMON_BOWL,
    message: "Make my Eval salmon and rice bowl recipe lower in calories by 150 kcal",
    nutrient: "kcal",
    wanted: (before) => before - 150,
    allowance: 2,
    reachableByScaling: true,
  },
  {
    id: "recipe-adjust-protein-yogurt-bowl",
    recipe: YOGURT_BOWL,
    message: "Make my Eval yogurt and apple bowl recipe 20 g higher in protein",
    nutrient: "protein_g",
    wanted: (before) => before + 20,
    allowance: 0.5,
    reachableByScaling: false,
  },
];

export function createRecipeAdjustCases(world: () => KitchenWorld): EvalCase[] {
  const changed = CHANGES.map((change): EvalCase => {
    const { prepare, unchanged } = recipeBookGuard({
      ensureWorld: () => world().ensureWorld(),
      recipesFingerprint: () => world().recipesFingerprint(),
    });
    const recipeId = () => world().recipeIdOf(change.recipe);
    const adjusted: Grader[] = [
      oneDraft("adjustment"),
      draftIsOfTheRecipe(change.recipe, recipeId),
      reachesTheTarget(change.recipe),
      adjustedNumbersEqualCore(),
      linesAreFrozenFromTheRecipe(change.recipe),
      modelToldTheDrawnFigures("adjust_recipe", "adjustment"),
      fitFlagIsTrue("adjustment"),
    ];
    // Scaling reaches the target, so there is no Opus call. When it does not, an Opus call may add foods and the draft is
    // then verified like any other, or the tool refuses and the refusal is held to core's own judgement.
    const outcome: Grader[] = change.reachableByScaling
      ? [...adjusted, generationRows(0)]
      : [
          anyOfRoutes([
            [...adjusted, generationRowsAtMost(1)],
            [noDraft(), honestRefusal(change.recipe)],
          ]),
        ];
    return {
      id: change.id,
      set: "recipeAdjust",
      prepare,
      messages: [change.message],
      expect: [
        lastTurnComplete(),
        adjustCalledOn(recipeId, change.nutrient),
        asksFor(change.recipe, change.nutrient, change.wanted, change.allowance),
        ...outcome,
        toolNotCalled("update_recipe"),
        toolNotCalled("create_recipe"),
        unchanged,
      ],
      ...(change.mustPass === true ? { mustPass: true as const } : {}),
    };
  });

  // A recipe the person does not have. Nothing may be drafted for it, and nothing may be saved.
  const missing = recipeBookGuard({
    ensureWorld: () => world().ensureWorld(),
    recipesFingerprint: () => world().recipesFingerprint(),
  });
  const notFound: EvalCase = {
    id: "recipe-adjust-no-such-recipe",
    set: "recipeAdjust",
    prepare: missing.prepare,
    messages: ["Make my Eval risotto recipe 30 g higher in protein"],
    expect: [
      lastTurnComplete(),
      noDraft(),
      everyAdjustCallRefused(),
      toolNotCalled("update_recipe"),
      toolNotCalled("create_recipe"),
      missing.unchanged,
    ],
  };
  return [...changed, notFound];
}

export const recipeAdjustCases: readonly EvalCase[] = createRecipeAdjustCases(() =>
  kitchenWorldHolder.current(),
);
