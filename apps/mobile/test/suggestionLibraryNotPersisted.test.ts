import { keys } from "@keylow/api-client";
import { QueryClient } from "@tanstack/react-query";

import { isPersistedQuery } from "../lib/diaryCache/isPersistedQuery";
import { PERSISTED_QUERY_KEYS } from "../lib/diaryCache/persistedQueryKeys";

// The suggestion's exercise library is global reference data and big, and acting on a suggestion needs a
// connection, so the offline cache never keeps it. This pins that its keys are not in the persisted list,
// so adding them takes a change to this test as well.

const LIBRARY_KEY = keys.training.suggestionLibrary("barbell,dumbbell");

function freshQueryFor(queryKey: readonly unknown[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  queryClient.setQueryData(queryKey, [{ id: "exercise-1" }]);
  const query = queryClient.getQueryCache().find({ queryKey });
  if (query === undefined) {
    throw new Error("The query was not stored");
  }
  return query;
}

const startsWith = (queryKey: readonly unknown[], prefix: readonly unknown[]) =>
  prefix.every((part, index) => queryKey[index] === part);

describe("the suggestion library in the offline cache", () => {
  it.each([
    ["the library of one equipment list", LIBRARY_KEY],
    ["every suggestion library", keys.training.suggestionLibraryAll],
  ])("should not keep %s, even when it holds fresh data", (_name, queryKey) => {
    expect(isPersistedQuery(freshQueryFor(queryKey))).toBe(false);
  });

  it("should have no persisted family as a prefix of the library key", () => {
    expect(PERSISTED_QUERY_KEYS.filter((prefix) => startsWith(LIBRARY_KEY, prefix))).toEqual([]);
  });

  it("should not list the library key or its prefix as a persisted family", () => {
    expect(PERSISTED_QUERY_KEYS).not.toContainEqual(keys.training.suggestionLibraryAll);
    expect(PERSISTED_QUERY_KEYS).not.toContainEqual(LIBRARY_KEY);
  });
});
