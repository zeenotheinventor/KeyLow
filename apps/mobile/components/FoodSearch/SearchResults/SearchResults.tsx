import { MIN_SEARCH_LENGTH, useFoodSearch } from "@keylow/api-client";
import {
  SEARCH_EMPTY,
  SEARCH_FAILED_MOBILE,
  SEARCH_IDLE,
  SEARCH_STATUS,
  VALUES_PER_100_G_NOTE,
  describeLiveGroupNote,
} from "@keylow/core/copy";
import { canBeRecipeIngredient } from "@keylow/core/recipes";
import {
  FOOD_SEARCH_FETCH_LIMIT,
  groupFoodSearchResults,
  liveRowShowsServing,
  revealFoodSearchGroups,
} from "@keylow/core/search";
import { useEffect } from "react";
import { View } from "react-native";

import { EmptyState, ErrorState, Skeleton, Text } from "../../ui";
import { LocalFoodGroups } from "../LocalFoodGroups";
import { OpenFoodFactsGroup } from "../OpenFoodFactsGroup";
import { OpenFoodFactsNotice } from "../OpenFoodFactsNotice";
import { SearchStatus } from "../SearchStatus";

import type { SearchResultsProps } from "./types";

const SEARCH_OPTIONS = { limit: FOOD_SEARCH_FETCH_LIMIT };

/**
 * What the food search found for the text typed so far, drawn as the boards draw each state. The
 * search hook waits for the typing to pause and says so with `isDebouncing`, which counts as
 * searching, so "No foods found" is only ever said about a search that has come back empty. A failed
 * or rate limited Open Food Facts search never takes the loaded local results away.
 */
export function SearchResults({
  query,
  visibleRowCount,
  onMoreRowsChange,
  onOpenFood,
  onCreateFood,
  idleContent,
  logRows,
  choosesAmount = false,
}: SearchResultsProps) {
  const trimmedQuery = query.trim();
  const search = useFoodSearch(trimmedQuery, SEARCH_OPTIONS);
  const { off, isLoadingLocal, isLoadingOff, isDebouncing, offError, localError } = search;
  // Choosing an amount is the ingredient search, which lists only what a recipe can hold.
  const local = choosesAmount ? search.local.filter(canBeRecipeIngredient) : search.local;

  // The recipes of the log search are looked for beside the foods, and count as results and as searching.
  const recipeRows = logRows?.recipes?.rows ?? [];
  const isSearching = isDebouncing || isLoadingLocal || (logRows?.recipes?.isSearching ?? false);
  // Rows are left to reveal only once the answer for a typed query is in, so the list reveals nothing
  // while a skeleton or an idle state stands in for the results.
  const hasMoreRows =
    trimmedQuery.length >= MIN_SEARCH_LENGTH &&
    localError === null &&
    !isSearching &&
    local.length > visibleRowCount;
  useEffect(() => {
    onMoreRowsChange(hasMoreRows);
  }, [hasMoreRows, visibleRowCount, onMoreRowsChange]);

  if (trimmedQuery.length < MIN_SEARCH_LENGTH) {
    if (idleContent !== undefined) {
      return idleContent;
    }
    return <EmptyState body={SEARCH_IDLE.body} icon="Search" title={SEARCH_IDLE.title} />;
  }

  if (localError !== null) {
    return <ErrorState body={SEARCH_FAILED_MOBILE.body} title={SEARCH_FAILED_MOBILE.title} />;
  }

  const hasRows = local.length > 0 || off.length > 0 || recipeRows.length > 0;
  // Rows that show a serving say where the values are per 100 g only for a live Open Food Facts row that
  // cannot show one, which is one from an answer stored before candidates carried their serving.
  const showsServings = logRows !== undefined || choosesAmount;
  const hasPer100Rows = off.some((candidate) => !liveRowShowsServing(candidate));
  // Rows are shown on one running budget in display order, so more rows only ever join at the bottom.
  const groups = revealFoodSearchGroups(
    groupFoodSearchResults(local, { limit: local.length }),
    visibleRowCount,
  );

  return (
    <>
      {isSearching && <SearchStatus label={SEARCH_STATUS.searchingYourFoods} />}
      {isSearching && !hasRows && <Skeleton variant="group" />}
      {hasRows && !showsServings && (
        <Text className="-mb-2" tone="muted" variant="caption">
          {VALUES_PER_100_G_NOTE}
        </Text>
      )}
      {hasRows && (
        // The previous results stay in view at half strength while the next ones load.
        <View
          aria-busy={isSearching || undefined}
          aria-label="Search results"
          className={`gap-4 ${isSearching ? "opacity-50" : ""}`}
          role="group"
        >
          <LocalFoodGroups
            groups={groups}
            choosesAmount={choosesAmount}
            logRows={logRows}
            query={trimmedQuery}
            onOpenFood={onOpenFood}
          />
          {off.length > 0 && (
            <>
              {/* Where the rows show servings, a live row's serving is confirmed when the product is opened, and a
                  live row with no serving to show stays per 100 g, so the note stands above the group. */}
              {showsServings && (
                <Text className="-mb-2" tone="muted" variant="caption">
                  {describeLiveGroupNote(hasPer100Rows)}
                </Text>
              )}
              <OpenFoodFactsGroup
                candidates={off}
                query={trimmedQuery}
                releasesOnOpen={choosesAmount}
                showsServings={showsServings}
                onOpenFood={onOpenFood}
              />
            </>
          )}
        </View>
      )}
      {isLoadingOff && <SearchStatus label={SEARCH_STATUS.searchingOpenFoodFacts} />}
      {offError !== null && <OpenFoodFactsNotice error={offError} />}
      {!isSearching && !isLoadingOff && !hasRows && (
        <EmptyState
          action={
            onCreateFood === undefined
              ? undefined
              : { label: SEARCH_EMPTY.action, icon: "Plus", onPress: onCreateFood }
          }
          body={SEARCH_EMPTY.body}
          icon="SearchX"
          title={SEARCH_EMPTY.title}
        />
      )}
    </>
  );
}
