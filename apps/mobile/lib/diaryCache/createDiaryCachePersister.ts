import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";

import { DIARY_CACHE_STORAGE_KEY } from "./constants";
import { hasCurrentTermsAcceptance } from "./hasCurrentTermsAcceptance";

import type {
  AsyncStorage,
  PersistedClient,
  Persister,
} from "@tanstack/react-query-persist-client";

// Serialised in place of a cache with no queries, which the storage adapter removes instead of storing.
const EMPTY_CACHE = "";

// Fixed, so a damaged cache never puts a piece of its health data into an error that gets logged.
const UNREADABLE_CACHE_MESSAGE = "The stored diary cache could not be read";

function isPersistedClient(value: unknown): value is PersistedClient {
  return (
    typeof value === "object" &&
    value !== null &&
    "timestamp" in value &&
    typeof value.timestamp === "number" &&
    "buster" in value &&
    typeof value.buster === "string" &&
    "clientState" in value &&
    typeof value.clientState === "object" &&
    value.clientState !== null &&
    "queries" in value.clientState &&
    Array.isArray(value.clientState.queries)
  );
}

/** Reads a stored cache, or fails with a message that holds none of it. */
export function parseStoredCache(stored: string): PersistedClient {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    throw new Error(UNREADABLE_CACHE_MESSAGE);
  }
  if (!isPersistedClient(parsed)) {
    throw new Error(UNREADABLE_CACHE_MESSAGE);
  }

  return parsed;
}

/**
 * The persister of the diary cache, over a private key-value storage. Saves are throttled by the
 * library, and an empty cache is removed rather than stored, so after a sign out the last save
 * leaves nothing behind. A stored cache is read only when its account has accepted the current Terms.
 */
export function createDiaryCachePersister(storage: AsyncStorage): Persister {
  const stored = createAsyncStoragePersister({
    storage: {
      getItem: (key) => storage.getItem(key),
      setItem: (key, value) =>
        value === EMPTY_CACHE ? storage.removeItem(key) : storage.setItem(key, value),
      removeItem: (key) => storage.removeItem(key),
    },
    key: DIARY_CACHE_STORAGE_KEY,
    serialize: (client) =>
      client.clientState.queries.length === 0 ? EMPTY_CACHE : JSON.stringify(client),
    deserialize: parseStoredCache,
  });

  return {
    persistClient: stored.persistClient,
    restoreClient: async () => {
      const client = await stored.restoreClient();
      if (client === undefined) {
        return undefined;
      }
      if (!hasCurrentTermsAcceptance(client.clientState)) {
        await stored.removeClient();
        return undefined;
      }

      return client;
    },
    removeClient: stored.removeClient,
  };
}
