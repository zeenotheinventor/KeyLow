import { useOwnFoods } from "@keylow/api-client";
import {
  RETRY_LABEL,
  SEARCH_EMPTY,
  SEARCH_FAILED_MOBILE,
  SEARCH_GROUP_HEADINGS,
  SEARCH_STATUS,
  VALUES_PER_100_G_NOTE,
  YOUR_FOODS_EMPTY,
} from "@keylow/core/copy";
import { describeFoodRow, filterOwnFoods } from "@keylow/core/search";
import { useEffect } from "react";
import { FlatList } from "react-native";

import { EmptyState, ErrorState, FoodRow, GroupedList, Skeleton, Text } from "../../ui";
import { SearchStatus } from "../SearchStatus";

import type { OwnFoodResultsProps } from "./types";

// The whole list is one item of the scrolling list, so the group keeps its one card.
// The list is only the thing that says when the end has been scrolled to.
const WHOLE_LIST = ["your-foods"];

// The next page starts loading when the end is within one screen of the bottom.
const END_REACHED_THRESHOLD = 1;

/**
 * The user's own foods, listed before anything is typed. Typing narrows the list here and never reaches
 * for the shared foods or Open Food Facts, as a library search stays in the library. The list loads a
 * page at a time, and the next page loads when the end of the list is scrolled to. Typed words narrow
 * the pages loaded so far, so while none of them match and more pages remain, the list keeps loading
 * one page at a time (web does the same) until a food matches or the last page is in, rather than saying
 * nothing was found. A page that fails to load stops the paging and offers to try again.
 */
export function OwnFoodResults({ query, onOpenFood, onCreateFood }: OwnFoodResultsProps) {
  const ownFoods = useOwnFoods();
  const trimmedQuery = query.trim();
  const { title, caption } = SEARCH_GROUP_HEADINGS.yours;
  const { data, fetchNextPage } = ownFoods;

  const foods = data === undefined ? undefined : filterOwnFoods(data, trimmedQuery);
  const hasMoreToLoad = ownFoods.hasNextPage;
  // A page that failed to load is not asked for again by itself, or a broken connection would loop. A
  // background refetch that failed has no bearing on the pages still to come.
  const canLoadMore =
    hasMoreToLoad && !ownFoods.isFetchingNextPage && !ownFoods.isFetchNextPageError;
  // A retry in flight still counts as the failure in TanStack, so the failure is shown only between tries.
  const hasFailedToLoadMore =
    hasMoreToLoad && ownFoods.isFetchNextPageError && !ownFoods.isFetchingNextPage;
  const hasFoodsButNoneMatch = data !== undefined && data.length > 0 && foods?.length === 0;

  // The list asks for the next page only once for each length it has, and pages that match nothing leave
  // the length alone. So while no loaded food matches, the next page is asked for here, one at a time.
  useEffect(() => {
    if (hasFoodsButNoneMatch && canLoadMore) {
      // A refetch already running, such as one an edit started, is left to finish.
      void fetchNextPage({ cancelRefetch: false });
    }
  }, [hasFoodsButNoneMatch, canLoadMore, fetchNextPage]);

  const retry = {
    label: RETRY_LABEL,
    onPress: () => {
      void fetchNextPage({ cancelRefetch: false });
    },
  };

  const rows = () => {
    // A failed refetch keeps the list that was loaded, so only a list that never loaded is an error.
    if (data === undefined || foods === undefined) {
      return ownFoods.isError ? (
        <ErrorState body={SEARCH_FAILED_MOBILE.body} title={SEARCH_FAILED_MOBILE.title} />
      ) : (
        <Skeleton variant="group" />
      );
    }

    if (data.length === 0) {
      return (
        <EmptyState
          action={{ label: YOUR_FOODS_EMPTY.action, icon: "Plus", onPress: onCreateFood }}
          body={YOUR_FOODS_EMPTY.body}
          icon="Apple"
          title={YOUR_FOODS_EMPTY.title}
        />
      );
    }

    if (foods.length === 0 && hasMoreToLoad) {
      return hasFailedToLoadMore ? (
        <ErrorState
          body={SEARCH_FAILED_MOBILE.body}
          retry={retry}
          title={SEARCH_FAILED_MOBILE.title}
        />
      ) : (
        <SearchStatus label={SEARCH_STATUS.loadingMoreOfYourFoods} />
      );
    }

    if (foods.length === 0) {
      return (
        <EmptyState
          action={{ label: SEARCH_EMPTY.action, icon: "Plus", onPress: onCreateFood }}
          body={SEARCH_EMPTY.body}
          icon="SearchX"
          title={SEARCH_EMPTY.title}
        />
      );
    }

    return (
      <>
        <Text className="-mb-2" tone="muted" variant="caption">
          {VALUES_PER_100_G_NOTE}
        </Text>
        <GroupedList source={caption} title={title}>
          {foods.map((food) => (
            <FoodRow
              key={food.id}
              {...describeFoodRow(food, trimmedQuery)}
              onPress={() => {
                onOpenFood(food.id);
              }}
            />
          ))}
        </GroupedList>
      </>
    );
  };

  const hasMatches = foods !== undefined && foods.length > 0;
  let footer = null;
  if (hasMatches && hasFailedToLoadMore) {
    footer = (
      <ErrorState
        body={SEARCH_FAILED_MOBILE.body}
        retry={retry}
        size="section"
        title={SEARCH_FAILED_MOBILE.title}
      />
    );
  } else if (hasMatches && ownFoods.isFetchingNextPage) {
    footer = <SearchStatus label={SEARCH_STATUS.loadingMoreOfYourFoods} />;
  }

  return (
    <FlatList
      className="flex-1"
      contentContainerClassName="grow gap-4 px-4 pb-4 pt-1"
      data={WHOLE_LIST}
      keyboardShouldPersistTaps="handled"
      keyExtractor={(key) => key}
      ListFooterComponent={footer}
      // With no match yet the effect above does the paging, so the list does not ask a second time.
      onEndReached={
        hasMatches && canLoadMore
          ? () => {
              void fetchNextPage();
            }
          : undefined
      }
      onEndReachedThreshold={END_REACHED_THRESHOLD}
      renderItem={rows}
    />
  );
}
