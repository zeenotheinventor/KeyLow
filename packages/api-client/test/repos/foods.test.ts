import { customFoodInputSchema } from "@keylow/core/schemas";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  FoodsPartialWriteError,
  createFood,
  getFood,
  listFoodPortions,
  replaceFoodPortions,
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

  it("should throw an error carrying the PostgREST error as its cause", async () => {
    server.use(
      http.get(`${REST_URL}/foods`, () => postgrestError(500, "XX000", "database unavailable")),
    );

    const failure = await getFood(createTestClient(), FOOD_ID).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(failure).toHaveProperty("cause.message", "database unavailable");
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

  it("should throw an error carrying the PostgREST error as its cause", async () => {
    server.use(
      http.get(`${REST_URL}/food_portions`, () =>
        postgrestError(500, "XX000", "database unavailable"),
      ),
    );

    const failure = await listFoodPortions(createTestClient(), FOOD_ID).catch(
      (error: unknown) => error,
    );

    expect(failure).toHaveProperty("cause.message", "database unavailable");
  });
});

describe("createFood", () => {
  const respondToInserts = () => {
    server.use(
      http.post(`${REST_URL}/foods`, async ({ request }) => {
        await record(request);
        return postgrestRows(request, [foodRow()], 201);
      }),
      http.post(`${REST_URL}/food_portions`, async ({ request }) => {
        await record(request);
        return postgrestRows(request, [portionRow()], 201);
      }),
    );
  };

  it("should insert only columns that the authenticated role may write", async () => {
    respondToInserts();

    await createFood(createTestClient(), SIGNED_IN_USER_ID, customFoodInput());

    const [request] = requestsTo("POST", "foods");
    const written = Object.keys(request?.body ?? {});
    expect(written.length).toBeGreaterThan(0);
    expect(written.filter((column) => !INSERTABLE_FOOD_COLUMNS.includes(column))).toEqual([]);
  });

  it("should write a user food owned by the given user with empty micros", async () => {
    respondToInserts();

    await createFood(createTestClient(), SIGNED_IN_USER_ID, customFoodInput());

    const [request] = requestsTo("POST", "foods");
    expect(request?.body).toMatchObject({
      source: "user",
      owner_id: SIGNED_IN_USER_ID,
      micros: {},
    });
  });

  it("should write the canonical, trimmed values from the input", async () => {
    respondToInserts();

    await createFood(createTestClient(), SIGNED_IN_USER_ID, customFoodInput());

    const [request] = requestsTo("POST", "foods");
    expect(request?.body).toMatchObject({
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
    respondToInserts();
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

    const [request] = requestsTo("POST", "foods");
    expect(request?.body).toMatchObject({
      brand: null,
      barcode: null,
      density_g_per_ml: null,
      fibre_g: null,
    });
  });

  it("should write saturated fat, sugars and salt when the input carries them", async () => {
    respondToInserts();

    await createFood(createTestClient(), SIGNED_IN_USER_ID, carryingInput());

    const [request] = requestsTo("POST", "foods");
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
      source: "user",
      owner_id: SIGNED_IN_USER_ID,
      micros: {},
    });
  });

  it("should write null for saturated fat, sugars and salt the input leaves out", async () => {
    respondToInserts();

    await createFood(createTestClient(), SIGNED_IN_USER_ID, customFoodInput());

    const [request] = requestsTo("POST", "foods");
    expect(request?.body).toMatchObject({ sat_fat_g: null, sugars_g: null, salt_g: null });
  });

  it("should write a carried zero as zero, not as null", async () => {
    respondToInserts();

    await createFood(
      createTestClient(),
      SIGNED_IN_USER_ID,
      customFoodInputSchema.parse({ ...carryingInputValues, sat_fat_g: 0, sugars_g: 0, salt_g: 0 }),
    );

    const [request] = requestsTo("POST", "foods");
    expect(request?.body).toMatchObject({ sat_fat_g: 0, sugars_g: 0, salt_g: 0 });
  });

  it("should return the created food with no portions when none were given", async () => {
    respondToInserts();

    const created = await createFood(createTestClient(), SIGNED_IN_USER_ID, customFoodInput());

    expect(created).toEqual({ food: foodRow(), portions: [] });
  });

  it("should return the created food with the portions the database stored", async () => {
    respondToInserts();

    const created = await createFood(
      createTestClient(),
      SIGNED_IN_USER_ID,
      customFoodInput(twoPortions),
    );

    expect(created).toEqual({ food: foodRow(), portions: [portionRow()] });
  });

  it("should insert the portions with the owner, the food id and their position", async () => {
    respondToInserts();

    await createFood(createTestClient(), SIGNED_IN_USER_ID, customFoodInput(twoPortions));

    const [request] = requestsTo("POST", "food_portions");
    expect(request?.body).toEqual([
      {
        owner_id: SIGNED_IN_USER_ID,
        food_id: FOOD_ID,
        label: "1 bar",
        grams: 60,
        ml: null,
        is_default: true,
        position: 0,
      },
      {
        owner_id: SIGNED_IN_USER_ID,
        food_id: FOOD_ID,
        label: "1 cup",
        grams: null,
        ml: 250,
        is_default: false,
        position: 1,
      },
    ]);
  });

  it("should not call the portions endpoint when there are no portions", async () => {
    respondToInserts();

    await createFood(createTestClient(), SIGNED_IN_USER_ID, customFoodInput());

    expect(requestsTo("POST", "food_portions")).toEqual([]);
  });

  it("should throw an error carrying the PostgREST error and skip the portions when the food insert fails", async () => {
    server.use(
      http.post(`${REST_URL}/foods`, async ({ request }) => {
        await record(request);
        return postgrestError(403, "42501", "permission denied for table foods");
      }),
      http.post(`${REST_URL}/food_portions`, async ({ request }) => {
        await record(request);
        return postgrestRows(request, [portionRow()], 201);
      }),
    );

    const failure = await createFood(
      createTestClient(),
      SIGNED_IN_USER_ID,
      customFoodInput(twoPortions),
    ).catch((error: unknown) => error);

    expect(failure).toHaveProperty("cause.code", "42501");
    expect(requestsTo("POST", "food_portions")).toEqual([]);
  });

  it("should say the food was created but its portions were not, naming the food id, when the portions insert fails", async () => {
    server.use(
      http.post(`${REST_URL}/foods`, ({ request }) => postgrestRows(request, [foodRow()], 201)),
      http.post(`${REST_URL}/food_portions`, () =>
        postgrestError(403, "42501", "new row violates row-level security policy"),
      ),
    );

    const failure = await createFood(
      createTestClient(),
      SIGNED_IN_USER_ID,
      customFoodInput(twoPortions),
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(FoodsPartialWriteError);
    expect(failure).toMatchObject({ foodId: FOOD_ID, stage: "portions" });
    expect(failure).toHaveProperty("message", expect.stringContaining(FOOD_ID));
    expect(failure).toHaveProperty("message", expect.stringMatching(/created.*portions.*not/i));
    expect(failure).toHaveProperty("cause.code", "42501");
  });

  it("should not report a partial write when the food insert itself fails", async () => {
    server.use(http.post(`${REST_URL}/foods`, () => postgrestError(403, "42501", "denied")));

    const failure = await createFood(
      createTestClient(),
      SIGNED_IN_USER_ID,
      customFoodInput(twoPortions),
    ).catch((error: unknown) => error);

    expect(failure).not.toBeInstanceOf(FoodsPartialWriteError);
  });
});

describe("replaceFoodPortions", () => {
  const respondToPortionWrites = () => {
    server.use(
      http.delete(`${REST_URL}/food_portions`, async ({ request }) => {
        await record(request);
        return new Response(null, { status: 204 });
      }),
      http.post(`${REST_URL}/food_portions`, async ({ request }) => {
        await record(request);
        return postgrestRows(request, [portionRow()], 201);
      }),
    );
  };

  it("should delete the food's portions before inserting the new ones", async () => {
    respondToPortionWrites();

    await replaceFoodPortions(createTestClient(), FOOD_ID, SIGNED_IN_USER_ID, twoPortions);

    expect(recorded.map((request) => request.method)).toEqual(["DELETE", "POST"]);
    expect(recorded[0]?.url.searchParams.get("food_id")).toBe(`eq.${FOOD_ID}`);
  });

  it("should only delete when the new list is empty", async () => {
    respondToPortionWrites();

    const portions = await replaceFoodPortions(createTestClient(), FOOD_ID, SIGNED_IN_USER_ID, []);

    expect(portions).toEqual([]);
    expect(recorded.map((request) => request.method)).toEqual(["DELETE"]);
  });

  it("should return the inserted portions", async () => {
    respondToPortionWrites();

    const portions = await replaceFoodPortions(
      createTestClient(),
      FOOD_ID,
      SIGNED_IN_USER_ID,
      twoPortions,
    );

    expect(portions).toEqual([portionRow()]);
  });

  it("should throw an error carrying the PostgREST error and skip the insert when the delete fails", async () => {
    server.use(
      http.delete(`${REST_URL}/food_portions`, () =>
        postgrestError(500, "XX000", "database unavailable"),
      ),
      http.post(`${REST_URL}/food_portions`, async ({ request }) => {
        await record(request);
        return postgrestRows(request, [portionRow()], 201);
      }),
    );

    const failure = await replaceFoodPortions(
      createTestClient(),
      FOOD_ID,
      SIGNED_IN_USER_ID,
      twoPortions,
    ).catch((error: unknown) => error);

    expect(failure).toHaveProperty("cause.message", "database unavailable");
    expect(failure).toHaveProperty("message", expect.stringContaining(FOOD_ID));
    expect(failure).not.toBeInstanceOf(FoodsPartialWriteError);
    expect(requestsTo("POST", "food_portions")).toEqual([]);
  });

  it("should report a partial write naming the food and what was left behind when the insert fails", async () => {
    server.use(
      http.delete(`${REST_URL}/food_portions`, () => new Response(null, { status: 204 })),
      http.post(`${REST_URL}/food_portions`, () =>
        postgrestError(403, "42501", "new row violates row-level security policy"),
      ),
    );

    const failure = await replaceFoodPortions(
      createTestClient(),
      FOOD_ID,
      SIGNED_IN_USER_ID,
      twoPortions,
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(FoodsPartialWriteError);
    expect(failure).toMatchObject({ foodId: FOOD_ID, stage: "portions" });
    expect(failure).toHaveProperty("message", expect.stringContaining(FOOD_ID));
    expect(failure).toHaveProperty(
      "message",
      expect.stringMatching(/old portions.*removed.*new portions.*not saved/i),
    );
    expect(failure).toHaveProperty("cause.code", "42501");
  });

  it("should delete nothing and return no portions for a food the caller cannot edit", async () => {
    // RLS filters the delete silently, so it reports success with no rows, and the empty list ends there.
    respondToPortionWrites();

    expect(await replaceFoodPortions(createTestClient(), FOOD_ID, SIGNED_IN_USER_ID, [])).toEqual(
      [],
    );
  });
});

describe("updateFood", () => {
  const respondToUpdate = () => {
    server.use(
      http.patch(`${REST_URL}/foods`, async ({ request }) => {
        await record(request);
        return postgrestRows(request, [foodRow()]);
      }),
      http.delete(`${REST_URL}/food_portions`, async ({ request }) => {
        await record(request);
        return new Response(null, { status: 204 });
      }),
      http.post(`${REST_URL}/food_portions`, async ({ request }) => {
        await record(request);
        return postgrestRows(request, [portionRow()], 201);
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

  it("should replace the portions with the owner of the updated food", async () => {
    respondToUpdate();

    await updateFood(createTestClient(), FOOD_ID, customFoodInput(twoPortions));

    expect(recorded.map((request) => request.method)).toEqual(["PATCH", "DELETE", "POST"]);
    expect(requestsTo("POST", "food_portions")[0]?.body).toMatchObject([
      { owner_id: SIGNED_IN_USER_ID, food_id: FOOD_ID, label: "1 bar", position: 0 },
      { owner_id: SIGNED_IN_USER_ID, food_id: FOOD_ID, label: "1 cup", position: 1 },
    ]);
  });

  it("should return the updated food", async () => {
    respondToUpdate();

    expect(await updateFood(createTestClient(), FOOD_ID, customFoodInput())).toEqual(foodRow());
  });

  it("should throw and leave the portions alone when no row was updated", async () => {
    server.use(
      http.patch(`${REST_URL}/foods`, ({ request }) => postgrestRows(request, [])),
      http.delete(`${REST_URL}/food_portions`, async ({ request }) => {
        await record(request);
        return new Response(null, { status: 204 });
      }),
    );

    await expect(
      updateFood(createTestClient(), FOOD_ID, customFoodInput(twoPortions)),
    ).rejects.toThrow(FOOD_ID);
    expect(requestsTo("DELETE", "food_portions")).toEqual([]);
  });

  it("should report a partial write naming the food when the new portions are not saved", async () => {
    server.use(
      http.patch(`${REST_URL}/foods`, ({ request }) => postgrestRows(request, [foodRow()])),
      http.delete(`${REST_URL}/food_portions`, () => new Response(null, { status: 204 })),
      http.post(`${REST_URL}/food_portions`, () =>
        postgrestError(403, "42501", "new row violates row-level security policy"),
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
      expect.stringMatching(/updated.*old portions.*removed/i),
    );
  });

  it("should report a partial write when the old portions cannot be removed after the food was updated", async () => {
    server.use(
      http.patch(`${REST_URL}/foods`, ({ request }) => postgrestRows(request, [foodRow()])),
      http.delete(`${REST_URL}/food_portions`, () =>
        postgrestError(500, "XX000", "database unavailable"),
      ),
    );

    const failure = await updateFood(
      createTestClient(),
      FOOD_ID,
      customFoodInput(twoPortions),
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(FoodsPartialWriteError);
    expect(failure).toHaveProperty(
      "message",
      expect.stringMatching(/updated.*portions.*not replaced/i),
    );
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
      http.delete(`${REST_URL}/food_portions`, async ({ request }) => {
        await record(request);
        return new Response(null, { status: 204 });
      }),
    );

    await expect(
      updateFood(createTestClient(), FOOD_ID, customFoodInput(twoPortions)),
    ).rejects.toThrow(/not a custom food/);
    expect(requestsTo("DELETE", "food_portions")).toEqual([]);
  });

  it("should throw an error carrying the PostgREST error when the update fails", async () => {
    server.use(
      http.patch(`${REST_URL}/foods`, () => postgrestError(500, "XX000", "database unavailable")),
    );

    const failure = await updateFood(createTestClient(), FOOD_ID, customFoodInput()).catch(
      (error: unknown) => error,
    );

    expect(failure).toHaveProperty("cause.message", "database unavailable");
  });
});
