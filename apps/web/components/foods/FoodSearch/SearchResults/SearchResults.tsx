"use client";

import { useFoodSearch } from "@keylow/api-client";

import { LocalFoodList } from "../LocalFoodList";
import { OffCandidateList } from "../OffCandidateList";

import type { SearchResultsProps } from "./types";
import type { FoodSearchOffError } from "@keylow/api-client";

import { describeRateLimit } from "@/components/foods/foodDisplay";

function describeOffError(error: FoodSearchOffError): string {
  return error.kind === "failed"
    ? `Open Food Facts could not be searched: ${error.message}`
    : describeRateLimit(error.retryAfterSeconds);
}

export function SearchResults({ query }: SearchResultsProps) {
  // The query arrives already settled, so the hook's own debounce would only add to the wait.
  const { local, off, isLoadingLocal, isLoadingOff, offError, localError } = useFoodSearch(query, {
    debounceMs: 0,
  });
  const hasFoundNothing =
    !isLoadingLocal &&
    !isLoadingOff &&
    localError === null &&
    local.length === 0 &&
    off.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {isLoadingLocal && (
        <p role="status" className="text-sm text-muted-foreground">
          Searching foods
        </p>
      )}
      {localError !== null && (
        <p role="alert" className="text-sm text-destructive">
          {localError.message}
        </p>
      )}
      {local.length > 0 && <LocalFoodList foods={local} />}
      {isLoadingOff && (
        <p role="status" className="text-sm text-muted-foreground">
          Searching Open Food Facts
        </p>
      )}
      {offError !== null && (
        <p role="alert" className="text-sm text-destructive">
          {describeOffError(offError)}
        </p>
      )}
      {off.length > 0 && <OffCandidateList candidates={off} />}
      {hasFoundNothing && <p className="text-sm text-muted-foreground">No foods found</p>}
    </div>
  );
}
