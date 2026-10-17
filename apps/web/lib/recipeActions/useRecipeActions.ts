import { keys, useArchiveRecipe, useDuplicateRecipe } from "@keylow/api-client";
import { GENERIC_ERROR, RECIPE_TOASTS, UNDO_LABEL, describeDuplicateName } from "@keylow/core/copy";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, Check, CircleAlert, Copy } from "lucide-react";
import { useRef, useState } from "react";

import type { RecipeActions } from "./types";
import type { RecipeDetail, RecipeSummary } from "@keylow/api-client";

import { useToast } from "@/components/ui/Toast";

// The library reads archived recipes with the live ones in one request, so every recipe is in this list.
const libraryKey = keys.recipes.list(true);

// The write has worked and its toast must still show, so a screen's follow-up that throws is not allowed to
// stop it. The user is left where they were, with the toast.
function runFollowUp(followUp: () => void): void {
  try {
    followUp();
  } catch {
    // Nothing to report: the failure is the screen's own and carries no recipe data worth logging.
  }
}

// The library list holds the lean columns, and a saved copy comes with its ingredients and steps too.
const summaryOf = ({
  id,
  name,
  servings,
  yield_grams,
  is_archived,
  computed,
}: RecipeDetail): RecipeSummary => ({ id, name, servings, yield_grams, is_archived, computed });

/**
 * Duplicate, archive and restore for a recipe, each with its toast, shared by the library, the archived
 * page and the recipe view. The library list in the cache changes as the write is asked for, so a row
 * leaves (or returns) at once. When the write fails the flag goes back and a toast says so in one fixed
 * sentence, never the failure itself, which can quote a recipe. The toast of a write that worked waits
 * for the save. A copy is named from the names in the library read, archived ones included, so one the
 * user has put away is never reused. The name of a copy is held from the moment it is asked for, and the
 * copy joins the cached list when it is saved, so a second Duplicate before the library has been read
 * again, even of another recipe with the same name, is "(copy 2)" and not a second "(copy)". A press that repeats
 * an action still under way on the same recipe, a double click, joins it and does nothing more. A screen
 * that leaves for another when an action has gone through says where in the follow-up it passes: it runs
 * only when the write worked, so a failure leaves the user where they were, and one that throws cannot
 * take the toast with it.
 */
export function useRecipeActions(): RecipeActions {
  const toast = useToast();
  const queryClient = useQueryClient();
  const archiveRecipe = useArchiveRecipe();
  const duplicateRecipe = useDuplicateRecipe();
  // What is under way is also kept in refs, which a second press in the same moment can read at once.
  const duplicatesUnderWay = useRef(new Set<string>());
  const namesBeingSaved = useRef(new Set<string>());
  const archivesUnderWay = useRef(new Set<string>());
  const [duplicatingIds, setDuplicatingIds] = useState<ReadonlySet<string>>(new Set());

  const showFailure = () => {
    toast.show({ message: GENERIC_ERROR, icon: CircleAlert, tone: "danger" });
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

  const markDuplicating = (id: string, isDuplicating: boolean) => {
    if (isDuplicating) {
      duplicatesUnderWay.current.add(id);
    } else {
      duplicatesUnderWay.current.delete(id);
    }
    setDuplicatingIds(new Set(duplicatesUnderWay.current));
  };

  // Resolves to whether the write worked. A fetch under way is stopped first, so it cannot bring the old flag back.
  async function setArchived(id: string, isArchived: boolean): Promise<boolean> {
    const action = `${id}:${isArchived}`;
    if (archivesUnderWay.current.has(action)) {
      return false;
    }
    archivesUnderWay.current.add(action);
    try {
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
    } finally {
      archivesUnderWay.current.delete(action);
    }
  }

  return {
    isDuplicating: (recipeId) => duplicatingIds.has(recipeId),
    duplicate: (recipe, followUp) => {
      if (duplicatesUnderWay.current.has(recipe.id)) {
        return;
      }
      markDuplicating(recipe.id, true);
      const names = (queryClient.getQueryData<RecipeSummary[]>(libraryKey) ?? []).map(
        ({ name }) => name,
      );
      const name = describeDuplicateName(recipe.name, [...names, ...namesBeingSaved.current]);
      namesBeingSaved.current.add(name);
      duplicateRecipe
        .mutateAsync({ recipeId: recipe.id, name })
        .then((saved) => {
          const copy = summaryOf(saved);
          addToLibrary(recipe.id, copy);
          runFollowUp(() => followUp?.onSaved?.(copy));
          toast.show({
            message: RECIPE_TOASTS.duplicated,
            icon: Copy,
            actionLabel: UNDO_LABEL,
            // The ADR gives recipes no delete, so putting a copy away is archiving it.
            onAction: () => {
              void setArchived(copy.id, true).then((worked) => {
                if (worked) {
                  runFollowUp(() => followUp?.onUndone?.(copy));
                }
              });
            },
          });
        }, showFailure)
        .finally(() => {
          namesBeingSaved.current.delete(name);
          markDuplicating(recipe.id, false);
        });
    },
    archive: (recipe, followUp) => {
      void setArchived(recipe.id, true).then((worked) => {
        if (worked) {
          runFollowUp(() => followUp?.onArchived?.());
          toast.show({
            message: RECIPE_TOASTS.archived,
            icon: Archive,
            actionLabel: UNDO_LABEL,
            onAction: () => {
              void setArchived(recipe.id, false);
            },
          });
        }
      });
    },
    restore: (recipe) => {
      void setArchived(recipe.id, false).then((worked) => {
        if (worked) {
          toast.show({ message: RECIPE_TOASTS.restored, icon: Check, tone: "success" });
        }
      });
    },
  };
}
