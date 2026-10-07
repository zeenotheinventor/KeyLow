import { edgeErrorSchema, offSearchResponseSchema } from "@keylow/core";
import { afterAll, describe, expect, it } from "vitest";

import { generateBarcode } from "../support/barcodes";
import { deleteGeneratedFoods } from "../support/foods";
import { callFunction } from "../support/functionClient";
import { offMock } from "../support/offMock";
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
    it("is a UK-only text search with the configured User-Agent and a page of 20", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({ searchTerms, products: [] });

      await search(searchTerms, user.accessToken);

      const calls = await offMock.searchCalls(searchTerms);
      expect(calls).toHaveLength(1);
      expect(calls[0]?.url).toMatch(/^\/cgi\/search\.pl\?/);
      expect(calls[0]?.headers["user-agent"]).toBe(configuredUserAgent);
      expect(calls[0]?.query).toMatchObject({
        search_terms: searchTerms,
        search_simple: "1",
        action: "process",
        json: "1",
        page_size: "20",
        tagtype_0: "countries",
        tag_contains_0: "contains",
        tag_0: "united-kingdom",
      });
    });

    it("asks only for the fields the normaliser reads", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({ searchTerms, products: [] });

      await search(searchTerms, user.accessToken);

      const [call] = await offMock.searchCalls(searchTerms);
      const fields = call?.query["fields"]?.split(",") ?? [];
      expect(fields).toEqual(
        expect.arrayContaining(["code", "product_name", "product_name_en", "brands", "nutriments"]),
      );
      expect(fields).not.toContain("images");
    });

    it("searches for the trimmed words", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({ searchTerms, products: [] });

      const response = await search(`  ${searchTerms}  `, user.accessToken);

      expect(response.status).toBe(200);
      expect(await offMock.searchCalls(searchTerms)).toHaveLength(1);
    });
  });

  describe("when Open Food Facts fails", () => {
    it("answers 502 upstream_error when OFF answers 500", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({ searchTerms, status: 500, body: { error: "down" } });

      const response = await search(searchTerms, user.accessToken);

      expect(response.status).toBe(502);
      expect(edgeErrorSchema.parse(response.body).error.code).toBe("upstream_error");
    });

    it("answers 502 upstream_error when OFF answers 200 with a page that is not JSON", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({
        searchTerms,
        rawBody: "<!DOCTYPE html><title>Page temporarily unavailable</title>",
      });

      const response = await search(searchTerms, user.accessToken);

      expect(response.status).toBe(502);
      expect(edgeErrorSchema.parse(response.body).error.code).toBe("upstream_error");
    });

    it("answers 502 upstream_error when OFF answers 200 with JSON that has no products list", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({ searchTerms, body: { count: 0, products: "none" } });

      const response = await search(searchTerms, user.accessToken);

      expect(response.status).toBe(502);
      expect(edgeErrorSchema.parse(response.body).error.code).toBe("upstream_error");
    });

    it("answers 502 upstream_error when OFF takes too long", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({ searchTerms, products: [], delayMilliseconds: 6500 });

      const response = await search(searchTerms, user.accessToken);

      expect(response.status).toBe(502);
      expect(edgeErrorSchema.parse(response.body).error.code).toBe("upstream_error");
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
    it("answers 429 with Retry-After once a user is over the per-user limit, and does not call OFF for it", async () => {
      const user = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({ searchTerms, products: [] });

      for (let attempt = 0; attempt < perUserLimit; attempt += 1) {
        const allowed = await search(searchTerms, user.accessToken);
        expect(allowed.status).toBe(200);
      }
      const refused = await search(searchTerms, user.accessToken);

      expect(refused.status).toBe(429);
      const { error } = edgeErrorSchema.parse(refused.body);
      expect(error.code).toBe("rate_limited");
      expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
      expect(error.retryAfterSeconds).toBe(Number(refused.headers.get("Retry-After")));
      expect(await offMock.searchCalls(searchTerms)).toHaveLength(perUserLimit);
    });

    it("limits each user on their own", async () => {
      const busyUser = await newUser();
      const freshUser = await newUser();
      const searchTerms = uniqueSearchTerms();
      await offMock.registerSearch({ searchTerms, products: [] });
      for (let attempt = 0; attempt <= perUserLimit; attempt += 1) {
        await search(searchTerms, busyUser.accessToken);
      }

      const response = await search(searchTerms, freshUser.accessToken);

      expect(response.status).toBe(200);
    });
  });
});
