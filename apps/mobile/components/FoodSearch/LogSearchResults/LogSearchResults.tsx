import { useRecipeSearch } from "@keylow/api-client";
import { OFFLINE_BANNER, PLATE, describeAddedToPlate } from "@keylow/core/copy";
import { canLogRecipe } from "@keylow/core/diary";
import { plateItemOfHit, plateItemOfRecent, plateItemOfRecipe } from "@keylow/core/plate";
import { useEffect, useRef } from "react";
import { AccessibilityInfo } from "react-native";

import { useIsOnline } from "../../../lib/connectivity";
import { usePlate } from "../../../lib/plate";
import { useReadsEnabled } from "../../../lib/useReadsEnabled";
import { Banner } from "../../ui";
import { LogIdle } from "../LogIdle";
import { SearchResults } from "../SearchResults";

import type { LogSearchResultsProps } from "./types";

/**
 * The search sheet's results while food is being logged: the idle state is Quick add and Recent, and each
 * row shows a serving with a plus that puts it on the plate, and the user's recipes that match come first (a
 * recipe row opens the amount step, and its plus puts one serving on the plate). The plus builds the plate item
 * from the row's own data, so it loads nothing, writes nothing and works offline. Offline, a banner says the
 * plate can still be filled. Only here are the plate and the recipe search needed, so the plain search never
 * asks for them.
 */
export function LogSearchResults({
  query,
  logging,
  onOpenFood,
  onCreateFood,
  onPlateAdded,
}: LogSearchResultsProps) {
  const { add, addCount, isLogging } = usePlate();
  const isOnline = useIsOnline();
  const recipeSearch = useRecipeSearch(query, { enabled: useReadsEnabled() });

  // Whatever puts a food on the plate, this search or the portion picker over it, sends the person back to the
  // idle list with an empty field. The count the screen started with is not an add.
  const seenAddCount = useRef(addCount);
  useEffect(() => {
    if (addCount !== seenAddCount.current) {
      seenAddCount.current = addCount;
      onPlateAdded();
    }
  }, [addCount, onPlateAdded]);

  // No toast is drawn after a plus, so a screen reader is told instead.
  function addToPlate(name: string, build: Parameters<typeof add>[0]) {
    add(build);
    AccessibilityInfo.announceForAccessibility(describeAddedToPlate(name));
  }

  return (
    <>
      {isOnline ? null : (
        <Banner body={PLATE.offlineBody} title={OFFLINE_BANNER.title} variant="offline" />
      )}
      <SearchResults
        idleContent={
          <LogIdle
            addDisabled={isLogging}
            onAdd={(recent) => {
              addToPlate(recent.snapshot.name, (key) => plateItemOfRecent(key, recent));
            }}
            onQuickAdd={logging.onQuickAdd}
            onOpen={(recent) => {
              logging.onOpenRecent(recent.foodId);
            }}
          />
        }
        logRows={{
          addDisabled: isLogging,
          onAdd: (hit) => {
            addToPlate(hit.name, (key) => plateItemOfHit(key, hit));
          },
          recipes: {
            // A failed recipe search leaves the recipes out and the foods as they are, as a failed Open Food
            // Facts search leaves the local results: a feature added to the search must not take food logging away.
            rows: recipeSearch.error === null ? recipeSearch.recipes.filter(canLogRecipe) : [],
            isSearching: recipeSearch.isDebouncing || recipeSearch.isLoading,
            onAdd: (recipe) => {
              addToPlate(recipe.name, (key) => plateItemOfRecipe({ key, recipe }));
            },
            onOpen: (recipe) => {
              logging.onOpenRecipe(recipe.id);
            },
          },
        }}
        query={query}
        onCreateFood={onCreateFood}
        onOpenFood={onOpenFood}
      />
    </>
  );
}
