import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { listOwnFoods } from "../../src/repos/foods";
import { createTestClient } from "../createTestClient";
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

describe("listOwnFoods", () => {
  it("should ask for the live foods that have an owner, by name, at most 200 by default", async () => {
    let requestUrl: URL | undefined;
    server.use(
      http.get(`${REST_URL}/foods`, ({ request }) => {
        requestUrl = new URL(request.url);
        return postgrestRows(request, []);
      }),
    );

    await listOwnFoods(createTestClient());

    expect(requestUrl?.searchParams.get("owner_id")).toBe("not.is.null");
    expect(requestUrl?.searchParams.get("deleted_at")).toBe("is.null");
    expect(requestUrl?.searchParams.get("order")).toBe("name.asc,created_at.asc");
    expect(requestUrl?.searchParams.get("limit")).toBe("200");
  });

  it("should never ask for the database-only search column", async () => {
    let requestUrl: URL | undefined;
    server.use(
      http.get(`${REST_URL}/foods`, ({ request }) => {
        requestUrl = new URL(request.url);
        return postgrestRows(request, []);
      }),
    );

    await listOwnFoods(createTestClient());

    expect(requestUrl?.searchParams.get("select")?.split(",")).not.toContain("search");
  });

  it("should pass the limit it is given", async () => {
    let requestUrl: URL | undefined;
    server.use(
      http.get(`${REST_URL}/foods`, ({ request }) => {
        requestUrl = new URL(request.url);
        return postgrestRows(request, []);
      }),
    );

    await listOwnFoods(createTestClient(), { limit: 10 });

    expect(requestUrl?.searchParams.get("limit")).toBe("10");
  });

  it("should resolve to an empty list when the caller has no foods", async () => {
    server.use(http.get(`${REST_URL}/foods`, ({ request }) => postgrestRows(request, [])));

    expect(await listOwnFoods(createTestClient())).toEqual([]);
  });

  it("should return the foods in the order the database answered", async () => {
    const rows = [
      foodRow({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Apple crumble" }),
      foodRow({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Protein flapjack" }),
    ];
    server.use(http.get(`${REST_URL}/foods`, ({ request }) => postgrestRows(request, rows)));

    expect(await listOwnFoods(createTestClient())).toEqual(rows);
  });

  it("should throw when the request fails", async () => {
    server.use(
      http.get(`${REST_URL}/foods`, () => postgrestError(500, "XX000", "Database unavailable")),
    );

    await expect(listOwnFoods(createTestClient())).rejects.toThrow(
      "Could not list your foods: Database unavailable",
    );
  });

  it("should reject a row that breaks the food contract", async () => {
    server.use(
      http.get(`${REST_URL}/foods`, ({ request }) =>
        postgrestRows(request, [{ ...foodRow(), kcal: -1 }]),
      ),
    );

    await expect(listOwnFoods(createTestClient())).rejects.toThrow();
  });
});
