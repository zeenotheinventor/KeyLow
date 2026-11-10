import { offSearchResponseSchema } from "../schemas/off";

import type { OffCandidate } from "../schemas/off";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** A row with candidates answers a search outright for this long. */
export const OFF_SEARCH_FRESH_MS = DAY_MS;
/** A row with no candidates answers for this long. It is never served as a stand-in for a failure. */
export const OFF_SEARCH_EMPTY_FRESH_MS = HOUR_MS;
/** A row this old or older is not used, and the writer deletes it. */
export const OFF_SEARCH_KEEP_MS = 14 * DAY_MS;
/** The same horizon in seconds, which is what `store_off_search_results` takes. */
export const OFF_SEARCH_KEEP_SECONDS = OFF_SEARCH_KEEP_MS / 1000;

const MIN_QUERY_KEY_LENGTH = 2;
const MAX_QUERY_KEY_LENGTH = 100;

export type OffSearchRowState = "fresh" | "stale" | "not_usable";

/**
 * Whether a stored search can answer. A row with candidates is fresh under 24 hours and stale until
 * 14 days. An empty row is fresh under an hour and otherwise not usable, because "no results" in
 * place of a failure would be a lie. A row at exactly a boundary counts as the older state, and a
 * fetch time that cannot be read is not usable. The caller passes `now`, because core never reads
 * the clock.
 */
export function offSearchRowState(
  row: { candidateCount: number; fetchedAt: string | Date },
  now: Date,
): OffSearchRowState {
  const age = now.getTime() - new Date(row.fetchedAt).getTime();
  if (!(age < OFF_SEARCH_KEEP_MS)) {
    return "not_usable";
  }
  if (row.candidateCount === 0) {
    return age < OFF_SEARCH_EMPTY_FRESH_MS ? "fresh" : "not_usable";
  }
  return age < OFF_SEARCH_FRESH_MS ? "fresh" : "stale";
}

export type StoredOffSearch = { state: "fresh" | "stale"; candidates: OffCandidate[] };

/**
 * Reads a row of `off_search_results`. A row that is not usable, or whose candidates no longer
 * parse against the response contract, is a miss (`null`), never an error. That is what lets the
 * candidate schema change without a migration.
 */
export function readStoredOffSearch(
  row: { candidates: unknown; fetched_at: string },
  now: Date,
): StoredOffSearch | null {
  const parsed = offSearchResponseSchema.safeParse({ candidates: row.candidates });
  if (!parsed.success) {
    return null;
  }
  const { candidates } = parsed.data;
  const state = offSearchRowState(
    { candidateCount: candidates.length, fetchedAt: row.fetched_at },
    now,
  );
  return state === "not_usable" ? null : { state, candidates };
}

/**
 * The key a search is stored under: the cleaned words (`normaliseOffSearchTerms`), or `null` when
 * the table's 2 to 100 character check would refuse them. Such a search is neither read nor stored.
 * Length counts characters, as Postgres does, and not UTF-16 units.
 */
export function offSearchQueryKey(cleanTerms: string): string | null {
  const length = Array.from(cleanTerms).length;
  return length >= MIN_QUERY_KEY_LENGTH && length <= MAX_QUERY_KEY_LENGTH ? cleanTerms : null;
}
