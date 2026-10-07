import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { searchFoods } from "../../src/repos/foods";
import { createTestClient } from "../createTestClient";
import { postgrestError } from "../support/postgrest";
import { SEARCH_FOODS_URL, searchHitRow } from "../support/search";

const server = setupServer();

let requests: unknown[] = [];

const answerWith = (rows: unknown[]) => {
  server.use(
    http.post(SEARCH_FOODS_URL, async ({ request }) => {
      requests.push(await request.json());
      return HttpResponse.json(rows);
    }),
  );
};

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
  requests = [];
});
afterAll(() => {
  server.close();
});

describe("searchFoods", () => {
  it("should call the RPC with the trimmed query and the default limit of 25", async () => {
    answerWith([]);

    await searchFoods(createTestClient(), "  chicken  ");

    expect(requests).toEqual([{ q: "chicken", lim: 25 }]);
  });

  it.each(["", " ", "c", "  c  "])(
    "should return an empty list without calling the RPC for the query %j",
    async (query) => {
      answerWith([searchHitRow()]);

      expect(await searchFoods(createTestClient(), query)).toEqual([]);
      expect(requests).toEqual([]);
    },
  );

  it.each([
    { requested: 0, sent: 1 },
    { requested: -5, sent: 1 },
    { requested: 10, sent: 10 },
    { requested: 50, sent: 50 },
    { requested: 500, sent: 50 },
    { requested: 7.9, sent: 7 },
  ])("should send a limit of $sent when $requested is asked for", async ({ requested, sent }) => {
    answerWith([]);

    await searchFoods(createTestClient(), "chicken", requested);

    expect(requests).toEqual([{ q: "chicken", lim: sent }]);
  });

  it("should parse the rows, keeping nulls and the score", async () => {
    const row = searchHitRow({ brand: null, barcode: null, deleted_at: null, score: 0.75 });
    answerWith([row]);

    expect(await searchFoods(createTestClient(), "chicken")).toEqual([row]);
  });

  it("should sort by score descending, then by name, keeping the order of equal rows", async () => {
    const low = searchHitRow({
      id: "00000000-0000-4000-8000-000000000001",
      name: "Apple",
      score: 1,
    });
    const highZ = searchHitRow({
      id: "00000000-0000-4000-8000-000000000002",
      name: "Zucchini",
      score: 2,
    });
    const highA = searchHitRow({
      id: "00000000-0000-4000-8000-000000000003",
      name: "Asparagus",
      score: 2,
    });
    const tieFirst = searchHitRow({
      id: "00000000-0000-4000-8000-000000000004",
      name: "Same",
      score: 2,
    });
    const tieSecond = searchHitRow({
      id: "00000000-0000-4000-8000-000000000005",
      name: "Same",
      score: 2,
    });
    answerWith([low, highZ, tieFirst, tieSecond, highA]);

    const hits = await searchFoods(createTestClient(), "food");

    expect(hits.map((hit) => hit.id)).toEqual([
      highA.id,
      tieFirst.id,
      tieSecond.id,
      highZ.id,
      low.id,
    ]);
  });

  it("should reject when a row is malformed instead of dropping it", async () => {
    answerWith([searchHitRow(), { ...searchHitRow(), basis: "per_cup" }]);

    await expect(searchFoods(createTestClient(), "chicken")).rejects.toThrow();
  });

  it("should reject when a row has no score", async () => {
    const withoutScore = Object.fromEntries(
      Object.entries(searchHitRow()).filter(([column]) => column !== "score"),
    );
    answerWith([withoutScore]);

    await expect(searchFoods(createTestClient(), "chicken")).rejects.toThrow();
  });

  it("should throw an error carrying the database error when the RPC fails", async () => {
    server.use(
      http.post(SEARCH_FOODS_URL, () => postgrestError(500, "XX000", "database unavailable")),
    );

    const failure = await searchFoods(createTestClient(), "chicken").catch(
      (error: unknown) => error,
    );

    expect(failure).toHaveProperty("cause.message", "database unavailable");
  });
});
