import {
  OffProductNotFoundError,
  RateLimitedError,
  useMaterialiseOffProduct,
} from "@keylow/api-client";
import {
  ADD_PRODUCT_FAILED,
  ADD_PRODUCT_NOT_FOUND,
  LOOKUP_RATE_LIMITED,
  SEARCH_GROUP_HEADINGS,
  SEARCH_STATUS,
  describeRateLimit,
} from "@keylow/core/copy";
import { describeLiveFoodRow } from "@keylow/core/search";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

import { Banner, FoodRow, GroupedList } from "../../ui";

import type { OpenFoodFactsGroupProps } from "./types";

// The failure belongs to the search it happened in, so a new query shows none.
type AddFailure = { query: string; error: unknown };

function AddFailureBanner({ error }: { error: unknown }) {
  if (error instanceof RateLimitedError) {
    return (
      <Banner
        title={`${LOOKUP_RATE_LIMITED}. ${describeRateLimit(error.retryAfterSeconds)}`}
        variant="error"
      />
    );
  }

  if (error instanceof OffProductNotFoundError) {
    return <Banner title={ADD_PRODUCT_NOT_FOUND} variant="error" />;
  }

  return <Banner body={ADD_PRODUCT_FAILED.body} title={ADD_PRODUCT_FAILED.title} variant="error" />;
}

/**
 * The live Open Food Facts results. Choosing one saves it as a food, once, and opens the food. While
 * it is saved its row is busy and the others wait. A failure is said in the group, above the rows. When the
 * search shows servings, a row shows the serving its product will open on, with no plus because it is not
 * stored yet.
 */
export function OpenFoodFactsGroup({
  candidates,
  query,
  releasesOnOpen = false,
  showsServings = false,
  onOpenFood,
}: OpenFoodFactsGroupProps) {
  const materialiseOffProduct = useMaterialiseOffProduct();
  const [pendingCode, setPendingCode] = useState<string | undefined>(undefined);
  const [failure, setFailure] = useState<AddFailure | undefined>(undefined);
  const { title, caption } = SEARCH_GROUP_HEADINGS.live;

  // Setting the pending code reaches the rows only on the next render, so a second press that lands before
  // it (a double tap) is held back here. Each save costs the user one of their few searches a minute.
  const isAdding = useRef(false);

  async function addCandidate(code: string) {
    if (isAdding.current) {
      return;
    }

    isAdding.current = true;
    setPendingCode(code);
    setFailure(undefined);
    let food;
    try {
      food = await materialiseOffProduct.mutateAsync({ code });
    } catch (error) {
      setFailure({ query, error });
      isAdding.current = false;
      setPendingCode(undefined);
      return;
    }
    // The guard and the busy row stay while the food opens, so a second tap cannot add and open it again.
    // Coming back to the sheet releases them, unless the food opens over the sheet itself.
    onOpenFood(food.id);
    if (releasesOnOpen) {
      isAdding.current = false;
      setPendingCode(undefined);
    }
  }

  // The food opens over the sheet, which loses focus. Coming back gives it focus and releases the row.
  useFocusEffect(
    useCallback(() => {
      isAdding.current = false;
      setPendingCode(undefined);
    }, []),
  );

  return (
    <GroupedList
      notice={failure?.query === query ? <AddFailureBanner error={failure.error} /> : undefined}
      source={caption}
      title={title}
    >
      {candidates.map((candidate) => {
        const { caption, ...description } = describeLiveFoodRow(candidate, query, {
          showsServings,
        });

        return (
          <FoodRow
            key={candidate.code}
            {...description}
            busyLabel={candidate.code === pendingCode ? SEARCH_STATUS.addingProduct : undefined}
            caption={caption}
            disabled={pendingCode !== undefined && candidate.code !== pendingCode}
            layout={caption === undefined ? undefined : "search"}
            onPress={() => {
              void addCandidate(candidate.code);
            }}
          />
        );
      })}
    </GroupedList>
  );
}
