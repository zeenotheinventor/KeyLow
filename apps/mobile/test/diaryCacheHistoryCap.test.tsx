import { KeyLowProvider, keys, useHistory, useHistoryWeek } from "@keylow/api-client";
import { TERMS_VERSION } from "@keylow/core/copy";
import { QueryClient, dehydrate, hydrate, onlineManager } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react-native";

import { createDiaryQueryClient } from "./support/diaryBackend";
import {
  historyBackend,
  historyClient,
  historyWeeks,
  resetHistoryBackend,
} from "./support/historyBackend";
import {
  createDiaryCachePersister,
  parseStoredCache,
} from "../lib/diaryCache/createDiaryCachePersister";
import { createShouldDehydrateQuery } from "../lib/diaryCache/createShouldDehydrateQuery";

import type { ReactNode } from "react";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const OWNER = "11111111-1111-4111-8111-111111111111";
const SIZE_LIMIT_BYTES = 300 * 1024;
const NEWEST_MONDAY = "2026-10-12";

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

type StoredHistoryPages = { pages: unknown[]; pageParams: unknown[] };

const isStoredHistoryPages = (value: unknown): value is StoredHistoryPages =>
  typeof value === "object" &&
  value !== null &&
  "pages" in value &&
  Array.isArray(value.pages) &&
  "pageParams" in value &&
  Array.isArray(value.pageParams);

/** The history reads of a stored cache, by key: the list's pages, and the weeks read one by one. */
function historyOf(storedText: string) {
  const queries = parseStoredCache(storedText).clientState.queries;
  const list = queries.find(({ queryKey }) => queryKey[2] === "list");
  const listData: unknown = list?.state.data;
  return {
    pages: isStoredHistoryPages(listData) ? listData.pages : [],
    pageParams: isStoredHistoryPages(listData) ? listData.pageParams : [],
    weekKeys: queries
      .map(({ queryKey }) => queryKey)
      .filter((queryKey) => queryKey[1] === "history" && queryKey[2] !== "list")
      .map((queryKey) => String(queryKey[2]))
      .sort(),
  };
}

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <KeyLowProvider client={historyClient} queryClient={queryClient}>
        {children}
      </KeyLowProvider>
    );
  };
}

/** Eight Mondays back from the newest, each read as a week of its own as the session detail will read it. */
const weekStarts = Array.from({ length: 8 }, (_, week) => {
  const monday = new Date(Date.parse(`${NEWEST_MONDAY}T00:00:00Z`) - week * 7 * 24 * 3600 * 1000);
  return monday.toISOString().slice(0, 10);
});

describe("the size of the stored history", () => {
  beforeEach(() => {
    resetHistoryBackend();
    historyBackend.sessions = historyWeeks(NEWEST_MONDAY, 8);
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
  });

  async function openEightWeeks() {
    const queryClient = createDiaryQueryClient();
    queryClient.setQueryData(keys.profiles.termsAcceptance, {
      terms_accepted_at: "2026-10-15T09:30:00+00:00",
      terms_version: TERMS_VERSION,
    });
    const { result } = await renderHook(
      () => ({
        list: useHistory({ weeks: 8 }),
        w0: useHistoryWeek(weekStarts[0] ?? ""),
        w1: useHistoryWeek(weekStarts[1] ?? ""),
        w2: useHistoryWeek(weekStarts[2] ?? ""),
        w3: useHistoryWeek(weekStarts[3] ?? ""),
        w4: useHistoryWeek(weekStarts[4] ?? ""),
        w5: useHistoryWeek(weekStarts[5] ?? ""),
        w6: useHistoryWeek(weekStarts[6] ?? ""),
        w7: useHistoryWeek(weekStarts[7] ?? ""),
      }),
      { wrapper: wrapperFor(queryClient) },
    );
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(8);
      expect(result.current.w7.data).toHaveLength(3);
    });
    return queryClient;
  }

  async function storeAndRestore(queryClient: QueryClient) {
    const storage = createFakeStorage();
    const persister = createDiaryCachePersister(storage, () => Promise.resolve(OWNER));
    await persister.persistClient({
      buster: "any",
      timestamp: Date.now(),
      clientState: dehydrate(queryClient, {
        shouldDehydrateQuery: createShouldDehydrateQuery(queryClient),
      }),
    });
    const storedText = storage.items.get("keylow.diary-cache") ?? "";
    return { storedText, restored: await persister.restoreClient() };
  }

  it("should be too big to store when eight weeks are loaded and read one by one, which is why the cap exists", async () => {
    const queryClient = await openEightWeeks();

    const uncapped = JSON.stringify(
      dehydrate(queryClient, { shouldDehydrateQuery: createShouldDehydrateQuery(queryClient) }),
    );

    expect(uncapped.length).toBeGreaterThan(SIZE_LIMIT_BYTES);
  });

  it("should store the first four pages of the list and the four newest weeks, under 300 KB", async () => {
    const queryClient = await openEightWeeks();

    const { storedText } = await storeAndRestore(queryClient);

    const stored = historyOf(storedText);
    expect(stored.pages.length).toBe(4);
    expect(stored.pageParams).toEqual([null, ...weekStarts.slice(1, 4)]);
    expect(stored.weekKeys).toEqual(weekStarts.slice(0, 4).sort());
    expect(storedText.length).toBeLessThan(SIZE_LIMIT_BYTES);
  });

  it("should keep the stored list in memory whole: only what goes to storage is cut", async () => {
    const queryClient = await openEightWeeks();

    await storeAndRestore(queryClient);

    const inMemory = queryClient.getQueryData<StoredHistoryPages>(keys.training.historyList);
    expect(inMemory?.pages.length).toBe(8);
    expect(queryClient.getQueryCache().findAll({ queryKey: keys.training.historyAll }).length).toBe(
      9,
    );
  });

  it("should show the four stored weeks after a restart with no connection, then load earlier weeks once back online", async () => {
    const stored = await storeAndRestore(await openEightWeeks());
    const restoredClient = createDiaryQueryClient();
    if (stored.restored === undefined) {
      throw new Error("The stored cache was not given back");
    }
    hydrate(restoredClient, stored.restored.clientState);
    historyBackend.requests = [];
    await act(() => {
      onlineManager.setOnline(false);
    });

    const { result } = await renderHook(() => useHistory({ weeks: 1 }), {
      wrapper: wrapperFor(restoredClient),
    });

    await waitFor(() => {
      expect(result.current.data?.length).toBe(4);
    });
    expect(result.current.data?.map(({ weekStart }) => weekStart)).toEqual(weekStarts.slice(0, 4));
    expect(result.current.hasEarlierWeeks).toBe(true);
    expect(historyBackend.requests).toEqual([]);

    await act(() => {
      onlineManager.setOnline(true);
    });
    await act(async () => {
      await result.current.loadEarlierWeeks();
    });

    await waitFor(() => {
      expect(result.current.data?.map(({ weekStart }) => weekStart)).toEqual(
        weekStarts.slice(0, 5),
      );
    });
  });

  it("should leave a cache with fewer weeks than the cap as it is", async () => {
    historyBackend.sessions = historyWeeks(NEWEST_MONDAY, 2);
    const queryClient = createDiaryQueryClient();
    const { result } = await renderHook(() => useHistory({ weeks: 2 }), {
      wrapper: wrapperFor(queryClient),
    });
    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });

    const { storedText } = await storeAndRestore(queryClient);

    expect(historyOf(storedText).pages.length).toBe(2);
  });
});
