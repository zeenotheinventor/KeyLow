"use client";

import { RateLimitedError, useMaterialiseOffProduct } from "@keylow/api-client";
import {
  ADD_PRODUCT_FAILED,
  OPEN_FOOD_FACTS_BUSY,
  SEARCH_GROUP_HEADINGS,
  SEARCH_STATUS,
  describeRateLimit,
} from "@keylow/core/copy";
import { describeFoodRow } from "@keylow/core/search";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import type { OffCandidateListProps } from "./types";

import { Banner } from "@/components/ui/Banner";
import { FoodRow } from "@/components/ui/FoodRow";
import { GroupedList } from "@/components/ui/GroupedList";

/**
 * The live Open Food Facts results. Choosing one saves it as a food, once, and opens the food.
 * While it is saved its row is busy and the others wait. A failure is said above the rows.
 */
export function OffCandidateList({ candidates, query }: OffCandidateListProps) {
  const router = useRouter();
  const materialise = useMaterialiseOffProduct();
  const { title, caption } = SEARCH_GROUP_HEADINGS.live;
  const addingCode = materialise.isPending ? materialise.variables.code : undefined;

  // `isPending` only reaches the rows on the next render, so a second activation that lands before
  // it (a double tap, a repeated Enter) is held back here. Each save costs the user a rate limit.
  // The guard stays set once the food is saved, so a press while the food opens cannot save it
  // again. Only a failure releases it. Opening the food unmounts this list, so nothing else needs to.
  const isSaving = useRef(false);

  function choose(code: string) {
    if (isSaving.current) {
      return;
    }

    isSaving.current = true;
    materialise.mutate(
      { code },
      {
        onSuccess: (food) => {
          router.push(`/foods/${food.id}`);
        },
        onError: () => {
          isSaving.current = false;
        },
      },
    );
  }

  const failure = materialise.error;

  return (
    <GroupedList
      title={title}
      source={caption}
      notice={
        failure === null ? undefined : failure instanceof RateLimitedError ? (
          <Banner tone="error" title={OPEN_FOOD_FACTS_BUSY}>
            {describeRateLimit(failure.retryAfterSeconds)}
          </Banner>
        ) : (
          <Banner tone="error" title={ADD_PRODUCT_FAILED.title}>
            {ADD_PRODUCT_FAILED.body}
          </Banner>
        )
      }
    >
      {candidates.map((candidate) => (
        <FoodRow
          key={candidate.code}
          {...describeFoodRow(candidate, query)}
          {...(candidate.code === addingCode ? { busyLabel: SEARCH_STATUS.addingProduct } : {})}
          disabled={addingCode !== undefined && candidate.code !== addingCode}
          onClick={() => {
            choose(candidate.code);
          }}
        />
      ))}
    </GroupedList>
  );
}
