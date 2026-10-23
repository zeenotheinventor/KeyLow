import { edgeErrorSchema, offProductResponseSchema } from "@keylow/core";
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
const perUserLimit = Number(requireFunctionEnvironmentValue("OFF_PRODUCT_PER_USER_PER_MIN"));
const millisecondsPerDay = 24 * 60 * 60 * 1000;

afterAll(async () => {
  try {
    await deleteGeneratedFoods();
  } finally {
    await deleteCreatedTestUsers();
  }
});

async function lookUp(code: string, accessToken: string) {
  return await callFunction("off-product", { accessToken, body: { code } });
}

async function newUser() {
  return await createTestUser("k46");
}

async function readOffFoods(code: string) {
  const { data, error } = await adminClient()
    .from("foods")
    .select("*")
    .eq("source", "off")
    .eq("source_ref", code);
  if (error) {
    throw new Error("Could not read the foods", { cause: error });
  }
  return data;
}

async function readFetchedAt(code: string): Promise<number> {
  const [food] = await readOffFoods(code);
  if (food?.fetched_at == null) {
    throw new Error(`There is no fetched OFF row for ${code}`);
  }
  return new Date(food.fetched_at).getTime();
}

async function makeStale(code: string): Promise<string> {
  const staleFetchedAt = new Date(Date.now() - 91 * millisecondsPerDay).toISOString();
  const { error } = await adminClient()
    .from("foods")
    .update({ fetched_at: staleFetchedAt })
    .eq("source", "off")
    .eq("source_ref", code);
  if (error) {
    throw new Error("Could not make the food stale", { cause: error });
  }
  return staleFetchedAt;
}

async function waitFor(condition: () => Promise<boolean>, timeoutMilliseconds = 10_000) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (!(await condition())) {
    if (Date.now() > deadline) {
      throw new Error("The condition was not met in time");
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// 3282070015314, a real box of ten free-range hen eggs, as Open Food Facts holds it (captured 2026-10-23):
// OFF lists every ancestor category, and the energy is 140 kcal per 100 g. The quantity is a bare count
// with no unit, so there is no pack portion to read.
const boxOfEggsOverrides = {
  product_name_en: "Test Box of Eggs",
  quantity: "10",
  serving_size: null,
  serving_quantity: null,
  packaging_tags: ["en:cardboard", "en:box"],
  categories_tags: [
    "en:eggs-and-their-products",
    "en:farming-products",
    "en:eggs",
    "en:chicken-eggs",
    "en:free-range-chicken-eggs",
  ],
  nutriments: {
    "energy-kcal_100g": 140,
    proteins_100g: 12.5,
    fat_100g: 9.5,
    carbohydrates_100g: 0.7,
  },
};

describe("off-product", () => {
  describe("when the barcode is not cached", () => {
    it("fetches it once and stores one OFF row, sending the configured User-Agent", async () => {
      const user = await newUser();
      const code = generateBarcode();
      await offMock.register({ code, fixture: "kcal-present" });

      const response = await lookUp(code, user.accessToken);

      expect(response.status).toBe(200);
      const { food, portions } = offProductResponseSchema.parse(response.body);
      expect(food).toMatchObject({
        source: "off",
        source_ref: code,
        owner_id: null,
        barcode: code,
        name: "Test Oat Crunch",
        brand: "Northfield Mills",
        kcal: 380,
        protein_g: 9.5,
      });
      expect(food.fetched_at).not.toBeNull();
      // The fixture's serving is 40 g and its quantity is 500 g with no packaging or pack category.
      expect(portions).toEqual([
        expect.objectContaining({
          food_id: food.id,
          owner_id: null,
          label: "40 g",
          grams: 40,
          ml: null,
          is_default: true,
          position: 0,
        }),
        expect.objectContaining({
          food_id: food.id,
          owner_id: null,
          label: "1 pack",
          grams: 500,
          ml: null,
          is_default: false,
          position: 1,
        }),
      ]);

      const calls = await offMock.calls(code);
      expect(calls).toHaveLength(1);
      expect(calls[0]?.headers["user-agent"]).toBe(configuredUserAgent);
      expect(calls[0]?.query["fields"]).toContain("nutriments");

      const stored = await readOffFoods(code);
      expect(stored).toHaveLength(1);
      expect(stored[0]?.fetched_at).not.toBeNull();
    });

    it("stores the four egg sizes of a box of eggs with no serving, large the only default", async () => {
      const user = await newUser();
      const code = generateBarcode();
      await offMock.register({
        code,
        fixture: "kcal-present",
        productOverrides: boxOfEggsOverrides,
      });

      const response = await lookUp(code, user.accessToken);

      expect(response.status).toBe(200);
      const { portions } = offProductResponseSchema.parse(response.body);
      expect(
        portions.map(({ label, grams, ml, is_default, position }) => ({
          label,
          grams,
          ml,
          is_default,
          position,
        })),
      ).toEqual([
        { label: "1 small", grams: 38, ml: null, is_default: false, position: 0 },
        { label: "1 medium", grams: 44, ml: null, is_default: false, position: 1 },
        { label: "1 large", grams: 50, ml: null, is_default: true, position: 2 },
        { label: "1 extra large", grams: 56, ml: null, is_default: false, position: 3 },
      ]);
    });

    it("keeps the serving as the only default of a box of eggs, ahead of the egg sizes", async () => {
      const user = await newUser();
      const code = generateBarcode();
      await offMock.register({
        code,
        fixture: "kcal-present",
        productOverrides: {
          ...boxOfEggsOverrides,
          serving_size: "1 egg (60 g)",
          serving_quantity: 60,
        },
      });

      const response = await lookUp(code, user.accessToken);

      expect(response.status).toBe(200);
      const { portions } = offProductResponseSchema.parse(response.body);
      expect(portions.map(({ label, is_default }) => [label, is_default])).toEqual([
        ["1 egg (60 g)", true],
        ["1 small", false],
        ["1 medium", false],
        ["1 large", false],
        ["1 extra large", false],
      ]);
    });

    it("answers every one of several simultaneous first lookups, and stores one set of portions", async () => {
      const users = await Promise.all(Array.from({ length: 4 }, () => newUser()));
      const code = generateBarcode();
      await offMock.register({ code, fixture: "kcal-present", delayMilliseconds: 300 });

      const responses = await Promise.all(users.map((user) => lookUp(code, user.accessToken)));

      expect(responses.map(({ status }) => status)).toEqual([200, 200, 200, 200]);
      const foodIds = new Set(
        responses.map(({ body }) => offProductResponseSchema.parse(body).food.id),
      );
      expect(foodIds.size).toBe(1);
      expect(await readOffFoods(code)).toHaveLength(1);
      const { data: portions, error } = await adminClient()
        .from("food_portions")
        .select("label, grams, ml, is_default, position")
        .eq("food_id", [...foodIds][0] ?? "")
        .order("position");
      expect(error).toBeNull();
      expect(portions).toEqual([
        { label: "40 g", grams: 40, ml: null, is_default: true, position: 0 },
        { label: "1 pack", grams: 500, ml: null, is_default: false, position: 1 },
      ]);
    });

    it("keeps the raw OFF product, without an import run, in food_source_data", async () => {
      const user = await newUser();
      const code = generateBarcode();
      await offMock.register({ code, fixture: "kcal-present" });
      const { food } = offProductResponseSchema.parse((await lookUp(code, user.accessToken)).body);

      const { data, error } = await adminClient()
        .from("food_source_data")
        .select("*")
        .eq("food_id", food.id)
        .single();

      expect(error).toBeNull();
      expect(data?.import_run_id).toBeNull();
      expect(data?.raw).toMatchObject({ code, product_name_en: "Test Oat Crunch" });
    });

    it("stores a product missing its protein as suspect, with protein_g null", async () => {
      const user = await newUser();
      const code = generateBarcode();
      await offMock.register({ code, fixture: "missing-protein" });

      const response = await lookUp(code, user.accessToken);

      expect(response.status).toBe(200);
      const { food } = offProductResponseSchema.parse(response.body);
      expect(food.protein_g).toBeNull();
      expect(food.quality).toMatchObject({ suspect: true, fields_missing: ["protein_g"] });
      const [stored] = await readOffFoods(code);
      expect(stored?.protein_g).toBeNull();
      expect(stored?.quality).toMatchObject({ suspect: true });
    });

    it("answers 404 not_found when OFF has no such product", async () => {
      const user = await newUser();
      const code = generateBarcode();

      const response = await lookUp(code, user.accessToken);

      expect(response.status).toBe(404);
      expect(edgeErrorSchema.parse(response.body).error.code).toBe("not_found");
      expect(await offMock.calls(code)).toHaveLength(1);
      expect(await readOffFoods(code)).toEqual([]);
    });

    it("answers 404 not_found when OFF says status 0 with a 200", async () => {
      const user = await newUser();
      const code = generateBarcode();
      await offMock.register({
        code,
        body: { code, status: 0, status_verbose: "product not found" },
      });

      const response = await lookUp(code, user.accessToken);

      expect(response.status).toBe(404);
      expect(edgeErrorSchema.parse(response.body).error.code).toBe("not_found");
    });

    it("answers 502 upstream_error when OFF fails, and stores nothing", async () => {
      const user = await newUser();
      const code = generateBarcode();
      await offMock.register({ code, status: 500, body: { error: "down" } });

      const response = await lookUp(code, user.accessToken);

      expect(response.status).toBe(502);
      expect(edgeErrorSchema.parse(response.body).error.code).toBe("upstream_error");
      expect(await readOffFoods(code)).toEqual([]);
    });

    it("answers 502 upstream_error when the product cannot become a food", async () => {
      const user = await newUser();
      const code = generateBarcode();
      await offMock.register({ code, fixture: "no-name" });

      const response = await lookUp(code, user.accessToken);

      expect(response.status).toBe(502);
      expect(edgeErrorSchema.parse(response.body).error.code).toBe("upstream_error");
      expect(await readOffFoods(code)).toEqual([]);
    });
  });

  describe("when the barcode is cached and fresh", () => {
    it("serves a second lookup, from any user, without calling OFF or touching the row", async () => {
      const first = await newUser();
      const second = await newUser();
      const code = generateBarcode();
      await offMock.register({ code, fixture: "kcal-present" });
      const created = offProductResponseSchema.parse((await lookUp(code, first.accessToken)).body);
      const fetchedAtBefore = await readFetchedAt(code);

      const response = await lookUp(code, second.accessToken);

      expect(response.status).toBe(200);
      expect(offProductResponseSchema.parse(response.body).food.id).toBe(created.food.id);
      expect(await offMock.calls(code)).toHaveLength(1);
      expect(await readFetchedAt(code)).toBe(fetchedAtBefore);
    });
  });

  describe("when the barcode is cached and stale", () => {
    it("answers at once from the cache, then refreshes the row in the background", async () => {
      const user = await newUser();
      const code = generateBarcode();
      await offMock.register({ code, fixture: "kcal-present" });
      await lookUp(code, user.accessToken);
      const staleFetchedAt = await makeStale(code);
      // The refresh gets a different name, and OFF answers it slowly, so a response that waited for
      // it could not return the cached values.
      await offMock.register({
        code,
        fixture: "kcal-present",
        productOverrides: { product_name_en: "Refreshed Oat Crunch" },
        delayMilliseconds: 1500,
      });

      const response = await lookUp(code, user.accessToken);

      expect(response.status).toBe(200);
      const { food } = offProductResponseSchema.parse(response.body);
      expect(food.name).toBe("Test Oat Crunch");
      expect(new Date(food.fetched_at ?? "").getTime()).toBe(new Date(staleFetchedAt).getTime());
      // OFF is still holding its answer, so the old name is still stored. A response that waited for
      // the refresh could not have been sent yet.
      expect((await readOffFoods(code))[0]?.name).toBe("Test Oat Crunch");

      await waitFor(async () => (await readOffFoods(code))[0]?.name === "Refreshed Oat Crunch");
      expect(await offMock.calls(code)).toHaveLength(2);
      expect(await readFetchedAt(code)).toBeGreaterThan(new Date(staleFetchedAt).getTime());
    });

    it("refreshes once when several lookups find the row stale at the same time", async () => {
      const user = await newUser();
      const code = generateBarcode();
      await offMock.register({ code, fixture: "kcal-present" });
      await lookUp(code, user.accessToken);
      await makeStale(code);
      await offMock.register({
        code,
        fixture: "kcal-present",
        productOverrides: { product_name_en: "Refreshed Oat Crunch" },
        delayMilliseconds: 500,
      });

      const responses = await Promise.all(
        Array.from({ length: 5 }, () => lookUp(code, user.accessToken)),
      );

      expect(responses.map(({ status }) => status)).toEqual([200, 200, 200, 200, 200]);
      await waitFor(async () => (await readOffFoods(code))[0]?.name === "Refreshed Oat Crunch");
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(await offMock.calls(code)).toHaveLength(2);
    });

    it("does not refresh again on the next lookup after a refresh that found no product", async () => {
      const user = await newUser();
      const code = generateBarcode();
      await offMock.register({ code, fixture: "kcal-present" });
      await lookUp(code, user.accessToken);
      await makeStale(code);
      await offMock.register({ code, status: 404, body: { code, status: 0 } });

      await lookUp(code, user.accessToken);
      await waitFor(async () => (await offMock.calls(code)).length === 2);
      const second = await lookUp(code, user.accessToken);
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(second.status).toBe(200);
      expect(await offMock.calls(code)).toHaveLength(2);
      expect((await readOffFoods(code))[0]?.name).toBe("Test Oat Crunch");
    });
  });

  describe("validation and authentication", () => {
    it.each([
      ["a code that is too short", "12345"],
      ["a code with letters", "abcdefghijklm"],
      ["an EAN-13 with a bad check digit", "2000000000001"],
    ])("answers 400 invalid_request for %s, without calling OFF", async (_name, code) => {
      const user = await newUser();

      const response = await lookUp(code, user.accessToken);

      expect(response.status).toBe(400);
      expect(edgeErrorSchema.parse(response.body).error.code).toBe("invalid_request");
      expect(await offMock.calls(code)).toEqual([]);
    });

    it("answers 400 invalid_request when the body has no code", async () => {
      const user = await newUser();

      const response = await callFunction("off-product", {
        accessToken: user.accessToken,
        body: { barcode: generateBarcode() },
      });

      expect(response.status).toBe(400);
      expect(edgeErrorSchema.parse(response.body).error.code).toBe("invalid_request");
    });

    it("answers 401 unauthorized without a JWT, and does not call OFF", async () => {
      const code = generateBarcode();
      await offMock.register({ code, fixture: "kcal-present" });

      const response = await callFunction("off-product", { body: { code } });

      expect(response.status).toBe(401);
      expect(edgeErrorSchema.parse(response.body).error.code).toBe("unauthorized");
      expect(await offMock.calls(code)).toEqual([]);
    });

    it("answers 401 unauthorized for a token that is not a valid JWT", async () => {
      const response = await callFunction("off-product", {
        accessToken: "not-a-jwt",
        body: { code: generateBarcode() },
      });

      expect(response.status).toBe(401);
    });
  });

  describe("rate limits", () => {
    it("answers 429 with Retry-After once a user is over the per-user limit, but still serves cached rows", async () => {
      const cachedCode = generateBarcode();
      await offMock.register({ code: cachedCode, fixture: "kcal-present" });
      await lookUp(cachedCode, (await newUser()).accessToken);
      const user = await newUser();

      await waitForFreshRateLimitWindow();
      for (let attempt = 0; attempt < perUserLimit; attempt += 1) {
        const allowed = await lookUp(generateBarcode(), user.accessToken);
        expect(allowed.status).toBe(404);
      }
      const refusedCode = generateBarcode();
      const refused = await lookUp(refusedCode, user.accessToken);

      expect(refused.status).toBe(429);
      const { error } = edgeErrorSchema.parse(refused.body);
      expect(error.code).toBe("rate_limited");
      expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
      expect(error.retryAfterSeconds).toBe(Number(refused.headers.get("Retry-After")));
      expect(await offMock.calls(refusedCode)).toEqual([]);

      const cached = await lookUp(cachedCode, user.accessToken);
      expect(cached.status).toBe(200);
    });
  });
});
