import { keys } from "@keylow/api-client";
import { TERMS_VERSION } from "@keylow/core/copy";
import { QueryClient } from "@tanstack/react-query";

import { DIARY_CACHE_MAX_AGE_MS } from "../lib/diaryCache/constants";
import { createDiaryCachePersister } from "../lib/diaryCache/createDiaryCachePersister";
import { isPersistedQuery } from "../lib/diaryCache/isPersistedQuery";

import type { PersistedClient } from "@tanstack/react-query-persist-client";

const HOUR_MS = 60 * 60 * 1000;

function queryFor(queryKey: readonly unknown[], options: { updatedAt?: number } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  queryClient.setQueryData(queryKey, { rows: [] }, { updatedAt: options.updatedAt ?? Date.now() });
  const query = queryClient.getQueryCache().find({ queryKey });
  if (query === undefined) {
    throw new Error("The query was not stored");
  }
  return query;
}

describe("which queries the diary cache keeps", () => {
  it.each([
    ["a day of the diary", keys.diary.day("2026-10-15")],
    ["a week of the diary", keys.diary.week("2026-10-12")],
    ["the complete days of a month", keys.diary.completeDays("2026-10")],
    ["the recent foods", keys.diary.recentFoods],
    ["the targets", keys.profiles.targets],
    ["the time zone the diary reads its days in", keys.profiles.timeZone],
    ["the terms acceptance the gate reads", keys.profiles.termsAcceptance],
  ])("should keep %s", (_name, queryKey) => {
    expect(isPersistedQuery(queryFor(queryKey))).toBe(true);
  });

  it.each([
    ["a food search", keys.foods.search("oats")],
    ["a search of Open Food Facts", keys.foods.offSearch("oats")],
    ["a barcode lookup", keys.foods.barcode("5000000000000")],
    ["a food", keys.foods.detail("food-id")],
    ["the portions of a food", keys.foods.portions("food-id")],
    ["the foods of the user", keys.foods.own],
    ["a profile", keys.profiles.detail("user-id")],
    ["a diary query this cache does not know", ["diary", "something-new", "2026-10-15"]],
  ])("should not keep %s", (_name, queryKey) => {
    expect(isPersistedQuery(queryFor(queryKey))).toBe(false);
  });

  it("should not keep a query whose data is older than the longest the cache may be kept", () => {
    const stale = queryFor(keys.diary.day("2026-10-01"), {
      updatedAt: Date.now() - DIARY_CACHE_MAX_AGE_MS - HOUR_MS,
    });

    expect(isPersistedQuery(stale)).toBe(false);
  });

  it("should not keep a query that has no data", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    const queryKey: readonly unknown[] = keys.diary.day("2026-10-15");
    const query = queryClient.getQueryCache().build(queryClient, { queryKey });

    expect(isPersistedQuery(query)).toBe(false);
  });
});

function createFakeStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => Promise.resolve(items.get(key) ?? null),
    setItem: (key: string, value: string) => {
      items.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      items.delete(key);
      return Promise.resolve();
    },
  };
}

function persistedClientWith(
  queries: { queryKey: readonly unknown[]; data: unknown }[],
): PersistedClient {
  return {
    buster: "any",
    timestamp: Date.now(),
    clientState: {
      mutations: [],
      queries: queries.map(({ queryKey, data }) => ({
        queryKey,
        queryHash: JSON.stringify(queryKey),
        dehydratedAt: Date.now(),
        state: {
          data,
          dataUpdateCount: 1,
          dataUpdatedAt: Date.now(),
          error: null,
          errorUpdateCount: 0,
          errorUpdatedAt: 0,
          fetchFailureCount: 0,
          fetchFailureReason: null,
          fetchMeta: null,
          isInvalidated: false,
          status: "success",
          fetchStatus: "idle",
        },
      })),
    },
  };
}

const currentAcceptance = {
  queryKey: keys.profiles.termsAcceptance,
  data: { terms_accepted_at: "2026-10-15T09:30:00+00:00", terms_version: TERMS_VERSION },
};
const aDay = { queryKey: keys.diary.day("2026-10-15"), data: { entries: [] } };

describe("the diary cache persister", () => {
  it("should give back what it stored", async () => {
    const storage = createFakeStorage();
    const persister = createDiaryCachePersister(storage);
    const client = persistedClientWith([currentAcceptance, aDay]);

    await persister.persistClient(client);

    await expect(persister.restoreClient()).resolves.toEqual(client);
  });

  it("should store nothing, and remove what was there, when the cache has no queries left", async () => {
    const storage = createFakeStorage();
    const persister = createDiaryCachePersister(storage);
    await persister.persistClient(persistedClientWith([currentAcceptance, aDay]));

    await persister.persistClient(persistedClientWith([]));

    expect(storage.items.size).toBe(0);
  });

  it("should not give back a cache whose account has not accepted the current terms", async () => {
    const storage = createFakeStorage();
    const persister = createDiaryCachePersister(storage);
    await persister.persistClient(
      persistedClientWith([
        {
          queryKey: keys.profiles.termsAcceptance,
          data: {
            terms_accepted_at: "2026-01-01T09:30:00+00:00",
            terms_version: "an-older-version",
          },
        },
        aDay,
      ]),
    );

    await expect(persister.restoreClient()).resolves.toBeUndefined();
    expect(storage.items.size).toBe(0);
  });

  it("should not give back a cache that never learned whether the terms were accepted", async () => {
    const storage = createFakeStorage();
    const persister = createDiaryCachePersister(storage);
    await persister.persistClient(persistedClientWith([aDay]));

    await expect(persister.restoreClient()).resolves.toBeUndefined();
  });

  it("should not give back a cache of an account that has no profile row, which has accepted nothing", async () => {
    const storage = createFakeStorage();
    const persister = createDiaryCachePersister(storage);
    await persister.persistClient(
      persistedClientWith([{ queryKey: keys.profiles.termsAcceptance, data: null }, aDay]),
    );

    await expect(persister.restoreClient()).resolves.toBeUndefined();
  });

  it("should fail to read a damaged cache without putting any of it in the message", async () => {
    const storage = createFakeStorage();
    storage.items.set("keylow.diary-cache", '{"clientState": {"queries": [Porridge oats 187 kcal');
    const persister = createDiaryCachePersister(storage);

    // The message is exactly the fixed one, so none of the stored text is in it.
    await expect(Promise.resolve(persister.restoreClient())).rejects.toThrow(
      new Error("The stored diary cache could not be read"),
    );
  });
});
