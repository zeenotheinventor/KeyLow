// The assistant's two calls to Open Food Facts, made through the project's own `off-search` and
// `off-product` Edge Functions and never to Open Food Facts itself (ADR 0006, Amendment 3).
//
// Things to know when changing this file:
// - Each call is an HTTP request under the caller's own JWT, so the per-user and global limits, the
//   shared result store and the UK filter of `off-search` apply exactly as they do for the app, and
//   `off-product` stays the only writer of shared Open Food Facts rows. Do not import either function's
//   modules here: one code path, one limit.
// - Every failure is an answer, never a throw: a refused limit (429), a server failure, a body that is
//   not the contract, a failed connection and a call that outran its timeout are all `unavailable`, and
//   the tool answers the catalogue alone. A 404 from `off-product` is the one other outcome, `not_found`.
// - The search is capped at 4 s, because a person is waiting on a reply that has the catalogue already.
//   The product call gets 8 s, because `off-product` may have to fetch and store the product, and the
//   turn loop gives a whole tool call 20 s.
// - Nothing here logs or reports anything. The search words are the key of the shared store (see the
//   `off-search` header), and a product is the person's food, so neither goes into a log line or an
//   error, and the reason for a failure is not kept.
import { offProductResponseSchema, offSearchResponseSchema } from "../core.ts";

import type { Food, FoodPortion, OffCandidate } from "../core.ts";

export const OFF_SEARCH_TIMEOUT_MILLISECONDS = 4000;
export const OFF_PRODUCT_TIMEOUT_MILLISECONDS = 8000;

export type OffSearchOutcome =
  { status: "ok"; candidates: OffCandidate[] } | { status: "unavailable" };

export type OffProductOutcome =
  | { status: "ok"; food: Food; portions: FoodPortion[] }
  | { status: "not_found" }
  | { status: "unavailable" };

export type OffLookup = {
  search(terms: string): Promise<OffSearchOutcome>;
  product(code: string): Promise<OffProductOutcome>;
};

export type OffLookupOptions = {
  // The project's own SUPABASE_URL.
  baseUrl: string;
  // The caller's `Authorization` header as received.
  authorization: string;
  fetch?: typeof fetch;
  searchTimeoutMilliseconds?: number;
  productTimeoutMilliseconds?: number;
};

type Answer = { status: number; body: unknown };

export function createOffLookup(options: OffLookupOptions): OffLookup {
  const send = options.fetch ?? fetch;
  const functionsUrl = `${options.baseUrl.replace(/\/+$/, "")}/functions/v1`;

  // Null for a call that failed or timed out, whatever the reason.
  async function post(
    name: string,
    payload: unknown,
    timeoutMilliseconds: number,
  ): Promise<Answer | null> {
    try {
      const response = await send(`${functionsUrl}/${name}`, {
        method: "POST",
        headers: { Authorization: options.authorization, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMilliseconds),
      });
      const body: unknown = await response.json().catch(() => null);
      return { status: response.status, body };
    } catch {
      return null;
    }
  }

  return {
    async search(terms) {
      const answer = await post(
        "off-search",
        { q: terms },
        options.searchTimeoutMilliseconds ?? OFF_SEARCH_TIMEOUT_MILLISECONDS,
      );
      const parsed = offSearchResponseSchema.safeParse(answer?.body);
      return answer?.status === 200 && parsed.success
        ? { status: "ok", candidates: parsed.data.candidates }
        : { status: "unavailable" };
    },

    async product(code) {
      const answer = await post(
        "off-product",
        { code },
        options.productTimeoutMilliseconds ?? OFF_PRODUCT_TIMEOUT_MILLISECONDS,
      );
      if (answer?.status === 404) {
        return { status: "not_found" };
      }
      const parsed = offProductResponseSchema.safeParse(answer?.body);
      return answer?.status === 200 && parsed.success
        ? { status: "ok", food: parsed.data.food, portions: parsed.data.portions }
        : { status: "unavailable" };
    },
  };
}
