import { keys } from "@keylow/api-client";
import { QueryClient } from "@tanstack/react-query";

import { isPersistedQuery } from "../lib/diaryCache/isPersistedQuery";

// Searching exercises by text and reading one exercise need a connection, as logging does, and the offline
// cache keeps a fixed list of families. This pins that the exercise keys are not in it, so adding them takes
// a change to this test as well.

function freshQueryFor(queryKey: readonly unknown[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  queryClient.setQueryData(queryKey, [{ id: "exercise-1" }]);
  const query = queryClient.getQueryCache().find({ queryKey });
  if (query === undefined) {
    throw new Error("The query was not stored");
  }
  return query;
}

describe("the exercise reads in the offline cache", () => {
  it.each([
    ["an exercise search", keys.training.exerciseSearch("raise")],
    ["the prefix of every exercise search", keys.training.exerciseSearchAll],
    ["one exercise", keys.training.exercise("77777777-7777-4777-8777-777777777777")],
  ])("should not keep %s, even when it holds fresh data", (_name, queryKey) => {
    expect(isPersistedQuery(freshQueryFor(queryKey))).toBe(false);
  });
});
