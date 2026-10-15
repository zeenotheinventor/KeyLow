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

// Joins the buster and the owner, which no buster or user id (a UUID) contains.
const OWNER_SEPARATOR = "|";

/**
 * The persister of the diary cache, over a private key-value storage. Saves are throttled by the
 * library, and an empty cache is removed rather than stored, so after a sign out the last save
 * leaves nothing behind.
 *
 * Whose cache it is travels with it, joined to the buster. A save with no one signed in stores nothing.
 * A stored cache is read only when it was stored by the account that is signed in now, and only when
 * that account has accepted the current Terms. Anything else (another account, no account known) is
 * removed before it reaches memory. `readStoredUserId` must answer from the phone's own storage,
 * so it knows the account at a start with no connection too.
 */
export function createDiaryCachePersister(
  storage: AsyncStorage,
  readStoredUserId: () => Promise<string | null>,
): Persister {
  const stored = createAsyncStoragePersister({
    storage: {
      getItem: (key) => storage.getItem(key),
      setItem: (key, value) =>
        value === EMPTY_CACHE ? storage.removeItem(key) : storage.setItem(key, value),
      removeItem: (key) => storage.removeItem(key),
    },
    key: DIARY_CACHE_STORAGE_KEY,
    serialize: async (client) => {
      const ownerId = await readStoredUserId();
      if (ownerId === null || client.clientState.queries.length === 0) {
        return EMPTY_CACHE;
      }

      return JSON.stringify({ ...client, buster: `${client.buster}${OWNER_SEPARATOR}${ownerId}` });
    },
    deserialize: parseStoredCache,
  });

  return {
    persistClient: stored.persistClient,
    restoreClient: async () => {
      const client = await stored.restoreClient();
      if (client === undefined) {
        return undefined;
      }
      const separatorIndex = client.buster.lastIndexOf(OWNER_SEPARATOR);
      const ownerId = separatorIndex === -1 ? null : client.buster.slice(separatorIndex + 1);
      const signedInUserId = await readStoredUserId();
      const isOwnedBySignedInUser =
        ownerId !== null && signedInUserId !== null && ownerId === signedInUserId;
      if (!isOwnedBySignedInUser || !hasCurrentTermsAcceptance(client.clientState)) {
        await stored.removeClient();
        return undefined;
      }

      return { ...client, buster: client.buster.slice(0, separatorIndex) };
    },
    removeClient: stored.removeClient,
  };
}
