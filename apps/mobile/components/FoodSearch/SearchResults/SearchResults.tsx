import { MIN_SEARCH_LENGTH, useFoodSearch } from "@keylow/api-client";
import {
  SEARCH_EMPTY,
  SEARCH_FAILED_MOBILE,
  SEARCH_IDLE,
  SEARCH_STATUS,
  VALUES_PER_100_G_NOTE,
} from "@keylow/core/copy";
import { FOOD_SEARCH_GROUP_LIMITS, groupFoodSearchResults } from "@keylow/core/search";
import { useState } from "react";
import { View } from "react-native";

import { EmptyState, ErrorState, Skeleton, Text } from "../../ui";
import { LocalFoodGroups } from "../LocalFoodGroups";
import { OpenFoodFactsGroup } from "../OpenFoodFactsGroup";
import { OpenFoodFactsNotice } from "../OpenFoodFactsNotice";
import { SearchStatus } from "../SearchStatus";

import type { Expansion, SearchResultsProps } from "./types";
import type { FoodSearchGroupKey, FoodSearchGroupLimits } from "@keylow/core/search";

// A group the user has opened shows every row the search returned.
function limitsFor(
  expanded: readonly FoodSearchGroupKey[],
  rowCount: number,
): FoodSearchGroupLimits {
  return {
    yours: expanded.includes("yours") ? rowCount : FOOD_SEARCH_GROUP_LIMITS.yours,
    common: expanded.includes("common") ? rowCount : FOOD_SEARCH_GROUP_LIMITS.common,
    branded: expanded.includes("branded") ? rowCount : FOOD_SEARCH_GROUP_LIMITS.branded,
  };
}

/**
 * What the food search found for the text typed so far, drawn as the boards draw each state. The
 * search hook waits for the typing to pause and says so with `isDebouncing`, which counts as
 * searching, so "No foods found" is only ever said about a search that has come back empty. A failed
 * or rate limited Open Food Facts search never takes the loaded local results away.
 */
export function SearchResults({
  query,
  onOpenFood,
  onCreateFood,
  idleContent,
  logRows,
}: SearchResultsProps) {
  const trimmedQuery = query.trim();
  const { local, off, isLoadingLocal, isLoadingOff, isDebouncing, offError, localError } =
    useFoodSearch(trimmedQuery);
  const [expansion, setExpansion] = useState<Expansion>({ query: "", groups: [] });

  if (trimmedQuery.length < MIN_SEARCH_LENGTH) {
    if (idleContent !== undefined) {
      return idleContent;
    }
    return <EmptyState body={SEARCH_IDLE.body} icon="Search" title={SEARCH_IDLE.title} />;
  }

  if (localError !== null) {
    return <ErrorState body={SEARCH_FAILED_MOBILE.body} title={SEARCH_FAILED_MOBILE.title} />;
  }

  const isSearching = isDebouncing || isLoadingLocal;
  const hasRows = local.length > 0 || off.length > 0;
  const expanded = expansion.query === trimmedQuery ? expansion.groups : [];
  const groups = groupFoodSearchResults(local, { limit: limitsFor(expanded, local.length) });

  return (
    <>
      {isSearching && <SearchStatus label={SEARCH_STATUS.searchingYourFoods} />}
      {isSearching && !hasRows && <Skeleton variant="group" />}
      {hasRows && logRows === undefined && (
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
            logRows={logRows}
            query={trimmedQuery}
            onOpenFood={onOpenFood}
            onSeeMore={(key) => {
              setExpansion({ query: trimmedQuery, groups: [...expanded, key] });
            }}
          />
          {off.length > 0 && (
            <>
              {/* The live Open Food Facts rows stay per 100 g, so in the log search, where the rows above show
                  servings, the note stands above them. */}
              {logRows !== undefined && (
                <Text className="-mb-2" tone="muted" variant="caption">
                  {VALUES_PER_100_G_NOTE}
                </Text>
              )}
              <OpenFoodFactsGroup candidates={off} query={trimmedQuery} onOpenFood={onOpenFood} />
            </>
          )}
        </View>
      )}
      {isLoadingOff && <SearchStatus label={SEARCH_STATUS.searchingOpenFoodFacts} />}
      {offError !== null && <OpenFoodFactsNotice error={offError} />}
      {!isSearching && !isLoadingOff && !hasRows && (
        <EmptyState
          action={{ label: SEARCH_EMPTY.action, icon: "Plus", onPress: onCreateFood }}
          body={SEARCH_EMPTY.body}
          icon="SearchX"
          title={SEARCH_EMPTY.title}
        />
      )}
    </>
  );
}
