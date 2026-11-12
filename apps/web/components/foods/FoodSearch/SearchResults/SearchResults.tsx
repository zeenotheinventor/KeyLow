"use client";

import { MIN_SEARCH_LENGTH, useFoodSearch } from "@keylow/api-client";
import {
  SEARCH_EMPTY,
  SEARCH_FAILED_WEB,
  SEARCH_STATUS,
  VALUES_PER_100_G_NOTE,
} from "@keylow/core/copy";
import {
  FOOD_SEARCH_FETCH_LIMIT,
  FOOD_SEARCH_GROUP_LIMITS,
  groupFoodSearchResults,
} from "@keylow/core/search";
import { Plus, SearchX } from "lucide-react";
import { useState } from "react";

import { LocalFoodList } from "../LocalFoodList";
import { OffCandidateList } from "../OffCandidateList";
import { OpenFoodFactsNotice } from "../OpenFoodFactsNotice";

import type { Expansion, SearchResultsProps } from "./types";
import type { FoodSearchGroupKey, FoodSearchGroupLimits } from "@keylow/core/search";

import { InlineStatus } from "@/components/foods/InlineStatus";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

// The browse search shows its live rows per 100 g, as the phone's does, and asks for as many matches.
const SEARCH_OPTIONS = { limit: FOOD_SEARCH_FETCH_LIMIT };

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
 * What the food search found for the text typed so far. The search hook waits for the typing to
 * pause and says so with `isDebouncing`, which counts as searching, so "No foods found" is only
 * ever said about a search that has come back empty.
 */
export function SearchResults({ query }: SearchResultsProps) {
  const trimmedQuery = query.trim();
  const { local, off, isLoadingLocal, isLoadingOff, isDebouncing, offError, localError } =
    useFoodSearch(trimmedQuery, SEARCH_OPTIONS);
  const [expansion, setExpansion] = useState<Expansion>({ query: "", groups: [] });

  if (trimmedQuery.length < MIN_SEARCH_LENGTH) {
    return null;
  }

  if (localError !== null) {
    return (
      <ErrorState size="section" title={SEARCH_FAILED_WEB.title} body={SEARCH_FAILED_WEB.body} />
    );
  }

  const isSearching = isDebouncing || isLoadingLocal;
  const hasRows = local.length > 0 || off.length > 0;
  const expanded = expansion.query === trimmedQuery ? expansion.groups : [];
  const groups = groupFoodSearchResults(local, { limit: limitsFor(expanded, local.length) });

  return (
    <>
      {isSearching && <InlineStatus>{SEARCH_STATUS.searchingYourFoods}</InlineStatus>}
      {isSearching && !hasRows && <Skeleton variant="rows" label="Loading your foods" />}
      {hasRows && <p className="-mb-2 text-caption text-text-muted">{VALUES_PER_100_G_NOTE}</p>}
      {hasRows && (
        <div
          role="group"
          aria-label="Search results"
          aria-busy={isSearching || undefined}
          className={cn("flex flex-col gap-4", isSearching && "opacity-50")}
        >
          <LocalFoodList
            groups={groups}
            query={trimmedQuery}
            onSeeMore={(key) => {
              setExpansion({ query: trimmedQuery, groups: [...expanded, key] });
            }}
          />
          {off.length > 0 && <OffCandidateList candidates={off} query={trimmedQuery} />}
        </div>
      )}
      {isLoadingOff && <InlineStatus>{SEARCH_STATUS.searchingOpenFoodFacts}</InlineStatus>}
      {offError !== null && <OpenFoodFactsNotice error={offError} />}
      {!isSearching && !isLoadingOff && !hasRows && (
        <EmptyState
          icon={SearchX}
          title={SEARCH_EMPTY.title}
          body={SEARCH_EMPTY.body}
          action={{ label: SEARCH_EMPTY.action, icon: Plus, href: "/foods/new" }}
        />
      )}
    </>
  );
}
