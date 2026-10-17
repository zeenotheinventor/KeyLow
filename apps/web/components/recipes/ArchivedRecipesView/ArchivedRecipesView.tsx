"use client";

import {
  ARCHIVED_RECIPES,
  RECIPES_LOADING_LABEL,
  RECIPES_LOAD_FAILED,
  RETRY_LABEL,
  TAB_TITLES,
  describeRestoreRecipe,
} from "@keylow/core/copy";
import { Archive } from "lucide-react";
import { useRef } from "react";

import { RecipeLibrarySkeleton } from "../RecipeLibrarySkeleton";
import { RecipeRows } from "../RecipeRows";
import { RECIPE_STATE_CLASSES } from "../stateClasses";

import type { ArchivedRecipesViewProps } from "./types";

import { BackToFoodsLink } from "@/components/foods/FoodDetail";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { recipesPath } from "@/lib/recipeRoutes";

/**
 * The archived recipes page, drawn from what it is given: the title, a way back to the library and the
 * note, then the recipes the user has put away, each with Restore, or "Nothing archived", or its loading
 * and failed states. Archived rows are not links, as a recipe is restored before it is opened. The page
 * that reads the recipes is `ArchivedRecipes`.
 */
export function ArchivedRecipesView(props: ArchivedRecipesViewProps) {
  const backLink = useRef<HTMLAnchorElement>(null);

  return (
    <div className="mx-auto flex w-full max-w-[1132px] flex-col gap-5">
      <div className="flex flex-col gap-1">
        <BackToFoodsLink
          ref={backLink}
          tone="accent"
          label={TAB_TITLES.recipes}
          href={recipesPath()}
        />
        <h1 className="text-h1">{ARCHIVED_RECIPES.title}</h1>
      </div>
      <p className="text-body text-text-secondary">{ARCHIVED_RECIPES.note}</p>

      {props.status === "loading" && <RecipeLibrarySkeleton label={RECIPES_LOADING_LABEL} />}

      {props.status === "error" && (
        <ErrorState
          title={RECIPES_LOAD_FAILED.title}
          body={RECIPES_LOAD_FAILED.body}
          retryLabel={RETRY_LABEL}
          onRetry={props.onRetry}
          className={RECIPE_STATE_CLASSES}
        />
      )}

      {props.status === "ready" && props.recipes.length === 0 && (
        <EmptyState
          icon={Archive}
          title={ARCHIVED_RECIPES.empty}
          className={RECIPE_STATE_CLASSES}
        />
      )}

      {props.status === "ready" && props.recipes.length > 0 && (
        <RecipeRows
          recipes={props.recipes}
          opensRecipe={false}
          renderButtons={(recipe, row) => (
            <Button
              ref={row.removeButtonRef}
              variant="secondary"
              size="sm"
              // In the narrow list the button sits 12 px in from the card's edge.
              className={row.layout === "card" ? "mr-3" : undefined}
              aria-label={describeRestoreRecipe(recipe.name)}
              onClick={() => {
                // The row is about to go, so focus is given to its neighbour first, or to the way back
                // when it was the last one, rather than left to fall to the page.
                if (!row.moveFocusToNextRow()) {
                  backLink.current?.focus();
                }
                props.onRestore(recipe);
              }}
            >
              {ARCHIVED_RECIPES.restore}
            </Button>
          )}
        />
      )}
    </div>
  );
}
