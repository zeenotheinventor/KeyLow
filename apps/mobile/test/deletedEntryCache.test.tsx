import { KeyLowProvider, keys, useDeleteEntry, useLogEntry } from "@keylow/api-client";
import { persistQueryClientSave } from "@tanstack/react-query-persist-client";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { DIARY_CACHE_BUSTER, createDiaryCachePersister, isPersistedQuery } from "../lib/diaryCache";
import {
  SIGNED_IN_USER_ID,
  createDiaryQueryClient,
  diaryBackend,
  resetDiaryBackend,
  sampleDay,
} from "./support/diaryBackend";
import { entryClient } from "./support/entryBackend";
import { DIARY_CACHE_STORAGE_KEY } from "../lib/diaryCache/constants";

import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

// What the phone keeps of an entry that was opened and then deleted, looked at the way the phone stores it:
// through the persister, with the options of PersistedDiaryCache.

const CHICKEN_INDEX = 3;
const CHICKEN_NAME = "Chicken breast, grilled";

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

async function storedCacheOf(queryClient: QueryClient): Promise<string> {
  const storage = createFakeStorage();
  await persistQueryClientSave({
    queryClient,
    persister: createDiaryCachePersister(storage, () => Promise.resolve(SIGNED_IN_USER_ID)),
    buster: DIARY_CACHE_BUSTER,
    dehydrateOptions: {
      shouldDehydrateQuery: isPersistedQuery,
      shouldDehydrateMutation: () => false,
    },
  });

  return storage.items.get(DIARY_CACHE_STORAGE_KEY) ?? "";
}

describe("a deleted entry in the stored cache", () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <KeyLowProvider client={entryClient} queryClient={queryClient}>
      {children}
    </KeyLowProvider>
  );

  beforeEach(() => {
    resetDiaryBackend();
    diaryBackend.entries = sampleDay();
    queryClient = createDiaryQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should hold no word of the entry once it is deleted, though its screen was closed", async () => {
    const entryId = String(diaryBackend.entries[CHICKEN_INDEX]?.["id"]);
    const opened = await renderHook(() => useLogEntry(entryId), { wrapper });
    await waitFor(() => {
      expect(opened.result.current.data?.id).toBe(entryId);
    });
    const entry = opened.result.current.data;
    // The screen is left, so the entry is no longer read, as when the person goes back to the diary.
    await opened.unmount();
    expect(await storedCacheOf(queryClient)).toContain(CHICKEN_NAME);
    if (entry === undefined || entry === null) {
      throw new Error("The entry was not read");
    }
    const deleting = await renderHook(() => useDeleteEntry(), { wrapper });

    await act(() => deleting.result.current.mutateAsync(entry));

    const stored = await storedCacheOf(queryClient);
    expect(stored).not.toContain(CHICKEN_NAME);
    expect(stored).toContain(entryId);
    expect(queryClient.getQueryData(keys.diary.entry(entryId))).toBeNull();
  });
});
