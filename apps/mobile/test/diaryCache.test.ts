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
    ["one entry by its id", keys.diary.entry("entry-1")],
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
    ["the recipe library", keys.recipes.list(true)],
    ["the live recipes", keys.recipes.list(false)],
    ["a recipe", keys.recipes.detail("recipe-id")],
    ["a search of recipes", keys.recipes.search("chi")],
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

describe("which training queries the diary cache keeps", () => {
  it.each([
    ["the sets from a start day", keys.training.sets("2026-10-02")],
    ["the active routine", keys.training.activeRoutine],
    ["whether any session was ever logged", keys.training.hasLoggedSession],
    ["the sessions of a week", keys.training.weekSessions("2026-10-12")],
    ["a session with its sets", keys.training.session("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")],
    ["the session in progress", keys.training.activeSession],
    ["the routines, with the archived ones left out", keys.training.routines(false)],
    ["the routines, with the archived ones in", keys.training.routines(true)],
    [
      "one routine with its days and exercises",
      keys.training.routine("88888888-8888-4888-8888-888888888888"),
    ],
    ["the weight unit a restored session shows its loads in", keys.profiles.weightUnit],
  ])("should keep %s", (_name, queryKey) => {
    expect(isPersistedQuery(queryFor(queryKey))).toBe(true);
  });

  it.each([
    ["a search of exercises by text", ["training", "exercise-search", "bench"]],
    ["a training query this cache does not know", ["training", "something-new", "2026-10-02"]],
    ["the bare training prefix", keys.training.all],
    [
      "the last performance of an exercise, which is only read while logging",
      keys.training.lastPerformance(
        "77777777-7777-4777-8777-777777777777",
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      ),
    ],
  ])("should not keep %s", (_name, queryKey) => {
    expect(isPersistedQuery(queryFor(queryKey))).toBe(false);
  });

  it("should not keep a week of sessions whose data is older than the longest the cache may be kept", () => {
    const stale = queryFor(keys.training.weekSessions("2026-09-28"), {
      updatedAt: Date.now() - DIARY_CACHE_MAX_AGE_MS - HOUR_MS,
    });

    expect(isPersistedQuery(stale)).toBe(false);
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
  queries: { queryKey: readonly unknown[]; data: unknown; updatedAt?: number }[],
): PersistedClient {
  return {
    buster: "any",
    timestamp: Date.now(),
    clientState: {
      mutations: [],
      queries: queries.map(({ queryKey, data, updatedAt = Date.now() }) => ({
        queryKey,
        queryHash: JSON.stringify(queryKey),
        dehydratedAt: Date.now(),
        state: {
          data,
          dataUpdateCount: 1,
          dataUpdatedAt: updatedAt,
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

const OWNER = "11111111-1111-4111-8111-111111111111";
const ANOTHER_ACCOUNT = "22222222-2222-4222-8222-222222222222";
const signedInAs = (userId: string | null) => () => Promise.resolve(userId);

const currentAcceptance = {
  queryKey: keys.profiles.termsAcceptance,
  data: { terms_accepted_at: "2026-10-15T09:30:00+00:00", terms_version: TERMS_VERSION },
};
const aDay = { queryKey: keys.diary.day("2026-10-15"), data: { entries: [] } };

describe("the diary cache persister", () => {
  it("should give back what it stored", async () => {
    const storage = createFakeStorage();
    const persister = createDiaryCachePersister(storage, signedInAs(OWNER));
    const client = persistedClientWith([currentAcceptance, aDay]);

    await persister.persistClient(client);

    await expect(persister.restoreClient()).resolves.toEqual(client);
  });

  it("should store nothing, and remove what was there, when the cache has no queries left", async () => {
    const storage = createFakeStorage();
    const persister = createDiaryCachePersister(storage, signedInAs(OWNER));
    await persister.persistClient(persistedClientWith([currentAcceptance, aDay]));

    await persister.persistClient(persistedClientWith([]));

    expect(storage.items.size).toBe(0);
  });

  it("should not give back a cache whose account has not accepted the current terms", async () => {
    const storage = createFakeStorage();
    const persister = createDiaryCachePersister(storage, signedInAs(OWNER));
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
    const persister = createDiaryCachePersister(storage, signedInAs(OWNER));
    await persister.persistClient(persistedClientWith([aDay]));

    await expect(persister.restoreClient()).resolves.toBeUndefined();
  });

  it("should not give back a cache of an account that has no profile row, which has accepted nothing", async () => {
    const storage = createFakeStorage();
    const persister = createDiaryCachePersister(storage, signedInAs(OWNER));
    await persister.persistClient(
      persistedClientWith([{ queryKey: keys.profiles.termsAcceptance, data: null }, aDay]),
    );

    await expect(persister.restoreClient()).resolves.toBeUndefined();
  });

  describe("whose cache it is", () => {
    async function storeAs(storage: ReturnType<typeof createFakeStorage>, userId: string | null) {
      await createDiaryCachePersister(storage, signedInAs(userId)).persistClient(
        persistedClientWith([currentAcceptance, aDay]),
      );
    }

    it("should give back the cache to the account that stored it", async () => {
      const storage = createFakeStorage();
      await storeAs(storage, OWNER);

      const restored = await createDiaryCachePersister(storage, signedInAs(OWNER)).restoreClient();

      expect(restored?.clientState.queries).toHaveLength(2);
      expect(restored?.buster).toBe("any");
    });

    it("should remove another account's cache without giving it back", async () => {
      const storage = createFakeStorage();
      await storeAs(storage, ANOTHER_ACCOUNT);

      const restored = await createDiaryCachePersister(storage, signedInAs(OWNER)).restoreClient();

      expect(restored).toBeUndefined();
      expect(storage.items.size).toBe(0);
    });

    it("should remove the cache without giving it back when it does not know who is signed in", async () => {
      const storage = createFakeStorage();
      await storeAs(storage, OWNER);

      const restored = await createDiaryCachePersister(storage, signedInAs(null)).restoreClient();

      expect(restored).toBeUndefined();
      expect(storage.items.size).toBe(0);
    });

    it("should store nothing when it does not know who is signed in", async () => {
      const storage = createFakeStorage();

      await storeAs(storage, null);

      expect(storage.items.size).toBe(0);
    });

    it("should not give back a cache stored with no owner", async () => {
      const storage = createFakeStorage();
      storage.items.set(
        "keylow.diary-cache",
        JSON.stringify(persistedClientWith([currentAcceptance, aDay])),
      );

      await expect(
        createDiaryCachePersister(storage, signedInAs(OWNER)).restoreClient(),
      ).resolves.toBeUndefined();
      expect(storage.items.size).toBe(0);
    });
  });

  describe("how old a query's data may be", () => {
    it("should leave out a query whose data is older than the limit, though the cache was saved just now", async () => {
      const storage = createFakeStorage();
      const persister = createDiaryCachePersister(storage, signedInAs(OWNER));
      const staleDay = {
        queryKey: keys.diary.day("2026-10-01"),
        data: { entries: [] },
        updatedAt: Date.now() - DIARY_CACHE_MAX_AGE_MS - HOUR_MS,
      };
      await persister.persistClient(persistedClientWith([currentAcceptance, aDay, staleDay]));

      const restored = await persister.restoreClient();

      expect(restored?.clientState.queries.map(({ queryKey }) => queryKey)).toEqual([
        currentAcceptance.queryKey,
        aDay.queryKey,
      ]);
    });

    it("should not give back a cache whose terms acceptance is older than the limit", async () => {
      const storage = createFakeStorage();
      const persister = createDiaryCachePersister(storage, signedInAs(OWNER));
      await persister.persistClient(
        persistedClientWith([
          { ...currentAcceptance, updatedAt: Date.now() - DIARY_CACHE_MAX_AGE_MS - HOUR_MS },
          aDay,
        ]),
      );

      await expect(persister.restoreClient()).resolves.toBeUndefined();
    });
  });

  describe("when the stored user cannot be read", () => {
    const failingReader = () => Promise.reject(new Error("storage unavailable"));

    it("should give back nothing, and not fail, when reading the cache", async () => {
      const storage = createFakeStorage();
      await createDiaryCachePersister(storage, signedInAs(OWNER)).persistClient(
        persistedClientWith([currentAcceptance, aDay]),
      );

      await expect(
        createDiaryCachePersister(storage, failingReader).restoreClient(),
      ).resolves.toBeUndefined();
      expect(storage.items.size).toBe(0);
    });

    it("should store nothing, and not fail, when saving the cache", async () => {
      const storage = createFakeStorage();

      await createDiaryCachePersister(storage, failingReader).persistClient(
        persistedClientWith([currentAcceptance, aDay]),
      );

      expect(storage.items.size).toBe(0);
    });
  });

  it("should fail to read a damaged cache without putting any of it in the message", async () => {
    const storage = createFakeStorage();
    storage.items.set("keylow.diary-cache", '{"clientState": {"queries": [Porridge oats 187 kcal');
    const persister = createDiaryCachePersister(storage, signedInAs(OWNER));

    // The message is exactly the fixed one, so none of the stored text is in it.
    await expect(Promise.resolve(persister.restoreClient())).rejects.toThrow(
      new Error("The stored diary cache could not be read"),
    );
  });

  it("should fail to read a damaged cache of training reads without putting any of it in the message", async () => {
    const storage = createFakeStorage();
    storage.items.set(
      "keylow.diary-cache",
      '{"clientState": {"queries": [{"queryKey": ["training", "sets"], "data": [{"snapshot": {"name": "Barbell bench press", "load": 82.5',
    );
    const persister = createDiaryCachePersister(storage, signedInAs(OWNER));

    const failure = await Promise.resolve(persister.restoreClient()).catch(
      (error: unknown) => error,
    );

    expect(failure).toEqual(new Error("The stored diary cache could not be read"));
    expect(JSON.stringify(failure)).not.toContain("bench");
  });
});
