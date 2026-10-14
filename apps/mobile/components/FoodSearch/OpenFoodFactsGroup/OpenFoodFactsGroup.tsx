import {
  OffProductNotFoundError,
  RateLimitedError,
  useMaterialiseOffProduct,
} from "@keylow/api-client";
import {
  ADD_PRODUCT_FAILED,
  ADD_PRODUCT_NOT_FOUND,
  SEARCH_GROUP_HEADINGS,
  SEARCH_STATUS,
} from "@keylow/core/copy";
import { describeFoodRow } from "@keylow/core/search";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

import { Banner, FoodRow, GroupedList } from "../../ui";
import { openFoodFactsBusyTitle } from "../openFoodFactsBusyTitle";

import type { OpenFoodFactsGroupProps } from "./types";

// The failure belongs to the search it happened in, so a new query shows none.
type AddFailure = { query: string; error: unknown };

function AddFailureBanner({ error }: { error: unknown }) {
  if (error instanceof RateLimitedError) {
    return <Banner title={openFoodFactsBusyTitle(error.retryAfterSeconds)} variant="error" />;
  }

  if (error instanceof OffProductNotFoundError) {
    return <Banner title={ADD_PRODUCT_NOT_FOUND} variant="error" />;
  }

  return <Banner body={ADD_PRODUCT_FAILED.body} title={ADD_PRODUCT_FAILED.title} variant="error" />;
}

/**
 * The live Open Food Facts results. Choosing one saves it as a food, once, and opens the food. While
 * it is saved its row is busy and the others wait. A failure is said in the group, above the rows.
 */
export function OpenFoodFactsGroup({ candidates, query, onOpenFood }: OpenFoodFactsGroupProps) {
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
    // Coming back to the sheet releases them.
    onOpenFood(food.id);
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
      {candidates.map((candidate) => (
        <FoodRow
          key={candidate.code}
          {...describeFoodRow(candidate, query)}
          busyLabel={candidate.code === pendingCode ? SEARCH_STATUS.addingProduct : undefined}
          disabled={pendingCode !== undefined && candidate.code !== pendingCode}
          onPress={() => {
            void addCandidate(candidate.code);
          }}
        />
      ))}
    </GroupedList>
  );
}
