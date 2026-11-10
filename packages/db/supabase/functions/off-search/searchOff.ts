// The call to Search-a-licious, with one short retry. The retry lives here and not in `offRequest`,
// whose header leaves retries to its callers. A search is read-only, so repeating it is safe.
import { z } from "zod";

import { OFF_SEARCH_FIELDS, buildOffSearchQuery } from "../_shared/core.ts";
import { error } from "../_shared/http.ts";
import { offRequest } from "../_shared/off.ts";
import { reportError } from "../_shared/report.ts";

import type { OffResult } from "../_shared/off.ts";

export type OffSearchOutcome = { ok: true; hits: unknown[] } | { ok: false; failure: Response };

const searchBaseUrl = "https://search.openfoodfacts.org";
const pageSize = 20;
const maxAttempts = 2;
const attemptTimeoutMilliseconds = 2500;
const retryDelayMilliseconds = 250;

// Each hit is checked by the normaliser, so the list only has to be a list. A search that
// Search-a-licious gave up on says so in `timed_out`, and what it found is then partial.
const searchAnswerSchema = z.object({
  hits: z.array(z.unknown()),
  timed_out: z.boolean().optional(),
});

type Attempt = { outcome: OffSearchOutcome; retryable: boolean };

function unexpectedForm(): Attempt {
  return {
    outcome: {
      ok: false,
      failure: error("upstream_error", "Open Food Facts answered in an unexpected form."),
    },
    retryable: true,
  };
}

// A network error, a timeout and a 5xx are worth another try. A 429 or another 4xx would only
// answer the same again, and a 429 must not be hammered.
function isRetryable(failed: Extract<OffResult, { ok: false }>): boolean {
  return failed.upstreamStatus === undefined || failed.upstreamStatus >= 500;
}

async function attemptSearch(cleanTerms: string): Promise<Attempt> {
  const result = await offRequest("/search", {
    functionName: "off-search",
    baseUrl: searchBaseUrl,
    fields: OFF_SEARCH_FIELDS,
    searchParams: { q: buildOffSearchQuery(cleanTerms), page_size: String(pageSize) },
    timeoutMilliseconds: attemptTimeoutMilliseconds,
    // The failure of a search is reported once, below, and only when the last attempt failed.
    reportFailures: false,
  });
  if (!result.ok) {
    return { outcome: result, retryable: isRetryable(result) };
  }
  try {
    const answer = searchAnswerSchema.parse(await result.response.json());
    return answer.timed_out === true
      ? unexpectedForm()
      : { outcome: { ok: true, hits: answer.hits }, retryable: false };
  } catch {
    return unexpectedForm();
  }
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/**
 * Searches Open Food Facts for `cleanTerms` (see `normaliseOffSearchTerms`) and returns the raw
 * hits. Makes two attempts at most. The second follows only a retryable failure, after a short
 * pause. `reportError` fires once, and only when the last attempt failed. A 429 is reported by
 * `offRequest` itself, because it is never retried.
 */
export async function searchOff(cleanTerms: string): Promise<OffSearchOutcome> {
  let attempt = await attemptSearch(cleanTerms);
  for (let made = 1; made < maxAttempts && !attempt.outcome.ok && attempt.retryable; made += 1) {
    await pause(retryDelayMilliseconds);
    attempt = await attemptSearch(cleanTerms);
  }
  const { outcome } = attempt;
  if (!outcome.ok && outcome.failure.status !== 429) {
    reportError("off-search", "upstream_error", new Error("Open Food Facts search failed"));
  }
  return outcome;
}
