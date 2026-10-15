"use client";

import { useOwnFoods } from "@keylow/api-client";
import {
  SEARCH_EMPTY,
  SEARCH_FAILED_WEB,
  SEARCH_STATUS,
  VALUES_PER_100_G_NOTE,
  YOUR_FOODS_EMPTY,
} from "@keylow/core/copy";
import { filterOwnFoods, groupFoodSearchResults } from "@keylow/core/search";
import { Plus, SearchX } from "lucide-react";

import { InlineStatus } from "../../InlineStatus";
import { LocalFoodList } from "../LocalFoodList";

import type { OwnFoodResultsProps } from "./types";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useWhenVisible } from "@/lib/useWhenVisible";

const CREATE_A_FOOD_HREF = "/foods/new";

/**
 * The user's own foods, listed before anything is typed. Typing narrows the list here and never
 * reaches for the shared foods or Open Food Facts, as a library search stays in the library. The
 * list loads a page at a time, and the next page loads when the end of the list scrolls into view.
 * Typed words narrow the pages loaded so far, so while none of them match and more pages remain,
 * the list keeps loading one page at a time (mobile does the same) until a food matches or the last
 * page is in, rather than saying nothing was found: the empty end of the list stays in view, so the
 * observer asks again after each page. A page that fails to load stops the paging and offers to try again.
 */
export function OwnFoodResults({ query }: OwnFoodResultsProps) {
  const ownFoods = useOwnFoods();
  const trimmedQuery = query.trim();
  const hasMoreToLoad = ownFoods.hasNextPage;
  // A page that failed to load is not asked for again by itself, or a broken connection would loop. A
  // background refetch that failed has no bearing on the pages still to come.
  const loadMoreRef = useWhenVisible(
    ownFoods.fetchNextPage,
    hasMoreToLoad && !ownFoods.isFetchingNextPage && !ownFoods.isFetchNextPageError,
  );
  // A retry in flight still counts as the failure in TanStack, so the failure is shown only between tries.
  const loadMoreFailed =
    hasMoreToLoad && ownFoods.isFetchNextPageError && !ownFoods.isFetchingNextPage;
  // With nothing to show yet, the next page is on its way even between two requests, so it is always said.
  const renderLoadMore = (isSaid: boolean) =>
    loadMoreFailed ? (
      <ErrorState
        size="section"
        title={SEARCH_FAILED_WEB.title}
        body={SEARCH_FAILED_WEB.body}
        onRetry={() => {
          void ownFoods.fetchNextPage();
        }}
      />
    ) : hasMoreToLoad ? (
      <div ref={loadMoreRef}>
        {(isSaid || ownFoods.isFetchingNextPage) && (
          <InlineStatus>{SEARCH_STATUS.loadingMoreOfYourFoods}</InlineStatus>
        )}
      </div>
    ) : null;

  // A failed refetch keeps the list that was loaded, so only a list that never loaded is an error.
  if (ownFoods.data === undefined) {
    return ownFoods.isError ? (
      <ErrorState size="section" title={SEARCH_FAILED_WEB.title} body={SEARCH_FAILED_WEB.body} />
    ) : (
      <Skeleton variant="rows" label="Loading your foods" />
    );
  }

  if (ownFoods.data.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title={YOUR_FOODS_EMPTY.title}
        body={YOUR_FOODS_EMPTY.body}
        action={{ label: YOUR_FOODS_EMPTY.action, icon: Plus, href: CREATE_A_FOOD_HREF }}
      />
    );
  }

  const foods = filterOwnFoods(ownFoods.data, trimmedQuery);

  if (foods.length === 0 && hasMoreToLoad) {
    return renderLoadMore(true);
  }

  if (foods.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title={SEARCH_EMPTY.title}
        body={SEARCH_EMPTY.body}
        action={{ label: SEARCH_EMPTY.action, icon: Plus, href: CREATE_A_FOOD_HREF }}
      />
    );
  }

  return (
    <>
      <p className="-mb-2 text-caption text-text-muted">{VALUES_PER_100_G_NOTE}</p>
      <LocalFoodList
        groups={groupFoodSearchResults(foods, { limit: foods.length })}
        query={trimmedQuery}
      />
      {renderLoadMore(false)}
    </>
  );
}
