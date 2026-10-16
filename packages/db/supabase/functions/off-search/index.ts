// off-search: live Open Food Facts text search. Given some words it returns up to 20 normalised
// candidates, for a person to pick one from. It never writes to the database: a candidate only
// becomes a food when off-product stores it, after the person picks it.
//
// Things to know when changing this file:
// - The search is UK only (decision Q11): products OFF tags as sold in the United Kingdom. Barcode
//   lookup in off-product stays worldwide, because a scanned code is exact.
// - `/cgi/search.pl` is the only server-side full-text search OFF has. Its documentation calls it
//   legacy and "not recommended for new integrations", and points at Search-a-licious
//   (search.openfoodfacts.org) for new full-text work. It still answers, and it is the endpoint the
//   core normaliser's payload schema was written against.
// - Open Food Facts answers some outages with a 200 and an HTML "temporarily unavailable" page, so
//   a 2xx body that is not the expected JSON is an upstream failure, the same as a 5xx.
// - `action=process` is the form parameter OFF documents for running a search, next to `json=1`.
// - A product that cannot become a candidate is dropped without a word: no name, no usable code, or
//   values the response contract rejects (an absurd energy value overflows to Infinity). One bad
//   product never sinks the page.
// - Two raw codes can normalise to one (`012345678905` and `0012345678905`), so the first candidate
//   for a code wins and the rest are dropped. The code is the key a client lists candidates by.
// - Searches are charged before OFF is called: per user first, then globally. A request that fails
//   validation costs nothing, and a user over their limit never reaches the global bucket.
import { z } from "zod";

import { requireUser } from "../_shared/auth.ts";
import {
  normaliseOffCandidate,
  offCandidateSchema,
  offProductPayloadSchema,
  offSearchRequestSchema,
  offSearchResponseSchema,
} from "../_shared/core.ts";
import { error, handle, json } from "../_shared/http.ts";
import { offRequest } from "../_shared/off.ts";
import { reportError } from "../_shared/report.ts";
import { consume, readLimit } from "../_shared/rateLimit.ts";

type OffCandidate = z.infer<typeof offCandidateSchema>;

const rateLimitWindowSeconds = 60;
const globalBucket = "off-search:global";
const pageSize = 20;

// Exactly what offProductPayloadSchema reads, so the two cannot drift apart.
const offFields = Object.keys(offProductPayloadSchema.shape);

// OFF's own filter syntax: products whose `countries` tags contain the United Kingdom.
const unitedKingdomFilter = {
  tagtype_0: "countries",
  tag_contains_0: "contains",
  tag_0: "united-kingdom",
};

// Each product is checked by the normaliser, so the list only has to be a list.
const offSearchAnswerSchema = z.object({ products: z.array(z.unknown()) });

Deno.serve(
  handle("off-search", async (request) => {
    const user = await requireUser(request);
    if (user instanceof Response) {
      return user;
    }
    const searchTerms = await readSearchTerms(request);
    if (searchTerms instanceof Response) {
      return searchTerms;
    }

    const refused = await chargeSearch(user.id);
    if (refused !== null) {
      return refused;
    }
    const found = await searchOff(searchTerms);
    return found.ok ? respond(found.products) : found.failure;
  }),
);

async function readSearchTerms(request: Request): Promise<string | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("invalid_request", "The request body must be JSON.");
  }
  const parsed = offSearchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return error("invalid_request", "Send a search of 2 to 100 characters.");
  }
  return parsed.data.q;
}

// A search costs the user a hit first, and the whole service a hit second. A user who is over their
// limit never reaches the global bucket.
async function chargeSearch(userId: string): Promise<Response | null> {
  const perUserLimit = readLimit("OFF_SEARCH_PER_USER_PER_MIN", 4);
  const globalLimit = readLimit("OFF_SEARCH_GLOBAL_PER_MIN", 8);
  return (
    (await consume(`off-search:user:${userId}`, perUserLimit, rateLimitWindowSeconds)) ??
    (await consume(globalBucket, globalLimit, rateLimitWindowSeconds))
  );
}

async function searchOff(
  searchTerms: string,
): Promise<{ ok: true; products: unknown[] } | { ok: false; failure: Response }> {
  const result = await offRequest("/cgi/search.pl", {
    functionName: "off-search",
    fields: offFields,
    searchParams: {
      search_terms: searchTerms,
      search_simple: "1",
      action: "process",
      json: "1",
      page_size: String(pageSize),
      ...unitedKingdomFilter,
    },
  });
  if (!result.ok) {
    return result;
  }
  try {
    const answer = offSearchAnswerSchema.parse(await result.response.json());
    return { ok: true, products: answer.products };
  } catch (caught) {
    reportError("off-search", "upstream_error", caught);
    return {
      ok: false,
      failure: error("upstream_error", "Open Food Facts answered in an unexpected form."),
    };
  }
}

// Every candidate is checked against the contract on its own, so a value the contract rejects drops
// that product only. The final parse then cannot fail, and the function can never send a shape the
// client rejects.
function respond(products: unknown[]): Response {
  const candidates = new Map<string, OffCandidate>();
  for (const product of products) {
    const normalised = offCandidateSchema.safeParse(normaliseOffCandidate(product));
    if (normalised.success && !candidates.has(normalised.data.code)) {
      candidates.set(normalised.data.code, normalised.data);
    }
  }
  return json(offSearchResponseSchema.parse({ candidates: [...candidates.values()] }));
}
