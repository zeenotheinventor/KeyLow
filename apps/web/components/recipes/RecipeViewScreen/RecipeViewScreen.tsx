"use client";

import { keys, useRecipe, useRecipes } from "@keylow/api-client";
import {
  GENERIC_ERROR,
  RECIPE_EDITOR,
  RECIPE_NOT_FOUND,
  RETRY_LABEL,
  RECIPES_LIBRARY,
} from "@keylow/core/copy";
import { isRecipeId } from "@keylow/core/recipes";
import { useQueryClient } from "@tanstack/react-query";
import { SearchX } from "lucide-react";

import { RecipeEditorFrame } from "../RecipeEditorFrame";
import { RecipeEditorLayout } from "../RecipeEditorLayout";
import { RecipeView } from "../RecipeView";

import type { RecipeViewScreenProps } from "./types";

import { BackToFoodsLink } from "@/components/foods/FoodDetail";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";
import { recipesPath } from "@/lib/recipeRoutes";

// The boards centre the state in a 480 px block with no card around it, and add 120 px of padding below
// that block, so the state sits a little above the middle of the space.
const STATE_CLASSES =
  "box-content min-h-[480px] justify-center border-0 bg-transparent px-6 py-0 pb-[120px]";

const INGREDIENT_TITLE_WIDTHS = ["w-[50%]", "w-[38%]", "w-[56%]"];

function BackToRecipes() {
  return <BackToFoodsLink tone="accent" label={RECIPES_LIBRARY.title} href={recipesPath()} />;
}

function LoadingRecipe() {
  return (
    <RecipeEditorFrame backLink={<BackToRecipes />}>
      <Skeleton label={RECIPE_EDITOR.loadingLabel} className="flex flex-col gap-5">
        <div className="-mt-4 flex flex-col items-start">
          <SkeletonBone className="mt-1 h-8 w-[280px] max-w-[70%]" />
          <SkeletonBone className="mt-2 h-8 w-[72px] rounded-medium" />
        </div>
        <RecipeEditorLayout
          summary={
            <div className="flex flex-col gap-5 lg:gap-3">
              <Card className="flex flex-col gap-3">
                <SkeletonBone className="h-10 w-28" />
                <SkeletonBone className="h-[38px] rounded-medium" />
                <SkeletonBone className="h-[38px] rounded-medium" />
                <SkeletonBone className="h-[38px] rounded-medium" />
              </Card>
              <Card padding="none" className="flex flex-col gap-3 px-4 py-3">
                <span className="flex items-center justify-between">
                  <SkeletonBone className="h-[14px] w-[72px]" />
                  <SkeletonBone className="h-11 w-44 rounded-medium" />
                </span>
                <SkeletonBone className="h-3 w-40" />
              </Card>
            </div>
          }
        >
          <Card padding="none">
            <div className="p-4">
              <SkeletonBone className="h-[14px] w-[120px]" />
            </div>
            {INGREDIENT_TITLE_WIDTHS.map((titleWidth) => (
              <div
                key={titleWidth}
                className="box-border flex min-h-[60px] flex-col justify-center gap-2 border-t border-border px-4 py-2"
              >
                <SkeletonBone className={`h-[14px] ${titleWidth}`} />
                <SkeletonBone className="h-[10px] w-[20%]" />
              </div>
            ))}
          </Card>
        </RecipeEditorLayout>
      </Skeleton>
    </RecipeEditorFrame>
  );
}

function RecipeNotFound() {
  return (
    <RecipeEditorFrame backLink={<BackToRecipes />}>
      <EmptyState
        icon={SearchX}
        title={RECIPE_NOT_FOUND.title}
        body={RECIPE_NOT_FOUND.body}
        className={STATE_CLASSES}
      />
    </RecipeEditorFrame>
  );
}

/**
 * `/recipes/<id>`: reads the recipe and opens the view on it. A direct link or a reload lands here, so the
 * page has its own loading, failed and not found states. The text of a failure is never shown.
 */
export function RecipeViewScreen({ id }: RecipeViewScreenProps) {
  // A link that cannot be a recipe is not asked about, as the editor does not ask.
  const isKnownToBeMissing = !isRecipeId(id);
  const state = useRecipe(isKnownToBeMissing ? undefined : id);
  // The view's Duplicate names a copy from the library, so the library is read alongside the recipe and not
  // after it. The view reads the same list, so this is one request.
  useRecipes({ archived: true, enabled: !isKnownToBeMissing });
  const queryClient = useQueryClient();

  if (isKnownToBeMissing) {
    return <RecipeNotFound />;
  }

  switch (state.status) {
    case "loading":
      return <LoadingRecipe />;
    case "error":
      return (
        <RecipeEditorFrame backLink={<BackToRecipes />}>
          <ErrorState
            title={GENERIC_ERROR}
            retryLabel={RETRY_LABEL}
            onRetry={() => {
              void queryClient.invalidateQueries({ queryKey: keys.recipes.detail(id) });
            }}
            className={STATE_CLASSES}
          />
        </RecipeEditorFrame>
      );
    case "notFound":
      return <RecipeNotFound />;
    case "ready":
      // Keyed by the recipe, so another recipe starts at its own servings.
      return <RecipeView key={state.recipe.id} recipe={state.recipe} />;
  }
}
