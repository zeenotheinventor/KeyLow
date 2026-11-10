import { MIN_SEARCH_LENGTH } from "@keylow/api-client";
import { FOOD_SEARCH_FETCH_LIMIT, FOOD_SEARCH_REVEAL_BATCH } from "@keylow/core/search";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, View } from "react-native";

import type { ScrollingResultsProps } from "./types";
import type { CellRendererProps } from "@react-native/virtualized-lists";

// The whole result is one item of the scrolling list, so the groups keep their cards.
// The list is only the thing that says when the end has been scrolled to.
const WHOLE_RESULT = ["results"];

// More rows are revealed when the end is within half a screen of the bottom.
const END_REACHED_THRESHOLD = 0.5;

// The list's cell holds the results in place of the content container, which holds only the cell. So the
// cell carries the gap between the results and the grow that lets a state such as "No foods found" fill
// and centre. It passes on the layout report the list needs.
function ResultsCell({ children, onLayout }: CellRendererProps<string>) {
  return (
    <View className="grow gap-4" onLayout={onLayout}>
      {children}
    </View>
  );
}

/**
 * Scrolls the food search results and reveals them as the end comes near: the first rows at first, then
 * a batch more each time, so rows only ever join at the bottom and nothing above moves. The list also
 * reports its end when it is short, so rows keep being revealed without a scroll while some are left. The
 * results say whether any are left, and the end of a list with nothing to reveal, such as a skeleton on
 * its way to results, changes nothing. Nothing is loaded, because the rows are already fetched, so there
 * is no loading row. Another query starts again from the first rows, at the top of the list.
 */
export function ScrollingResults({ query, children }: ScrollingResultsProps) {
  const trimmedQuery = query.trim();
  const listRef = useRef<FlatList<string>>(null);
  const hasMoreRows = useRef(false);
  const [reveal, setReveal] = useState({ query: trimmedQuery, count: FOOD_SEARCH_REVEAL_BATCH });
  const previousQuery = useRef(trimmedQuery);

  // A different search starts again from the first rows, whatever it was before.
  if (reveal.query !== trimmedQuery) {
    setReveal({ query: trimmedQuery, count: FOOD_SEARCH_REVEAL_BATCH });
  }
  const visibleRowCount = reveal.query === trimmedQuery ? reveal.count : FOOD_SEARCH_REVEAL_BATCH;

  // The rows of the new search start at the top, or the list would stay at an offset it can no longer reach.
  useEffect(() => {
    if (previousQuery.current !== trimmedQuery) {
      previousQuery.current = trimmedQuery;
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [trimmedQuery]);

  const onMoreRowsChange = useCallback((hasMore: boolean) => {
    hasMoreRows.current = hasMore;
  }, []);

  return (
    <FlatList
      ref={listRef}
      CellRendererComponent={ResultsCell}
      className="flex-1"
      contentContainerClassName="grow px-4 pb-4 pt-1"
      data={WHOLE_RESULT}
      keyboardShouldPersistTaps="handled"
      keyExtractor={(key) => key}
      onEndReached={() => {
        if (trimmedQuery.length < MIN_SEARCH_LENGTH || !hasMoreRows.current) {
          return;
        }
        // The results say again whether rows are left once the new count has been drawn.
        hasMoreRows.current = false;
        setReveal({
          query: trimmedQuery,
          count: Math.min(visibleRowCount + FOOD_SEARCH_REVEAL_BATCH, FOOD_SEARCH_FETCH_LIMIT),
        });
      }}
      onEndReachedThreshold={END_REACHED_THRESHOLD}
      renderItem={() => <>{children(visibleRowCount, onMoreRowsChange)}</>}
    />
  );
}
