import { keys } from "@keylow/api-client";
import { QueryClient, dehydrate } from "@tanstack/react-query";

import { DIARY_CACHE_MAX_AGE_MS } from "../lib/diaryCache/constants";
import { createShouldDehydrateQuery } from "../lib/diaryCache/createShouldDehydrateQuery";

const HOUR_MS = 60 * 60 * 1000;

function createCache() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const read = (queryKey: readonly unknown[], hoursAgo = 0) => {
    queryClient.setQueryData(queryKey, [], { updatedAt: Date.now() - hoursAgo * HOUR_MS });
  };
  const storedKeys = () =>
    dehydrate(queryClient, { shouldDehydrateQuery: createShouldDehydrateQuery(queryClient) })
      .queries.map(({ queryKey }) => queryKey)
      .sort((first, second) => JSON.stringify(first).localeCompare(JSON.stringify(second)));
  return { queryClient, read, storedKeys };
}

describe("which queries are stored when the diary cache is saved", () => {
  it("should store only the sets read most recently, however many start days are held", () => {
    const { read, storedKeys } = createCache();
    read(keys.training.sets("2026-10-01"), 72);
    read(keys.training.sets("2026-10-02"), 48);
    read(keys.training.sets("2026-10-03"), 1);
    read(keys.training.sets("2026-10-04"), 24);

    expect(storedKeys()).toEqual([keys.training.sets("2026-10-03")]);
  });

  it("should pick the sets by when they were read and not by their start day", () => {
    const { read, storedKeys } = createCache();
    // A start day moves back as well as forward when the profile's time zone moves west.
    read(keys.training.sets("2026-10-05"), 30);
    read(keys.training.sets("2026-10-04"), 2);

    expect(storedKeys()).toEqual([keys.training.sets("2026-10-04")]);
  });

  it("should store every active routine and every week of sessions", () => {
    const { read, storedKeys } = createCache();
    read(keys.training.activeRoutine);
    read(keys.training.weekSessions("2026-10-05"), 100);
    read(keys.training.weekSessions("2026-10-12"), 1);

    expect(storedKeys()).toEqual([
      keys.training.activeRoutine,
      keys.training.weekSessions("2026-10-05"),
      keys.training.weekSessions("2026-10-12"),
    ]);
  });

  it("should keep the newest sets and the diary together", () => {
    const { read, storedKeys } = createCache();
    read(keys.training.sets("2026-10-02"), 48);
    read(keys.training.sets("2026-10-03"), 1);
    read(keys.diary.day("2026-10-14"), 48);
    read(keys.diary.day("2026-10-15"), 1);

    expect(storedKeys()).toEqual([
      keys.diary.day("2026-10-14"),
      keys.diary.day("2026-10-15"),
      keys.training.sets("2026-10-03"),
    ]);
  });

  it("should not store a search, or a query outside the list, even when it is the newest", () => {
    const { read, storedKeys } = createCache();
    read(keys.training.sets("2026-10-03"), 5);
    read(["training", "exercise-search", "bench"]);
    read(keys.foods.search("oats"));

    expect(storedKeys()).toEqual([keys.training.sets("2026-10-03")]);
  });

  it("should store no sets when even the newest are older than the cache may be kept", () => {
    const { read, storedKeys } = createCache();
    const stale = (DIARY_CACHE_MAX_AGE_MS + HOUR_MS) / HOUR_MS;
    read(keys.training.sets("2026-09-20"), stale);
    read(keys.training.sets("2026-09-19"), stale + 24);

    expect(storedKeys()).toEqual([]);
  });

  it("should store the newest of the sets that are young enough", () => {
    const { read, storedKeys } = createCache();
    read(keys.training.sets("2026-10-03"), 6 * 24);
    read(keys.training.sets("2026-10-02"), 7 * 24 + 5);

    expect(storedKeys()).toEqual([keys.training.sets("2026-10-03")]);
  });

  it("should store the newest sets that hold data when a refresh of the newest has failed", async () => {
    const { queryClient, read, storedKeys } = createCache();
    read(keys.training.sets("2026-10-02"), 48);
    read(keys.training.sets("2026-10-03"), 2);
    await queryClient
      .query({
        queryKey: keys.training.sets("2026-10-03"),
        queryFn: () => Promise.reject(new Error("The connection dropped")),
        staleTime: 0,
        retry: false,
      })
      .catch(() => undefined);
    expect(queryClient.getQueryState(keys.training.sets("2026-10-03"))?.status).toBe("error");

    expect(storedKeys()).toEqual([keys.training.sets("2026-10-02")]);
  });
});
