import { OFF_SEARCH_FIELDS, edgeErrorSchema, offSearchResponseSchema } from "@keylow/core";
import { afterAll, describe, expect, it } from "vitest";

import { generateBarcode } from "../support/barcodes";
import { deleteGeneratedFoods } from "../support/foods";
import { callFunction } from "../support/functionClient";
import { offMock } from "../support/offMock";
import { waitForFreshRateLimitWindow } from "../support/rateLimitWindow";
import { adminClient } from "../support/stack";
import { requireFunctionEnvironmentValue } from "../support/testEnvironment";
import { createTestUser, deleteCreatedTestUsers } from "../support/users";

const configuredUserAgent = requireFunctionEnvironmentValue("OFF_USER_AGENT");
const perUserLimit = Number(requireFunctionEnvironmentValue("OFF_SEARCH_PER_USER_PER_MIN"));

afterAll(async () => {
  try {
    await deleteGeneratedFoods();
  } finally {
    await deleteCreatedTestUsers();
  }
});

async function newUser() {
  return await createTestUser("k52");
}

// Every test searches for its own words, so the mock can tell the tests apart and a search for one
// test never answers another's.
function uniqueSearchTerms(): string {
  return `oat ${crypto.randomUUID()}`;
}

async function search(q: unknown, accessToken: string) {
  return await callFunction("off-search", { accessToken, body: { q } });
}

async function readFoodsForCodes(codes: string[]) {
  const list = codes.join(",");
  const { data, error } = await adminClient()
    .from("foods")
    .select("id, source, source_ref, barcode")
    .or(`barcode.in.(${list}),source_ref.in.(${list})`);
  if (error) {
    throw new Error("Could not read the foods", { cause: error });
  }
  return data;
}

describe("off-search", () => {
  describe("the candidates", () => {
    it("returns each product normalised, in the order OFF sent them", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      const [oatCode, kilojouleCode] = [generateBarcode(), generateBarcode()];
      await offMock.registerSearch({
        searchTerms,
        products: [
          { code: oatCode, fixture: "kcal-present" },
          { code: kilojouleCode, fixture: "kj-only" },
        ],
      });

      const response = await search(searchTerms, user.accessToken);

      expect(response.status).toBe(200);
      const { candidates } = offSearchResponseSchema.parse(response.body);
      expect(candidates.map(({ code }) => code)).toEqual([oatCode, kilojouleCode]);
      expect(candidates[0]).toMatchObject({
        code: oatCode,
        name: "Test Oat Crunch",
        brand: "Northfield Mills",
        basis: "per_100g",
        kcal: 380,
        protein_g: 9.5,
        fat_g: 7.5,
        carbs_g: 62,
        fibre_g: 8,
      });
      expect(candidates[0]?.quality).toEqual({});
    });

    it("shows the kcal of a product that only has kilojoules", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      const code = generateBarcode();
      await offMock.registerSearch({ searchTerms, products: [{ code, fixture: "kj-only" }] });

      const response = await search(searchTerms, user.accessToken);

      const { candidates } = offSearchResponseSchema.parse(response.body);
      expect(candidates[0]?.kcal).toBeCloseTo(1046 / 4.184, 5);
    });

    it("takes the brand from the brands array Search-a-licious sends", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      const code = generateBarcode();
      await offMock.registerSearch({
        searchTerms,
        products: [
          {
            code,
            fixture: "kcal-present",
            productOverrides: { brands: ["Aldi", "Cowbelle"] },
          },
        ],
      });

      const response = await search(searchTerms, user.accessToken);

      const { candidates } = offSearchResponseSchema.parse(response.body);
      expect(candidates[0]?.brand).toBe("Aldi");
    });

    it("drops a hit with no energy and no macros, and keeps the others", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      const [emptyCode, keptCode] = [generateBarcode(), generateBarcode()];
      await offMock.registerSearch({
        searchTerms,
        products: [
          { code: emptyCode, fixture: "empty-nutriments" },
          { code: keptCode, fixture: "kcal-present" },
        ],
      });

      const response = await search(searchTerms, user.accessToken);

      const { candidates } = offSearchResponseSchema.parse(response.body);
      expect(candidates.map(({ code }) => code)).toEqual([keptCode]);
    });

    it("flags a product missing its protein as suspect, with protein_g null", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      const code = generateBarcode();
      await offMock.registerSearch({
        searchTerms,
        products: [{ code, fixture: "missing-protein" }],
      });

      const response = await search(searchTerms, user.accessToken);

      const { candidates } = offSearchResponseSchema.parse(response.body);
      expect(candidates[0]?.protein_g).toBeNull();
      expect(candidates[0]?.quality).toMatchObject({
        suspect: true,
        fields_missing: ["protein_g"],
      });
    });

    it("drops a product with no name and a product with no usable code", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      const [keptCode, nameless, codeless] = [
        generateBarcode(),
        generateBarcode(),
        generateBarcode(),
      ];
      await offMock.registerSearch({
        searchTerms,
        products: [
          { code: nameless, fixture: "no-name" },
          { code: codeless, fixture: "kcal-present", productOverrides: { code: "not-a-code" } },
          { code: keptCode, fixture: "kcal-present" },
        ],
      });

      const response = await search(searchTerms, user.accessToken);

      expect(response.status).toBe(200);
      const { candidates } = offSearchResponseSchema.parse(response.body);
      expect(candidates.map(({ code }) => code)).toEqual([keptCode]);
    });

    it("drops a product whose values cannot be sent, and still returns the others", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      const [absurdCode, keptCode] = [generateBarcode(), generateBarcode()];
      await offMock.registerSearch({
        searchTerms,
        products: [
          {
            code: absurdCode,
            fixture: "kj-only",
            // Divided into kcal this overflows to Infinity, which the response contract rejects.
            productOverrides: {
              nutriments: {
                "energy-kj_100g": 1e305,
                proteins_100g: 10,
                fat_100g: 5,
                carbohydrates_100g: 20,
                fiber_100g: 3,
              },
            },
          },
          { code: keptCode, fixture: "kcal-present" },
        ],
      });

      const response = await search(searchTerms, user.accessToken);

      expect(response.status).toBe(200);
      const { candidates } = offSearchResponseSchema.parse(response.body);
      expect(candidates.map(({ code }) => code)).toEqual([keptCode]);
    });

    it("returns one candidate for two raw codes that normalise to the same code, the first one", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      const otherCode = generateBarcode();
      await offMock.registerSearch({
        searchTerms,
        products: [
          {
            code: "012345678905",
            fixture: "kcal-present",
            productOverrides: { product_name_en: "First Oat" },
          },
          {
            code: "0012345678905",
            fixture: "kcal-present",
            productOverrides: { product_name_en: "Second Oat" },
          },
          { code: otherCode, fixture: "kj-only" },
        ],
      });

      const response = await search(searchTerms, user.accessToken);

      expect(response.status).toBe(200);
      const { candidates } = offSearchResponseSchema.parse(response.body);
      expect(candidates.map(({ code, name }) => [code, name])).toEqual([
        ["0012345678905", "First Oat"],
        [otherCode, "Kilojoule Bar"],
      ]);
    });

    it("answers 200 with no candidates when OFF finds nothing", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({ searchTerms, products: [] });

      const response = await search(searchTerms, user.accessToken);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ candidates: [] });
    });

    it("never stores anything: no food exists for the codes it returned", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      const codes = [generateBarcode(), generateBarcode(), generateBarcode()];
      await offMock.registerSearch({
        searchTerms,
        products: [
          { code: codes[0] ?? "", fixture: "kcal-present" },
          { code: codes[1] ?? "", fixture: "kj-only" },
          { code: codes[2] ?? "", fixture: "missing-protein" },
        ],
      });

      const response = await search(searchTerms, user.accessToken);

      expect(offSearchResponseSchema.parse(response.body).candidates).toHaveLength(3);
      expect(await readFoodsForCodes(codes)).toEqual([]);
    });
  });

  describe("the request to Open Food Facts", () => {
    it("is a UK-only food search of Search-a-licious with the configured User-Agent and a page of 20", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({ searchTerms, products: [] });

      await search(searchTerms, user.accessToken);

      const calls = await offMock.searchCalls(searchTerms);
      expect(calls).toHaveLength(1);
      expect(calls[0]?.url).toMatch(/^\/search\?/);
      expect(calls[0]?.headers["user-agent"]).toBe(configuredUserAgent);
      expect(calls[0]?.query).toMatchObject({
        q: `${searchTerms} countries_tags:"en:united-kingdom" nutriments:*`,
        page_size: "20",
      });
    });

    it("asks for exactly the fields the index holds and a candidate reads", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({ searchTerms, products: [] });

      await search(searchTerms, user.accessToken);

      const [call] = await offMock.searchCalls(searchTerms);
      expect(call?.query["fields"]?.split(",")).toEqual([...OFF_SEARCH_FIELDS]);
    });

    it("searches for the trimmed words", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({ searchTerms, products: [] });

      const response = await search(`  ${searchTerms}  `, user.accessToken);

      expect(response.status).toBe(200);
      expect(await offMock.searchCalls(searchTerms)).toHaveLength(1);
    });

    it("cleans the typed words, so a stray bracket and capitals search for the plain words", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({ searchTerms, products: [] });

      const response = await search(
        `(${searchTerms.toUpperCase().replace(" ", "  ")}`,
        user.accessToken,
      );

      expect(response.status).toBe(200);
      expect(await offMock.searchCalls(searchTerms)).toHaveLength(1);
    });

    it("answers no candidates, with no call and no limit spent, for words that clean to nothing", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({ searchTerms, products: [] });

      for (let attempt = 0; attempt <= perUserLimit; attempt += 1) {
        const response = await search("!!", user.accessToken);
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ candidates: [] });
      }
      const allowed = await search(searchTerms, user.accessToken);

      expect(allowed.status).toBe(200);
      expect(await offMock.searchCalls("")).toEqual([]);
    });
  });

  describe("when Open Food Facts fails", () => {
    // The answer a retry gets when OFF has recovered.
    const recoveredAnswer = {
      products: [{ code: generateBarcode(), fixture: "kcal-present" }],
    };

    function expectUpstreamError(response: Awaited<ReturnType<typeof search>>) {
      expect(response.status).toBe(502);
      expect(edgeErrorSchema.parse(response.body).error.code).toBe("upstream_error");
    }

    it("answers 200 after two calls when OFF answers 500 and then recovers", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({
        searchTerms,
        status: 500,
        body: { error: "down" },
        followedBy: [recoveredAnswer],
      });

      const response = await search(searchTerms, user.accessToken);

      expect(response.status).toBe(200);
      expect(offSearchResponseSchema.parse(response.body).candidates).toHaveLength(1);
      expect(await offMock.searchCalls(searchTerms)).toHaveLength(2);
    });

    it("answers 502 upstream_error after two calls when OFF answers 500 both times", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({ searchTerms, status: 500, body: { error: "down" } });

      const response = await search(searchTerms, user.accessToken);

      expectUpstreamError(response);
      expect(await offMock.searchCalls(searchTerms)).toHaveLength(2);
    });

    it("answers 429 rate_limited after one call when OFF answers 429, and does not retry", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({ searchTerms, status: 429, body: { error: "slow down" } });

      const response = await search(searchTerms, user.accessToken);

      expect(response.status).toBe(429);
      expect(edgeErrorSchema.parse(response.body).error.code).toBe("rate_limited");
      expect(await offMock.searchCalls(searchTerms)).toHaveLength(1);
    });

    it("answers 502 upstream_error after one call when OFF answers another 4xx", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({ searchTerms, status: 422, body: { error: "bad query" } });

      const response = await search(searchTerms, user.accessToken);

      expectUpstreamError(response);
      expect(await offMock.searchCalls(searchTerms)).toHaveLength(1);
    });

    it("retries a 200 with a page that is not JSON, and answers 200 when the retry is good", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({
        searchTerms,
        rawBody: "<!DOCTYPE html><title>Page temporarily unavailable</title>",
        followedBy: [recoveredAnswer],
      });

      const response = await search(searchTerms, user.accessToken);

      expect(response.status).toBe(200);
      expect(await offMock.searchCalls(searchTerms)).toHaveLength(2);
    });

    it("answers 502 upstream_error when OFF answers 200 with a page that is not JSON both times", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({
        searchTerms,
        rawBody: "<!DOCTYPE html><title>Page temporarily unavailable</title>",
      });

      const response = await search(searchTerms, user.accessToken);

      expectUpstreamError(response);
      expect(await offMock.searchCalls(searchTerms)).toHaveLength(2);
    });

    it("answers 502 upstream_error when OFF answers 200 with JSON that has no hits list", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({ searchTerms, body: { count: 0, hits: "none" } });

      const response = await search(searchTerms, user.accessToken);

      expectUpstreamError(response);
    });

    it("treats timed_out: true as a failure, and retries it", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({
        searchTerms,
        body: { hits: [], count: 0, timed_out: true },
        followedBy: [recoveredAnswer],
      });

      const response = await search(searchTerms, user.accessToken);

      expect(response.status).toBe(200);
      expect(await offMock.searchCalls(searchTerms)).toHaveLength(2);
    });

    it("answers 502 upstream_error after two calls when OFF takes too long both times", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({ searchTerms, products: [], delayMilliseconds: 3500 });

      const response = await search(searchTerms, user.accessToken);

      expectUpstreamError(response);
      expect(await offMock.searchCalls(searchTerms)).toHaveLength(2);
    });

    it("retries a timeout, and answers 200 when the retry is quick", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({
        searchTerms,
        products: [],
        delayMilliseconds: 3500,
        followedBy: [{ ...recoveredAnswer, delayMilliseconds: 0 }],
      });

      const response = await search(searchTerms, user.accessToken);

      expect(response.status).toBe(200);
      expect(await offMock.searchCalls(searchTerms)).toHaveLength(2);
    });

    it("charges the limit once for a search that took two attempts", async () => {
      const user = await newUser();
      // Every search needs its own words, or the store answers the repeats and spends nothing.
      const searches = Array.from({ length: perUserLimit }, uniqueSearchTerms);
      for (const searchTerms of searches) {
        await offMock.registerSearch({
          searchTerms,
          status: 500,
          body: { error: "down" },
          followedBy: [recoveredAnswer],
        });
      }
      await waitForFreshRateLimitWindow();

      const statuses: number[] = [];
      for (const searchTerms of searches) {
        statuses.push((await search(searchTerms, user.accessToken)).status);
      }

      expect(statuses).toEqual(Array<number>(perUserLimit).fill(200));
    });
  });

  describe("validation and authentication", () => {
    it.each([
      ["a one-character query", "a"],
      ["a query that is one character once trimmed", "  a  "],
      ["an empty query", ""],
      ["a query over 100 characters", "a".repeat(101)],
      ["a query that is not a string", 42],
    ])("answers 400 invalid_request for %s", async (_name, q) => {
      const user = await newUser();

      const response = await search(q, user.accessToken);

      expect(response.status).toBe(400);
      expect(edgeErrorSchema.parse(response.body).error.code).toBe("invalid_request");
    });

    it("answers 400 invalid_request when the body has no q", async () => {
      const user = await newUser();

      const response = await callFunction("off-search", {
        accessToken: user.accessToken,
        body: { query: "oat" },
      });

      expect(response.status).toBe(400);
      expect(edgeErrorSchema.parse(response.body).error.code).toBe("invalid_request");
    });

    it("does not charge the rate limit for an invalid request, and never calls OFF", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({ searchTerms, products: [] });

      for (let attempt = 0; attempt <= perUserLimit; attempt += 1) {
        const refused = await search("a", user.accessToken);
        expect(refused.status).toBe(400);
      }
      const allowed = await search(searchTerms, user.accessToken);

      expect(allowed.status).toBe(200);
      expect(await offMock.searchCalls("a")).toEqual([]);
      expect(await offMock.searchCalls(searchTerms)).toHaveLength(1);
    });

    it("answers 401 unauthorized without a JWT, and does not call OFF", async () => {
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({ searchTerms, products: [] });

      const response = await callFunction("off-search", { body: { q: searchTerms } });

      expect(response.status).toBe(401);
      expect(edgeErrorSchema.parse(response.body).error.code).toBe("unauthorized");
      expect(await offMock.searchCalls(searchTerms)).toEqual([]);
    });

    it("answers 401 unauthorized for a token that is not a valid JWT", async () => {
      const response = await search(uniqueSearchTerms(), "not-a-jwt");

      expect(response.status).toBe(401);
    });
  });

  describe("rate limits", () => {
    // Every search needs its own words, or the store answers the repeats and spends nothing.
    async function registerSearches(count: number): Promise<string[]> {
      const searches = Array.from({ length: count }, uniqueSearchTerms);
      for (const searchTerms of searches) {
        await offMock.registerSearch({ searchTerms, products: [] });
      }
      return searches;
    }

    it("answers 429 with Retry-After once a user is over the per-user limit, and does not call OFF for it", async () => {
      const user = await newUser();
      const searches = await registerSearches(perUserLimit + 1);
      const refusedSearch = searches.pop() ?? "";

      await waitForFreshRateLimitWindow();
      for (const searchTerms of searches) {
        const allowed = await search(searchTerms, user.accessToken);
        expect(allowed.status).toBe(200);
      }
      const refused = await search(refusedSearch, user.accessToken);

      expect(refused.status).toBe(429);
      const { error } = edgeErrorSchema.parse(refused.body);
      expect(error.code).toBe("rate_limited");
      expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
      expect(error.retryAfterSeconds).toBe(Number(refused.headers.get("Retry-After")));
      expect(await offMock.searchCalls(refusedSearch)).toEqual([]);
    });

    it("limits each user on their own", async () => {
      const busyUser = await newUser();
      const freshUser = await newUser();
      const searches = await registerSearches(perUserLimit + 2);
      const freshUserSearch = searches.pop() ?? "";
      await waitForFreshRateLimitWindow();
      const busy: number[] = [];
      for (const searchTerms of searches) {
        busy.push((await search(searchTerms, busyUser.accessToken)).status);
      }

      const response = await search(freshUserSearch, freshUser.accessToken);

      expect(busy.at(-1)).toBe(429);
      expect(response.status).toBe(200);
    });
  });

  describe("the shared store of results", () => {
    async function readRow(searchTerms: string) {
      const { data, error } = await adminClient()
        .from("off_search_results")
        .select("*")
        .eq("query_key", searchTerms)
        .maybeSingle();
      if (error) {
        throw new Error("Could not read the stored search", { cause: error });
      }
      return data;
    }

    async function spendLimit(accessToken: string, count: number) {
      for (const searchTerms of Array.from({ length: count }, uniqueSearchTerms)) {
        await offMock.registerSearch({ searchTerms, products: [] });
        expect((await search(searchTerms, accessToken)).status).toBe(200);
      }
    }

    it("answers a second search for the same words from the store: one call to OFF in total", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      const code = generateBarcode();
      await offMock.registerSearch({ searchTerms, products: [{ code, fixture: "kcal-present" }] });

      const first = await search(searchTerms, user.accessToken);
      const second = await search(searchTerms, user.accessToken);

      expect(second.status).toBe(200);
      expect(second.body).toEqual(first.body);
      expect(offSearchResponseSchema.parse(second.body).candidates[0]?.code).toBe(code);
      expect(await offMock.searchCalls(searchTerms)).toHaveLength(1);
    });

    it("treats words that differ only in case and spacing as the same search, and spends one limit", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({ searchTerms, products: [] });
      await waitForFreshRateLimitWindow();

      await search(searchTerms, user.accessToken);
      const again = await search(
        `  (${searchTerms.toUpperCase().replace(" ", "   ")}  `,
        user.accessToken,
      );
      // One limit is spent, so the rest of the allowance is still there for other searches.
      await spendLimit(user.accessToken, perUserLimit - 1);
      const overTheLimit = uniqueSearchTerms();
      await offMock.registerSearch({ searchTerms: overTheLimit, products: [] });
      const refused = await search(overTheLimit, user.accessToken);

      expect(again.status).toBe(200);
      expect(await offMock.searchCalls(searchTerms)).toHaveLength(1);
      expect(refused.status).toBe(429);
    });

    it("shares a result between people: a second user's search for the same words makes no call", async () => {
      const firstUser = await newUser();
      const secondUser = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({
        searchTerms,
        products: [{ code: generateBarcode(), fixture: "kcal-present" }],
      });

      await search(searchTerms, firstUser.accessToken);
      const response = await search(searchTerms, secondUser.accessToken);

      expect(response.status).toBe(200);
      expect(offSearchResponseSchema.parse(response.body).candidates).toHaveLength(1);
      expect(await offMock.searchCalls(searchTerms)).toHaveLength(1);
    });

    it("still answers a stored search with 200, and spends nothing, for a user at their limit", async () => {
      const user = await newUser();
      const storedSearch = uniqueSearchTerms();
      await offMock.registerSearch({
        searchTerms: storedSearch,
        products: [{ code: generateBarcode(), fixture: "kcal-present" }],
      });
      await waitForFreshRateLimitWindow();
      await search(storedSearch, user.accessToken);
      await spendLimit(user.accessToken, perUserLimit - 1);
      const newSearch = uniqueSearchTerms();
      await offMock.registerSearch({ searchTerms: newSearch, products: [] });
      expect((await search(newSearch, user.accessToken)).status).toBe(429);

      const response = await search(storedSearch, user.accessToken);

      expect(response.status).toBe(200);
      expect(offSearchResponseSchema.parse(response.body).candidates).toHaveLength(1);
      expect(await offMock.searchCalls(storedSearch)).toHaveLength(1);
    });

    it("reuses an empty result, because OFF did answer", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({ searchTerms, products: [] });

      await search(searchTerms, user.accessToken);
      const second = await search(searchTerms, user.accessToken);

      expect(second.body).toEqual({ candidates: [] });
      expect(await offMock.searchCalls(searchTerms)).toHaveLength(1);
      expect((await readRow(searchTerms))?.candidates).toEqual([]);
    });

    it("stores nothing for a failed search, so the next search asks OFF again", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({
        searchTerms,
        status: 500,
        body: { error: "down" },
        followedBy: [{ status: 500, body: { error: "down" } }, { products: [] }],
      });

      const failed = await search(searchTerms, user.accessToken);
      const rowAfterFailure = await readRow(searchTerms);
      const recovered = await search(searchTerms, user.accessToken);

      expect(failed.status).toBe(502);
      expect(rowAfterFailure).toBeNull();
      expect(recovered.status).toBe(200);
      expect(await offMock.searchCalls(searchTerms)).toHaveLength(3);
      expect(await readRow(searchTerms)).not.toBeNull();
    });

    it("holds the normalised candidates and no user id, under the cleaned words", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      const code = generateBarcode();
      await offMock.registerSearch({ searchTerms, products: [{ code, fixture: "kcal-present" }] });

      const response = await search(searchTerms.toUpperCase(), user.accessToken);

      const row = await readRow(searchTerms);
      expect(Object.keys(row ?? {}).sort()).toEqual(["candidates", "fetched_at", "query_key"]);
      expect(row?.candidates).toEqual(offSearchResponseSchema.parse(response.body).candidates);
      expect(JSON.stringify(row)).not.toContain(user.id);
    });
  });
});
