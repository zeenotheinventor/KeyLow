import { keys, useArchiveRecipe, useDuplicateRecipe } from "@keylow/api-client";
import { GENERIC_ERROR, RECIPE_TOASTS, UNDO_LABEL, describeDuplicateName } from "@keylow/core/copy";
import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { useToast } from "../ui";

import type { RecipeActions } from "./types";
import type { RecipeSummary } from "@keylow/api-client";

// The library reads archived recipes with the live ones in one request, so every recipe is in this list.
const libraryKey = keys.recipes.list(true);

/**
 * Duplicate, archive and restore for a recipe, each with its toast, shared by the library, the archived
 * screen and the recipe view's menu. The library list in the cache changes as the write is asked for, so
 * a row leaves (or returns) at once. When the write fails the flag goes back and a toast says so in one
 * fixed sentence, never the failure itself, which can quote a recipe. The toast of a write that worked
 * waits for the save. A copy is named from the names in the library read, archived ones included, so one
 * the user has put away is never reused. The name of a copy is held from the moment it is asked for, and
 * the copy joins the cached list when it is saved, so a second Duplicate before the library has been read
 * again is "(copy 2)" and not a second "(copy)".
 */
export function useRecipeActions(): RecipeActions {
  const toast = useToast();
  const queryClient = useQueryClient();
  const archiveRecipe = useArchiveRecipe();
  const duplicateRecipe = useDuplicateRecipe();
  const namesBeingSaved = useRef(new Set<string>());

  const showFailure = () => {
    toast.show({ message: GENERIC_ERROR, icon: "CircleAlert", tone: "danger" });
  };

  const setLibraryFlag = (id: string, isArchived: boolean) => {
    queryClient.setQueryData<RecipeSummary[]>(libraryKey, (recipes) =>
      recipes?.map((recipe) =>
        recipe.id === id ? { ...recipe, is_archived: isArchived } : recipe,
      ),
    );
  };

  // The copy goes in straight after its original until the library is read again, which puts it in name order.
  const addToLibrary = (originalId: string, copy: RecipeSummary) => {
    queryClient.setQueryData<RecipeSummary[]>(libraryKey, (recipes) => {
      // The library may have been read again already, and then the copy is in it.
      if (recipes === undefined || recipes.some((recipe) => recipe.id === copy.id)) {
        return recipes;
      }
      const at = recipes.findIndex((recipe) => recipe.id === originalId) + 1;
      return [...recipes.slice(0, at), copy, ...recipes.slice(at)];
    });
  };

  // Resolves to whether the write worked. A fetch under way is stopped first, so it cannot bring the old flag back.
  async function setArchived(id: string, isArchived: boolean): Promise<boolean> {
    await queryClient.cancelQueries({ queryKey: keys.recipes.all });
    setLibraryFlag(id, isArchived);
    try {
      await archiveRecipe.mutateAsync({ id, archived: isArchived });
      return true;
    } catch {
      setLibraryFlag(id, !isArchived);
      showFailure();
      return false;
    }
  }

  const undoArchive = (id: string) => {
    void setArchived(id, false);
  };

  return {
    duplicate: (recipe) => {
      const names = (queryClient.getQueryData<RecipeSummary[]>(libraryKey) ?? []).map(
        ({ name }) => name,
      );
      const name = describeDuplicateName(recipe.name, [...names, ...namesBeingSaved.current]);
      namesBeingSaved.current.add(name);
      duplicateRecipe
        .mutateAsync({ recipeId: recipe.id, name })
        .then((copy) => {
          addToLibrary(recipe.id, copy);
          toast.show({
            message: RECIPE_TOASTS.duplicated,
            icon: "Copy",
            actionLabel: UNDO_LABEL,
            // The ADR gives recipes no delete, so putting a copy away is archiving it.
            onAction: () => {
              void setArchived(copy.id, true);
            },
          });
        }, showFailure)
        .finally(() => {
          namesBeingSaved.current.delete(name);
        });
    },
    archive: (recipe) => {
      void setArchived(recipe.id, true).then((worked) => {
        if (worked) {
          toast.show({
            message: RECIPE_TOASTS.archived,
            icon: "Archive",
            actionLabel: UNDO_LABEL,
            onAction: () => {
              undoArchive(recipe.id);
            },
          });
        }
      });
    },
    restore: (recipe) => {
      void setArchived(recipe.id, false).then((worked) => {
        if (worked) {
          toast.show({ message: RECIPE_TOASTS.restored, icon: "Check", tone: "success" });
        }
      });
    },
  };
}
