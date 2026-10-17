"use client";

import { keys, useRecipe } from "@keylow/api-client";
import {
  GENERIC_ERROR,
  RECIPE_EDITOR,
  RECIPE_NOT_FOUND,
  RETRY_LABEL,
  TAB_TITLES,
} from "@keylow/core/copy";
import { isRecipeId } from "@keylow/core/recipes";
import { useQueryClient } from "@tanstack/react-query";
import { SearchX } from "lucide-react";

import { RecipeEditor } from "../RecipeEditor";
import { RecipeEditorFrame } from "../RecipeEditorFrame";

import type { RecipeEditorScreenProps } from "./types";

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

function BackToRecipes() {
  return <BackToFoodsLink tone="accent" label={TAB_TITLES.recipes} href={recipesPath()} />;
}

function LoadingRecipe() {
  return (
    <RecipeEditorFrame backLink={<BackToRecipes />}>
      <Skeleton label={RECIPE_EDITOR.loadingLabel} className="flex flex-col gap-5">
        <SkeletonBone className="-mt-4 mb-1 h-8 w-[280px] max-w-[70%]" />
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,720px)_minmax(0,340px)] lg:items-start lg:gap-x-6">
          <div className="flex flex-col gap-5">
            <Card className="flex flex-col gap-3">
              <SkeletonBone className="h-[14px] w-20" />
              <SkeletonBone className="h-11" />
              <SkeletonBone className="h-11 w-[60%]" />
            </Card>
            <Card padding="none">
              {["w-[50%]", "w-[38%]", "w-[56%]"].map((titleWidth) => (
                <div
                  key={titleWidth}
                  className="box-border flex min-h-[60px] flex-col justify-center gap-2 border-t border-border px-4 py-2 first:border-t-0"
                >
                  <SkeletonBone className={`h-[14px] ${titleWidth}`} />
                  <SkeletonBone className="h-[10px] w-[30%]" />
                </div>
              ))}
            </Card>
          </div>
          <Card className="flex flex-col gap-3 max-lg:hidden">
            <SkeletonBone className="h-10 w-28" />
            <SkeletonBone className="h-[38px] rounded-medium" />
            <SkeletonBone className="h-[38px] rounded-medium" />
            <SkeletonBone className="h-[38px] rounded-medium" />
          </Card>
        </div>
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
 * `/recipes/<id>/edit`: reads the recipe and opens the editor on it. A direct link or a reload lands here, so
 * the page has its own loading, failed and not found states. The text of a failure is never shown.
 */
export function RecipeEditorScreen({ id }: RecipeEditorScreenProps) {
  // A link that cannot be a recipe is not asked about, as the foods pages do.
  const isKnownToBeMissing = !isRecipeId(id);
  const state = useRecipe(isKnownToBeMissing ? undefined : id);
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
      return <RecipeEditor key={state.recipe.id} existing={state.recipe} />;
  }
}
