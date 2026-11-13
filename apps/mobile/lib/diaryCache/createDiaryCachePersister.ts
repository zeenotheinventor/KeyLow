import { keys } from "@keylow/api-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";

import { DIARY_CACHE_MAX_AGE_MS, DIARY_CACHE_STORAGE_KEY } from "./constants";
import { hasCurrentTermsAcceptance } from "./hasCurrentTermsAcceptance";
import { queryKeyStartsWith } from "./queryKeyStartsWith";

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

/**
 * Reads the stored text, and discards it when there is none to use. A null answer from the encrypted
 * storage means the ciphertext has no key (a restore from a backup, a reinstall, a cleared keychain) or
 * that nothing is stored, and a throw means the keychain could not be read (on Android, a keystore key
 * that is gone). Either way the leftover ciphertext and key are removed and the app starts from the
 * network. Nothing is logged: neither the stored text nor an error from the keychain may reach a log.
 */
async function readOrDiscard(storage: AsyncStorage, key: string): Promise<string | null> {
  let storedText: string | null | undefined = null;
  try {
    storedText = await storage.getItem(key);
  } catch {
    storedText = null;
  }
  if (storedText === null || storedText === undefined) {
    try {
      await storage.removeItem(key);
    } catch {
      // Nothing more can be done, and nothing may be logged.
    }

    return null;
  }

  return storedText;
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

// What of the history is stored: the first pages of the list, which are its newest weeks, and the newest
// weeks read one by one. A user who loads earlier weeks one after another would otherwise store their whole
// history under the one key, at over 700 KB for half a year. The last page stored still carries the week
// before it, so "Load earlier weeks" works after a restore.
const STORED_HISTORY_WEEKS = 4;

const isHistoryListKey = (queryKey: readonly unknown[]) =>
  queryKeyStartsWith(queryKey, keys.training.historyList);

const isHistoryWeekKey = (queryKey: readonly unknown[]) =>
  queryKeyStartsWith(queryKey, keys.training.historyAll) && !isHistoryListKey(queryKey);

type DehydratedQuery = PersistedClient["clientState"]["queries"][number];

function withFirstPagesOnly(query: DehydratedQuery): DehydratedQuery {
  const { data } = query.state;
  if (
    typeof data !== "object" ||
    data === null ||
    !("pages" in data) ||
    !Array.isArray(data.pages) ||
    !("pageParams" in data) ||
    !Array.isArray(data.pageParams)
  ) {
    return query;
  }

  return {
    ...query,
    state: {
      ...query.state,
      data: {
        pages: data.pages.slice(0, STORED_HISTORY_WEEKS),
        pageParams: data.pageParams.slice(0, STORED_HISTORY_WEEKS),
      },
    },
  };
}

// A week's key ends in its Monday, `YYYY-MM-DD`, which sorts as plain text.
const weekOf = (query: DehydratedQuery) => String(query.queryKey[2]);

const compareNewestFirst = (first: string, second: string) =>
  first < second ? 1 : first > second ? -1 : 0;

/** The queries to store, with the history held to its newest weeks. A week's key ends in its Monday, `YYYY-MM-DD`. */
function cappedHistory(queries: DehydratedQuery[]): DehydratedQuery[] {
  const newestWeeks = queries
    .filter(({ queryKey }) => isHistoryWeekKey(queryKey))
    .sort((first, second) => compareNewestFirst(weekOf(first), weekOf(second)))
    .slice(0, STORED_HISTORY_WEEKS);

  return queries
    .filter((query) => !isHistoryWeekKey(query.queryKey) || newestWeeks.includes(query))
    .map((query) => (isHistoryListKey(query.queryKey) ? withFirstPagesOnly(query) : query));
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
 * removed before it reaches memory. Each query is also held to the age limit by its own
 * `dataUpdatedAt`: the limit on the stored cache as a whole runs from its last save, which every
 * change renews, so on its own it would let a query's data grow older than the limit.
 * `readStoredUserId` must answer from the phone's own storage,
 * so it knows the account at a start with no connection too.
 */
export function createDiaryCachePersister(
  storage: AsyncStorage,
  readStoredUserIdFromStorage: () => Promise<string | null>,
): Persister {
  // A read that fails is a user that is not known, which stores nothing and reads nothing back.
  const readStoredUserId = () => readStoredUserIdFromStorage().catch(() => null);
  const stored = createAsyncStoragePersister({
    storage: {
      getItem: (key) => readOrDiscard(storage, key),
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

      return JSON.stringify({
        ...client,
        clientState: { ...client.clientState, queries: cappedHistory(client.clientState.queries) },
        buster: `${client.buster}${OWNER_SEPARATOR}${ownerId}`,
      });
    },
    deserialize: parseStoredCache,
  });

  return {
    persistClient: stored.persistClient,
    restoreClient: async () => {
      // Text that does not read as a cache (a plaintext blob of an earlier build, a damaged one) is removed
      // here as well as by the caller, so it never stays on the phone.
      let client: PersistedClient | undefined;
      try {
        client = await stored.restoreClient();
      } catch (error) {
        await stored.removeClient();
        throw error;
      }
      if (client === undefined) {
        return undefined;
      }
      const separatorIndex = client.buster.lastIndexOf(OWNER_SEPARATOR);
      const ownerId = separatorIndex === -1 ? null : client.buster.slice(separatorIndex + 1);
      const signedInUserId = await readStoredUserId();
      const isOwnedBySignedInUser =
        ownerId !== null && signedInUserId !== null && ownerId === signedInUserId;
      const oldestAllowed = Date.now() - DIARY_CACHE_MAX_AGE_MS;
      const clientState = {
        ...client.clientState,
        queries: client.clientState.queries.filter(
          ({ state }) => state.dataUpdatedAt >= oldestAllowed,
        ),
      };
      if (!isOwnedBySignedInUser || !hasCurrentTermsAcceptance(clientState)) {
        await stored.removeClient();
        return undefined;
      }

      return { ...client, clientState, buster: client.buster.slice(0, separatorIndex) };
    },
    removeClient: stored.removeClient,
  };
}
