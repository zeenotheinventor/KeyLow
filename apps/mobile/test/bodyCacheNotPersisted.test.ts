import { keys } from "@keylow/api-client";
import { QueryClient } from "@tanstack/react-query";

import { isPersistedQuery } from "../lib/diaryCache/isPersistedQuery";
import { PERSISTED_QUERY_KEYS } from "../lib/diaryCache/persistedQueryKeys";

// Body fat and lean mass are health data and the offline cache keeps a fixed list of families. This
// pins that the body measurement keys are not in it, so adding them takes a change to this test as well.

function freshQueryFor(queryKey: readonly unknown[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  queryClient.setQueryData(queryKey, [{ id: "body-measurement-1" }]);
  const query = queryClient.getQueryCache().find({ queryKey });
  if (query === undefined) {
    throw new Error("The query was not stored");
  }
  return query;
}

const startsWith = (queryKey: readonly unknown[], prefix: readonly unknown[]) =>
  prefix.every((part, index) => queryKey[index] === part);

const bodyMeasurementKeys = [
  ["every body measurement query", keys.bodyMeasurements.all],
  ["the body fat list", keys.bodyMeasurements.list("body_fat_pct")],
  ["the lean mass list", keys.bodyMeasurements.list("lean_mass_kg")],
] as const;

describe("the body measurements in the offline cache", () => {
  it.each(bodyMeasurementKeys)(
    "should not keep %s, even when it holds fresh data",
    (_name, queryKey) => {
      expect(isPersistedQuery(freshQueryFor(queryKey))).toBe(false);
    },
  );

  it.each(bodyMeasurementKeys)(
    "should have no persisted family as a prefix of the key of %s",
    (_name, queryKey) => {
      expect(PERSISTED_QUERY_KEYS.filter((prefix) => startsWith(queryKey, prefix))).toEqual([]);
    },
  );
});
