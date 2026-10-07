import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { getFoodByBarcode } from "../../src/repos/foods";
import { createTestClient } from "../createTestClient";
import { VALID_BARCODE, globalFoodRow } from "../support/barcode";
import { REST_URL, foodRow, postgrestError, postgrestRows } from "../support/postgrest";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const ownFood = () => foodRow({ barcode: VALID_BARCODE });

describe("getFoodByBarcode", () => {
  it("should ask for the live rows with this exact barcode, the caller's own rows first", async () => {
    let requestUrl: URL | undefined;
    server.use(
      http.get(`${REST_URL}/foods`, ({ request }) => {
        requestUrl = new URL(request.url);
        return postgrestRows(request, []);
      }),
    );

    await getFoodByBarcode(createTestClient(), VALID_BARCODE);

    expect(requestUrl?.searchParams.get("barcode")).toBe(`eq.${VALID_BARCODE}`);
    expect(requestUrl?.searchParams.get("deleted_at")).toBe("is.null");
    expect(requestUrl?.searchParams.get("order")).toBe("owner_id.asc.nullslast,created_at.asc");
    expect(requestUrl?.searchParams.get("limit")).toBe("5");
  });

  it("should return null when no food has the barcode", async () => {
    server.use(http.get(`${REST_URL}/foods`, ({ request }) => postgrestRows(request, [])));

    expect(await getFoodByBarcode(createTestClient(), VALID_BARCODE)).toBeNull();
  });

  it("should return the food that has the barcode", async () => {
    server.use(
      http.get(`${REST_URL}/foods`, ({ request }) => postgrestRows(request, [globalFoodRow()])),
    );

    expect(await getFoodByBarcode(createTestClient(), VALID_BARCODE)).toEqual(globalFoodRow());
  });

  it("should prefer the caller's own row over a global row with the same barcode", async () => {
    server.use(
      http.get(`${REST_URL}/foods`, ({ request }) =>
        postgrestRows(request, [globalFoodRow(), ownFood()]),
      ),
    );

    const food = await getFoodByBarcode(createTestClient(), VALID_BARCODE);

    expect(food?.id).toBe(ownFood().id);
    expect(food?.owner_id).toBe(ownFood().owner_id);
  });

  it("should throw when the request fails", async () => {
    server.use(
      http.get(`${REST_URL}/foods`, () => postgrestError(500, "XX000", "Database unavailable")),
    );

    await expect(getFoodByBarcode(createTestClient(), VALID_BARCODE)).rejects.toThrow(
      "Could not look up the food by barcode: Database unavailable",
    );
  });

  it("should reject a row that breaks the food contract", async () => {
    server.use(
      http.get(`${REST_URL}/foods`, ({ request }) =>
        postgrestRows(request, [{ ...ownFood(), kcal: -1 }]),
      ),
    );

    await expect(getFoodByBarcode(createTestClient(), VALID_BARCODE)).rejects.toThrow();
  });
});
