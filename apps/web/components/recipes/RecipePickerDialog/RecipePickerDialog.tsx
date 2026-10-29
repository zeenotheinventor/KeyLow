import {
  GENERIC_ERROR,
  RECIPES_LIBRARY,
  RECIPES_LOADING_LABEL,
  RETRY_LABEL,
  SHOPPING_LIST,
  SHOPPING_LIST_NO_RECIPES,
} from "@keylow/core/copy";
import { ChefHat, Plus } from "lucide-react";

import type { RecipePickerDialogProps } from "./types";

import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListRow } from "@/components/ui/ListRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { newRecipePath } from "@/lib/recipeRoutes";

/**
 * The list page's "Add a recipe": the live recipes by name, each a row that chooses it. Choosing one
 * hands it to the screen, which opens the add dialog for it, so several recipes are added one after
 * another from the same page. With no recipe yet it offers New recipe.
 */
export function RecipePickerDialog({ open, state, onClose, onChoose }: RecipePickerDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={SHOPPING_LIST.chooseRecipe}>
      {state.status === "loading" && (
        <Skeleton variant="rows" count={3} label={RECIPES_LOADING_LABEL} />
      )}
      {state.status === "error" && (
        <ErrorState
          title={GENERIC_ERROR}
          retryLabel={RETRY_LABEL}
          onRetry={state.onRetry}
          size="section"
          headingLevel={2}
        />
      )}
      {state.status === "ready" && state.recipes.length === 0 && (
        <EmptyState
          icon={ChefHat}
          title={SHOPPING_LIST_NO_RECIPES.title}
          body={SHOPPING_LIST_NO_RECIPES.body}
          headingLevel={2}
          size="section"
          action={{ label: RECIPES_LIBRARY.newRecipe, icon: Plus, href: newRecipePath() }}
        />
      )}
      {state.status === "ready" && state.recipes.length > 0 && (
        <Card asChild padding="none">
          <ul className="divide-y divide-border">
            {state.recipes.map((recipe) => (
              <ListRow
                key={recipe.id}
                title={recipe.name}
                onClick={() => {
                  onChoose(recipe);
                }}
              />
            ))}
          </ul>
        </Card>
      )}
    </Dialog>
  );
}
