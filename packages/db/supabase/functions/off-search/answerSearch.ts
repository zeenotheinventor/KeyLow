// The order of one search (ADR 0003, Amendment 16). Everything the search touches is passed in, so
// a test can script each step and read what the search did.
import {
  normaliseOffSearchHit,
  normaliseOffSearchTerms,
  offCandidateSchema,
  offSearchQueryKey,
  offSearchResponseSchema,
  readStoredOffSearch,
} from "../_shared/core.ts";
import { json } from "../_shared/http.ts";

import type { OffCandidate } from "../_shared/core.ts";
import type { ReportError } from "../_shared/report.ts";
import type { OffSearchOutcome } from "./searchOff.ts";
import type { StoredSearchRow } from "./searchStore.ts";

export type SearchDependencies = {
  now: () => Date;
  // Throws when the database fails.
  readRow: (queryKey: string) => Promise<StoredSearchRow | null>;
  // Spends the limits. Returns null when the search may go ahead, or the 429 to send.
  charge: (userId: string) => Promise<Response | null>;
  search: (searchTerms: string) => Promise<OffSearchOutcome>;
  // Throws when the database fails.
  storeRow: (queryKey: string, candidates: OffCandidate[]) => Promise<void>;
  report: ReportError;
};

/**
 * Answers a search from the shared store when it can, and from Open Food Facts when it cannot.
 * - A fresh row answers outright, charging nothing and calling nothing.
 * - A refused charge, or a failed call to Open Food Facts, answers the stale row if there is one.
 * - A search that succeeds is stored, then answered. A failed search stores nothing.
 * - A read or a store that fails is reported and never fails the search. The report names the
 *   function and the code and never the search words or the database's message.
 */
export async function answerSearch(
  userId: string,
  typedTerms: string,
  dependencies: SearchDependencies,
): Promise<Response> {
  const searchTerms = normaliseOffSearchTerms(typedTerms);
  if (searchTerms === "") {
    return respond([]);
  }

  const queryKey = offSearchQueryKey(searchTerms);
  const stored = queryKey === null ? null : await readStoredSearch(queryKey, dependencies);
  if (stored?.state === "fresh") {
    return respond(stored.candidates);
  }
  const staleAnswer = () => (stored === null ? null : respond(stored.candidates));

  const refused = await dependencies.charge(userId);
  if (refused !== null) {
    return staleAnswer() ?? refused;
  }

  const found = await dependencies.search(searchTerms);
  if (!found.ok) {
    return staleAnswer() ?? found.failure;
  }
  const candidates = candidatesFrom(found.hits);
  if (queryKey !== null) {
    await storeSearch(queryKey, candidates, dependencies);
  }
  return respond(candidates);
}

async function readStoredSearch(queryKey: string, dependencies: SearchDependencies) {
  try {
    const row = await dependencies.readRow(queryKey);
    return row === null ? null : readStoredOffSearch(row, dependencies.now());
  } catch (caught) {
    dependencies.report("off-search", "internal_error", caught);
    return null;
  }
}

async function storeSearch(
  queryKey: string,
  candidates: OffCandidate[],
  dependencies: SearchDependencies,
): Promise<void> {
  try {
    await dependencies.storeRow(queryKey, candidates);
  } catch (caught) {
    dependencies.report("off-search", "internal_error", caught);
  }
}

// Every candidate is checked against the contract on its own, so a value the contract rejects drops
// that hit only. Two raw codes can normalise to one, so the first candidate for a code wins.
function candidatesFrom(hits: unknown[]): OffCandidate[] {
  const candidates = new Map<string, OffCandidate>();
  for (const hit of hits) {
    const normalised = offCandidateSchema.safeParse(normaliseOffSearchHit(hit));
    if (normalised.success && !candidates.has(normalised.data.code)) {
      candidates.set(normalised.data.code, normalised.data);
    }
  }
  return [...candidates.values()];
}

// The final parse cannot fail on candidates that came from `candidatesFrom` or from a row that
// parsed, so the function can never send a shape the client rejects.
function respond(candidates: OffCandidate[]): Response {
  return json(offSearchResponseSchema.parse({ candidates }));
}
