import { estimatedPortion } from "@keylow/core/foods";
import { customFoodInputSchema } from "@keylow/core/schemas";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  FoodsPartialWriteError,
  createFood,
  getFood,
  listFoodPortions,
  replaceFoodPortions,
  softDeleteFood,
  updateFood,
} from "../../src/repos/foods";
import { createTestClient } from "../createTestClient";
import {
  REST_URL,
  SIGNED_IN_USER_ID,
  foodRow,
  portionRow,
  postgrestError,
  postgrestRows,
} from "../support/postgrest";

// The columns the migration grants to `authenticated`. Writing any other column returns 42501.
const INSERTABLE_FOOD_COLUMNS = [
  "name",
  "brand",
  "barcode",
  "basis",
  "density_g_per_ml",
  "kcal",
  "protein_g",
  "fat_g",
  "sat_fat_g",
  "carbs_g",
  "sugars_g",
  "fibre_g",
  "salt_g",
  "micros",
  "food_group",
  "deleted_at",
  "owner_id",
  "source",
];
const UPDATABLE_FOOD_COLUMNS = INSERTABLE_FOOD_COLUMNS.filter(
  (column) => column !== "owner_id" && column !== "source",
);

type RecordedRequest = { method: string; url: URL; body: unknown };

const recorded: RecordedRequest[] = [];

async function record(request: Request) {
  const hasBody = request.method === "POST" || request.method === "PATCH";
  recorded.push({
    method: request.method,
    url: new URL(request.url),
    body: hasBody ? await request.clone().json() : undefined,
  });
}

const requestsTo = (method: string, table: string) =>
  recorded.filter(
    (request) => request.method === method && request.url.pathname === `/rest/v1/${table}`,
  );

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  recorded.length = 0;
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const FOOD_ID = foodRow().id;

const customFoodInputValues = {
  name: "  Protein flapjack ",
  brand: "Home made",
  barcode: "0 36000-29145 2",
  basis: "per_100g",
  density_g_per_ml: 1.1,
  kcal: 410,
  protein_g: 22,
  fat_g: 14,
  carbs_g: 45,
  fibre_g: 6,
};

const carryingInputValues = {
  ...customFoodInputValues,
  sat_fat_g: 3.5,
  sugars_g: 12,
  salt_g: 0.4,
  portions: [],
};

const customFoodInput = (portions: unknown[] = []) =>
  customFoodInputSchema.parse({ ...customFoodInputValues, portions });

const carryingInput = () => customFoodInputSchema.parse(carryingInputValues);

const twoPortions = [
  { label: "1 bar", grams: 60, isDefault: true },
  { label: "1 cup", ml: 250, isDefault: false },
];

describe("getFood", () => {
  it("should return the parsed food when the row exists", async () => {
    server.use(http.get(`${REST_URL}/foods`, ({ request }) => postgrestRows(request, [foodRow()])));

    const food = await getFood(createTestClient(), FOOD_ID);

    expect(food).toEqual(foodRow());
  });

  it("should select the food by id and leave the generated search column out", async () => {
    server.use(
      http.get(`${REST_URL}/foods`, async ({ request }) => {
        await record(request);
        return postgrestRows(request, [foodRow()]);
      }),
    );

    await getFood(createTestClient(), FOOD_ID);

    const [request] = requestsTo("GET", "foods");
    expect(request?.url.searchParams.get("id")).toBe(`eq.${FOOD_ID}`);
    expect(request?.url.searchParams.get("select")).not.toContain("search");
  });

  it("should return null when no row is visible", async () => {
    server.use(http.get(`${REST_URL}/foods`, ({ request }) => postgrestRows(request, [])));

    expect(await getFood(createTestClient(), FOOD_ID)).toBeNull();
  });

  it("should throw an error whose cause is the database error code", async () => {
    server.use(
      http.get(`${REST_URL}/foods`, () => postgrestError(500, "XX000", "database unavailable")),
    );

    const failure = await getFood(createTestClient(), FOOD_ID).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(failure).toHaveProperty("cause", { code: "XX000" });
  });

  it("should reject a row that does not match the food schema", async () => {
    server.use(
      http.get(`${REST_URL}/foods`, ({ request }) =>
        postgrestRows(request, [{ ...foodRow(), kcal: "lots" }]),
      ),
    );

    await expect(getFood(createTestClient(), FOOD_ID)).rejects.toThrow();
  });
});

describe("listFoodPortions", () => {
  it("should return the parsed portions ordered by position", async () => {
    server.use(
      http.get(`${REST_URL}/food_portions`, async ({ request }) => {
        await record(request);
        return postgrestRows(request, [portionRow()]);
      }),
    );

    const portions = await listFoodPortions(createTestClient(), FOOD_ID);

    expect(portions).toEqual([portionRow()]);
    const [request] = requestsTo("GET", "food_portions");
    expect(request?.url.searchParams.get("food_id")).toBe(`eq.${FOOD_ID}`);
    expect(request?.url.searchParams.get("order")).toBe("position.asc");
  });

  it("should throw an error whose cause is the database error code", async () => {
    server.use(
      http.get(`${REST_URL}/food_portions`, () =>
        postgrestError(500, "XX000", "database unavailable"),
      ),
    );

    const failure = await listFoodPortions(createTestClient(), FOOD_ID).catch(
      (error: unknown) => error,
    );

    expect(failure).toHaveProperty("cause", { code: "XX000" });
  });
});

const rpcRequests = (name: string) =>
  recorded.filter(
    (request) => request.method === "POST" && request.url.pathname === `/rest/v1/rpc/${name}`,
  );

const rpcBodySchema = z.object({
  p_food: z.record(z.string(), z.unknown()).optional(),
  p_food_id: z.string().optional(),
  p_portions: z.array(z.record(z.string(), z.unknown())),
});

/** The arguments of the first call to a database function, parsed so a test reads them without a cast. */
const rpcArguments = (name: string) => rpcBodySchema.parse(rpcRequests(name)[0]?.body);

describe("createFood", () => {
  const respondToCreate = () => {
    server.use(
      http.post(`${REST_URL}/rpc/create_food`, async ({ request }) => {
        await record(request);
        return HttpResponse.json({ food: foodRow(), portions: [portionRow()] });
      }),
    );
  };

  it("should create the food and its portions in one call to the database, never in separate writes", async () => {
    respondToCreate();

    await createFood(createTestClient(), SIGNED_IN_USER_ID, customFoodInput(twoPortions));

    expect(recorded.map((request) => request.url.pathname)).toEqual(["/rest/v1/rpc/create_food"]);
  });

  it("should send only columns that the authenticated role may write", async () => {
    respondToCreate();

    await createFood(createTestClient(), SIGNED_IN_USER_ID, customFoodInput());

    const written = Object.keys(rpcArguments("create_food").p_food ?? {});
    expect(written.length).toBeGreaterThan(0);
    expect(written.filter((column) => !INSERTABLE_FOOD_COLUMNS.includes(column))).toEqual([]);
  });

  it("should write a user food owned by the given user with empty micros", async () => {
    respondToCreate();

    await createFood(createTestClient(), SIGNED_IN_USER_ID, customFoodInput());

    expect(rpcArguments("create_food").p_food).toMatchObject({
      source: "user",
      owner_id: SIGNED_IN_USER_ID,
      micros: {},
    });
  });

  it("should write the canonical, trimmed values from the input", async () => {
    respondToCreate();

    await createFood(createTestClient(), SIGNED_IN_USER_ID, customFoodInput());

    expect(rpcArguments("create_food").p_food).toMatchObject({
      name: "Protein flapjack",
      brand: "Home made",
      barcode: "0036000291452",
      basis: "per_100g",
      density_g_per_ml: 1.1,
      kcal: 410,
      protein_g: 22,
      fat_g: 14,
      carbs_g: 45,
      fibre_g: 6,
    });
  });

  it("should write null for optional values the input leaves out", async () => {
    respondToCreate();
    const input = customFoodInputSchema.parse({
      name: "Plain",
      basis: "per_100g",
      kcal: 1,
      protein_g: 1,
      fat_g: 1,
      carbs_g: 1,
      portions: [],
    });

    await createFood(createTestClient(), SIGNED_IN_USER_ID, input);

    expect(rpcArguments("create_food").p_food).toMatchObject({
      brand: null,
      barcode: null,
      density_g_per_ml: null,
      fibre_g: null,
    });
  });

  it("should write saturated fat, sugars and salt when the input carries them", async () => {
    respondToCreate();

    await createFood(createTestClient(), SIGNED_IN_USER_ID, carryingInput());

    expect(rpcArguments("create_food").p_food).toEqual({
      name: "Protein flapjack",
      brand: "Home made",
      barcode: "0036000291452",
      basis: "per_100g",
      density_g_per_ml: 1.1,
      kcal: 410,
      protein_g: 22,
      fat_g: 14,
      carbs_g: 45,
      fibre_g: 6,
      sat_fat_g: 3.5,
      sugars_g: 12,
      salt_g: 0.4,
      source: "user",
      owner_id: SIGNED_IN_USER_ID,
      micros: {},
    });
  });

  it("should write null for saturated fat, sugars and salt the input leaves out", async () => {
    respondToCreate();

    await createFood(createTestClient(), SIGNED_IN_USER_ID, customFoodInput());

    expect(rpcArguments("create_food").p_food).toMatchObject({
      sat_fat_g: null,
      sugars_g: null,
      salt_g: null,
    });
  });

  it("should write a carried zero as zero, not as null", async () => {
    respondToCreate();

    await createFood(
      createTestClient(),
      SIGNED_IN_USER_ID,
      customFoodInputSchema.parse({ ...carryingInputValues, sat_fat_g: 0, sugars_g: 0, salt_g: 0 }),
    );

    expect(rpcArguments("create_food").p_food).toMatchObject({
      sat_fat_g: 0,
      sugars_g: 0,
      salt_g: 0,
    });
  });

  it("should return the created food with the portions the database stored", async () => {
    respondToCreate();

    const created = await createFood(
      createTestClient(),
      SIGNED_IN_USER_ID,
      customFoodInput(twoPortions),
    );

    expect(created).toEqual({ food: foodRow(), portions: [portionRow()] });
  });

  it("should send the portions in order, with a default, as rows the database function reads", async () => {
    respondToCreate();

    await createFood(createTestClient(), SIGNED_IN_USER_ID, customFoodInput(twoPortions));

    expect(rpcArguments("create_food").p_portions).toEqual([
      { label: "1 bar", grams: 60, ml: null, is_default: true },
      { label: "1 cup", grams: null, ml: 250, is_default: false },
    ]);
  });

  it("should send one typical serving, sized from the energy, as the default when there are no portions", async () => {
    respondToCreate();
    const estimate = estimatedPortion({ basis: "per_100g", kcal: foodRow().kcal });

    await createFood(createTestClient(), SIGNED_IN_USER_ID, customFoodInput());

    expect(rpcArguments("create_food").p_portions).toEqual([
      { label: estimate.label, grams: estimate.grams, ml: null, is_default: true },
    ]);
  });

  it("should make the first portion the default when none of them is", async () => {
    respondToCreate();

    await createFood(
      createTestClient(),
      SIGNED_IN_USER_ID,
      customFoodInput([
        { label: "1 bar", grams: 60, isDefault: false },
        { label: "1 cup", ml: 250, isDefault: false },
      ]),
    );

    expect(rpcArguments("create_food").p_portions).toMatchObject([
      { label: "1 bar", is_default: true },
      { label: "1 cup", is_default: false },
    ]);
  });

  it("should keep the default the person chose", async () => {
    respondToCreate();

    await createFood(
      createTestClient(),
      SIGNED_IN_USER_ID,
      customFoodInput([
        { label: "1 bar", grams: 60, isDefault: false },
        { label: "1 cup", ml: 250, isDefault: true },
      ]),
    );

    expect(rpcArguments("create_food").p_portions).toMatchObject([
      { label: "1 bar", is_default: false },
      { label: "1 cup", is_default: true },
    ]);
  });

  it("should throw with the action and the database error code, and no partial write, when the database refuses the create", async () => {
    server.use(
      http.post(`${REST_URL}/rpc/create_food`, () =>
        postgrestError(403, "42501", "new row violates row-level security policy for foods"),
      ),
    );

    const failure = await createFood(
      createTestClient(),
      SIGNED_IN_USER_ID,
      customFoodInput(twoPortions),
    ).catch((error: unknown) => error);

    expect(failure).toHaveProperty("message", "Could not create the food (42501)");
    expect(failure).toHaveProperty("cause", { code: "42501" });
    expect(failure).not.toBeInstanceOf(FoodsPartialWriteError);
  });

  it("should never put the database message in the error", async () => {
    server.use(
      http.post(`${REST_URL}/rpc/create_food`, () =>
        postgrestError(400, "23514", "Failing row contains (Protein flapjack, 410)"),
      ),
    );

    const failure = await createFood(
      createTestClient(),
      SIGNED_IN_USER_ID,
      customFoodInput(twoPortions),
    ).catch((error: unknown) => error);

    expect(String(failure)).not.toContain("flapjack");
  });

  it("should reject an answer that does not match the food schema", async () => {
    server.use(
      http.post(`${REST_URL}/rpc/create_food`, () =>
        HttpResponse.json({ food: { ...foodRow(), kcal: "lots" }, portions: [] }),
      ),
    );

    await expect(
      createFood(createTestClient(), SIGNED_IN_USER_ID, customFoodInput(twoPortions)),
    ).rejects.toThrow();
  });
});

describe("replaceFoodPortions", () => {
  const respondToReplace = () => {
    server.use(
      http.post(`${REST_URL}/rpc/replace_food_portions`, async ({ request }) => {
        await record(request);
        return HttpResponse.json([portionRow()]);
      }),
    );
  };

  it("should replace the portions in one call to the database, never a delete and then an insert", async () => {
    respondToReplace();

    await replaceFoodPortions(createTestClient(), FOOD_ID, twoPortions);

    expect(recorded.map((request) => `${request.method} ${request.url.pathname}`)).toEqual([
      "POST /rest/v1/rpc/replace_food_portions",
    ]);
  });

  it("should send the food id and the portions in order as rows the database function reads", async () => {
    respondToReplace();

    await replaceFoodPortions(createTestClient(), FOOD_ID, twoPortions);

    expect(rpcArguments("replace_food_portions")).toEqual({
      p_food_id: FOOD_ID,
      p_portions: [
        { label: "1 bar", grams: 60, ml: null, is_default: true },
        { label: "1 cup", grams: null, ml: 250, is_default: false },
      ],
    });
  });

  it("should return the stored portions", async () => {
    respondToReplace();

    expect(await replaceFoodPortions(createTestClient(), FOOD_ID, twoPortions)).toEqual([
      portionRow(),
    ]);
  });

  it("should throw with the action, the food and the database error code when the database refuses, and report no partial write", async () => {
    server.use(
      http.post(`${REST_URL}/rpc/replace_food_portions`, () =>
        postgrestError(400, "23514", "Failing row contains (1 bar, 60)"),
      ),
    );

    const failure = await replaceFoodPortions(createTestClient(), FOOD_ID, twoPortions).catch(
      (error: unknown) => error,
    );

    expect(failure).toHaveProperty(
      "message",
      `Could not replace the portions of the food ${FOOD_ID} (23514)`,
    );
    expect(failure).toHaveProperty("cause", { code: "23514" });
    expect(failure).not.toBeInstanceOf(FoodsPartialWriteError);
    expect(String(failure)).not.toContain("1 bar");
  });

  it("should reject an answer that does not match the portion schema", async () => {
    server.use(
      http.post(`${REST_URL}/rpc/replace_food_portions`, () =>
        HttpResponse.json([{ ...portionRow(), grams: "heavy" }]),
      ),
    );

    await expect(replaceFoodPortions(createTestClient(), FOOD_ID, twoPortions)).rejects.toThrow();
  });
});

describe("updateFood", () => {
  const respondToUpdate = () => {
    server.use(
      http.patch(`${REST_URL}/foods`, async ({ request }) => {
        await record(request);
        return postgrestRows(request, [foodRow()]);
      }),
      http.post(`${REST_URL}/rpc/replace_food_portions`, async ({ request }) => {
        await record(request);
        return HttpResponse.json([portionRow()]);
      }),
    );
  };

  it("should update only columns that the authenticated role may update", async () => {
    respondToUpdate();

    await updateFood(createTestClient(), FOOD_ID, customFoodInput());

    const [request] = requestsTo("PATCH", "foods");
    const written = Object.keys(request?.body ?? {});
    expect(written.length).toBeGreaterThan(0);
    expect(written.filter((column) => !UPDATABLE_FOOD_COLUMNS.includes(column))).toEqual([]);
    expect(request?.url.searchParams.get("id")).toBe(`eq.${FOOD_ID}`);
  });

  it("should clear optional values the input leaves out", async () => {
    respondToUpdate();
    const input = customFoodInputSchema.parse({
      name: "Plain",
      basis: "per_100g",
      kcal: 1,
      protein_g: 1,
      fat_g: 1,
      carbs_g: 1,
      portions: [],
    });

    await updateFood(createTestClient(), FOOD_ID, input);

    const [request] = requestsTo("PATCH", "foods");
    expect(request?.body).toMatchObject({
      brand: null,
      barcode: null,
      density_g_per_ml: null,
      fibre_g: null,
    });
  });

  it("should write saturated fat, sugars and salt when the input carries them", async () => {
    respondToUpdate();

    await updateFood(createTestClient(), FOOD_ID, carryingInput());

    const [request] = requestsTo("PATCH", "foods");
    expect(request?.body).toEqual({
      name: "Protein flapjack",
      brand: "Home made",
      barcode: "0036000291452",
      basis: "per_100g",
      density_g_per_ml: 1.1,
      kcal: 410,
      protein_g: 22,
      fat_g: 14,
      carbs_g: 45,
      fibre_g: 6,
      sat_fat_g: 3.5,
      sugars_g: 12,
      salt_g: 0.4,
    });
  });

  it("should never write saturated fat, sugars or salt the input leaves out, so an edit cannot clear them", async () => {
    respondToUpdate();

    await updateFood(createTestClient(), FOOD_ID, customFoodInput());

    const [request] = requestsTo("PATCH", "foods");
    expect(request?.body).toEqual({
      name: "Protein flapjack",
      brand: "Home made",
      barcode: "0036000291452",
      basis: "per_100g",
      density_g_per_ml: 1.1,
      kcal: 410,
      protein_g: 22,
      fat_g: 14,
      carbs_g: 45,
      fibre_g: 6,
    });
  });

  it("should write only the carried values the input has, leaving the others untouched", async () => {
    respondToUpdate();
    const input = customFoodInputSchema.parse({
      ...customFoodInputValues,
      salt_g: 0,
      portions: [],
    });

    await updateFood(createTestClient(), FOOD_ID, input);

    const [request] = requestsTo("PATCH", "foods");
    expect(request?.body).toMatchObject({ salt_g: 0 });
    expect(request?.body).not.toHaveProperty("sat_fat_g");
    expect(request?.body).not.toHaveProperty("sugars_g");
  });

  it("should replace the portions of the updated food in one call after the update", async () => {
    respondToUpdate();

    await updateFood(createTestClient(), FOOD_ID, customFoodInput(twoPortions));

    expect(recorded.map((request) => `${request.method} ${request.url.pathname}`)).toEqual([
      "PATCH /rest/v1/foods",
      "POST /rest/v1/rpc/replace_food_portions",
    ]);
    expect(rpcArguments("replace_food_portions")).toEqual({
      p_food_id: FOOD_ID,
      p_portions: [
        { label: "1 bar", grams: 60, ml: null, is_default: true },
        { label: "1 cup", grams: null, ml: 250, is_default: false },
      ],
    });
  });

  it("should replace the portions with one typical serving when the form has none", async () => {
    respondToUpdate();
    const estimate = estimatedPortion({ basis: "per_100g", kcal: foodRow().kcal });

    await updateFood(createTestClient(), FOOD_ID, customFoodInput());

    expect(rpcArguments("replace_food_portions").p_portions).toEqual([
      { label: estimate.label, grams: estimate.grams, ml: null, is_default: true },
    ]);
  });

  it("should leave exactly one default after saving portions with none chosen", async () => {
    respondToUpdate();

    await updateFood(
      createTestClient(),
      FOOD_ID,
      customFoodInput([
        { label: "1 bar", grams: 60, isDefault: false },
        { label: "1 cup", ml: 250, isDefault: false },
      ]),
    );

    expect(rpcArguments("replace_food_portions").p_portions).toMatchObject([
      { label: "1 bar", is_default: true },
      { label: "1 cup", is_default: false },
    ]);
  });

  it("should return the updated food", async () => {
    respondToUpdate();

    expect(await updateFood(createTestClient(), FOOD_ID, customFoodInput())).toEqual(foodRow());
  });

  it("should throw and leave the portions alone when no row was updated", async () => {
    server.use(
      http.patch(`${REST_URL}/foods`, ({ request }) => postgrestRows(request, [])),
      http.post(`${REST_URL}/rpc/replace_food_portions`, async ({ request }) => {
        await record(request);
        return HttpResponse.json([]);
      }),
    );

    await expect(
      updateFood(createTestClient(), FOOD_ID, customFoodInput(twoPortions)),
    ).rejects.toThrow(FOOD_ID);
    expect(rpcRequests("replace_food_portions")).toEqual([]);
  });

  it("should report a partial write naming the food, and say the previous portions were kept, when the portions are not replaced", async () => {
    server.use(
      http.patch(`${REST_URL}/foods`, ({ request }) => postgrestRows(request, [foodRow()])),
      http.post(`${REST_URL}/rpc/replace_food_portions`, () =>
        postgrestError(400, "23514", "Failing row contains (1 bar, 60)"),
      ),
    );

    const failure = await updateFood(
      createTestClient(),
      FOOD_ID,
      customFoodInput(twoPortions),
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(FoodsPartialWriteError);
    expect(failure).toMatchObject({ foodId: FOOD_ID, stage: "portions" });
    expect(failure).toHaveProperty("message", expect.stringContaining(FOOD_ID));
    expect(failure).toHaveProperty(
      "message",
      expect.stringMatching(/updated.*portions.*not replaced.*previous portions.*kept/i),
    );
    expect(failure).toHaveProperty("cause.cause", { code: "23514" });
    expect(String(failure)).not.toContain("1 bar");
  });

  it("should not report a partial write when the update itself fails", async () => {
    server.use(
      http.patch(`${REST_URL}/foods`, () => postgrestError(500, "XX000", "database unavailable")),
    );

    const failure = await updateFood(createTestClient(), FOOD_ID, customFoodInput()).catch(
      (error: unknown) => error,
    );

    expect(failure).not.toBeInstanceOf(FoodsPartialWriteError);
  });

  it("should refuse a row that has no owner and leave the portions alone", async () => {
    server.use(
      http.patch(`${REST_URL}/foods`, ({ request }) =>
        postgrestRows(request, [foodRow({ source: "cofid", owner_id: null, source_ref: "1-1" })]),
      ),
      http.post(`${REST_URL}/rpc/replace_food_portions`, async ({ request }) => {
        await record(request);
        return HttpResponse.json([]);
      }),
    );

    await expect(
      updateFood(createTestClient(), FOOD_ID, customFoodInput(twoPortions)),
    ).rejects.toThrow(/not a custom food/);
    expect(rpcRequests("replace_food_portions")).toEqual([]);
  });

  it("should throw an error whose cause is the database error code when the update fails", async () => {
    server.use(
      http.patch(`${REST_URL}/foods`, () => postgrestError(500, "XX000", "database unavailable")),
    );

    const failure = await updateFood(createTestClient(), FOOD_ID, customFoodInput()).catch(
      (error: unknown) => error,
    );

    expect(failure).toHaveProperty("cause", { code: "XX000" });
  });
});

describe("softDeleteFood", () => {
  const NOW = new Date("2026-10-15T09:30:00.000Z");

  const respondToSoftDelete = () => {
    server.use(
      http.patch(`${REST_URL}/foods`, async ({ request }) => {
        await record(request);
        return postgrestRows(request, [foodRow({ deleted_at: NOW.toISOString() })]);
      }),
    );
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should write only deleted_at, as the current time, to the food with this id", async () => {
    respondToSoftDelete();

    await softDeleteFood(createTestClient(), FOOD_ID);

    const requests = requestsTo("PATCH", "foods");
    expect(requests).toHaveLength(1);
    expect(requests[0]?.body).toEqual({ deleted_at: "2026-10-15T09:30:00.000Z" });
    expect(requests[0]?.url.searchParams.get("id")).toBe(`eq.${FOOD_ID}`);
  });

  it("should write nothing but the food row, so its portions stay", async () => {
    respondToSoftDelete();

    await softDeleteFood(createTestClient(), FOOD_ID);

    expect(recorded.map((request) => request.url.pathname)).toEqual(["/rest/v1/foods"]);
  });

  it("should resolve to the food with deleted_at set", async () => {
    respondToSoftDelete();

    const food = await softDeleteFood(createTestClient(), FOOD_ID);

    expect(food).toMatchObject({ id: FOOD_ID, deleted_at: NOW.toISOString() });
  });

  it("should throw that the food was not found or is not the caller's when no row was changed", async () => {
    server.use(http.patch(`${REST_URL}/foods`, ({ request }) => postgrestRows(request, [])));

    await expect(softDeleteFood(createTestClient(), FOOD_ID)).rejects.toThrow(
      `The food ${FOOD_ID} was not found or cannot be deleted`,
    );
  });

  it("should throw with the action and the database error code, and keep the code as the cause, when the request fails", async () => {
    server.use(
      http.patch(`${REST_URL}/foods`, () => postgrestError(500, "XX000", "database unavailable")),
    );

    const failure = await softDeleteFood(createTestClient(), FOOD_ID).catch(
      (error: unknown) => error,
    );

    expect(failure).toHaveProperty("message", "Could not delete the food (XX000)");
    expect(failure).toHaveProperty("cause", { code: "XX000" });
  });
});
