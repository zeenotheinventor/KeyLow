// off-search: live Open Food Facts text search. Given some words it returns up to 20 normalised
// candidates, for a person to pick one from. A candidate only becomes a food when off-product stores
// it, after the person picks it. The one thing this function writes is the shared store of search
// answers, `off_search_results` (ADR 0003, Amendment 16), which holds no user id.
//
// Things to know when changing this file:
// - The search is UK only (decision Q11): products OFF tags as sold in the United Kingdom. Barcode
//   lookup in off-product stays worldwide, because a scanned code is exact.
// - The search is Search-a-licious (search.openfoodfacts.org), Open Food Facts' own full-text
//   service. Its older CGI search answered HTML 503s for long stretches, so it is not used and there
//   is no fallback to it: that would add a second response shape for an endpoint that fails more
//   often than this one.
// - Search-a-licious reads `q` as a query language, so the typed words are cleaned first
//   (`normaliseOffSearchTerms`). Words that clean to nothing, such as `!!`, answer with no
//   candidates, with no limit charged and no call made.
// - A hit has no serving, packaging or `nutrition_data_per`, and often no `quantity`. A candidate
//   needs none of them, and off-product reads them when a person picks a row. Do not add a portion
//   to a candidate here.
// - `searchOff` retries once. Open Food Facts answers some outages with a 200 and an HTML
//   "temporarily unavailable" page, so a 2xx body that is not the expected JSON is an upstream
//   failure, the same as a 5xx.
// - A hit that cannot become a candidate is dropped without a word: no name, no usable code, no
//   energy value, or values the response contract rejects (an absurd energy value overflows to
//   Infinity). One bad hit never sinks the page.
// - Two raw codes can normalise to one (`012345678905` and `0012345678905`), so the first candidate
//   for a code wins and the rest are dropped. The code is the key a client lists candidates by.
// - `answerSearch` holds the order of a search. A fresh stored answer is served with no charge and
//   no call. Only a search that must reach OFF is charged, once however many attempts it takes: per
//   user first, then globally. A stale stored answer stands in for a refused charge and for a failed
//   call, and an empty one never does. A request that fails validation costs nothing, and a user
//   over their limit never reaches the global bucket.
// - A store that cannot be read or written is reported and never fails a search. The search words
//   are a row key, so nothing here may put them in a Ki-Lo log line, a report or an error message. The platform's request log of the row read does carry them, which is no new exposure.
import { requireUser } from "../_shared/auth.ts";
import { offSearchRequestSchema } from "../_shared/core.ts";
import { error, handle } from "../_shared/http.ts";
import { consume, readLimit } from "../_shared/rateLimit.ts";
import { reportError } from "../_shared/report.ts";
import { answerSearch } from "./answerSearch.ts";
import { searchOff } from "./searchOff.ts";
import { readSearchRow, storeSearchRow } from "./searchStore.ts";

const rateLimitWindowSeconds = 60;
const globalBucket = "off-search:global";
Deno.serve(
  handle("off-search", async (request) => {
    const user = await requireUser(request);
    if (user instanceof Response) {
      return user;
    }
    const typedTerms = await readSearchTerms(request);
    if (typedTerms instanceof Response) {
      return typedTerms;
    }
    return await answerSearch(user.id, typedTerms, {
      now: () => new Date(),
      readRow: readSearchRow,
      charge: chargeSearch,
      search: searchOff,
      storeRow: storeSearchRow,
      report: reportError,
    });
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

// A search that reaches Open Food Facts costs the user a hit first, and the whole service a hit second. A user who is over their
// limit never reaches the global bucket.
async function chargeSearch(userId: string): Promise<Response | null> {
  const perUserLimit = readLimit("OFF_SEARCH_PER_USER_PER_MIN", 30);
  const globalLimit = readLimit("OFF_SEARCH_GLOBAL_PER_MIN", 120);
  return (
    (await consume(`off-search:user:${userId}`, perUserLimit, rateLimitWindowSeconds)) ??
    (await consume(globalBucket, globalLimit, rateLimitWindowSeconds))
  );
}
