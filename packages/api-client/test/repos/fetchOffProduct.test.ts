import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { EdgeFunctionError, RateLimitedError } from "../../src/errors";
import { fetchOffProduct } from "../../src/repos/off";
import { createTestClient } from "../createTestClient";
import { OFF_PRODUCT_URL, VALID_BARCODE, offProductResponse } from "../support/barcode";
import { edgeErrorResponse } from "../support/search";

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

describe("fetchOffProduct", () => {
  it("should post the code and return the food with its portions", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(OFF_PRODUCT_URL, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(offProductResponse());
      }),
    );

    const product = await fetchOffProduct(createTestClient(), VALID_BARCODE);

    expect(bodies).toEqual([{ code: VALID_BARCODE }]);
    expect(product).toEqual(offProductResponse());
  });

  it("should return null when Open Food Facts has no such product", async () => {
    server.use(
      http.post(OFF_PRODUCT_URL, () => edgeErrorResponse(404, "not_found", "No such product")),
    );

    expect(await fetchOffProduct(createTestClient(), VALID_BARCODE)).toBeNull();
  });

  it("should throw a RateLimitedError carrying the retry delay on a 429", async () => {
    server.use(
      http.post(OFF_PRODUCT_URL, () => edgeErrorResponse(429, "rate_limited", "Slow down", 20)),
    );

    const failure = await fetchOffProduct(createTestClient(), VALID_BARCODE).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(RateLimitedError);
    expect(failure).toHaveProperty("retryAfterSeconds", 20);
  });

  it("should throw any other typed refusal as an EdgeFunctionError", async () => {
    server.use(
      http.post(OFF_PRODUCT_URL, () =>
        edgeErrorResponse(502, "upstream_error", "Open Food Facts is unavailable"),
      ),
    );

    const failure = await fetchOffProduct(createTestClient(), VALID_BARCODE).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(EdgeFunctionError);
    expect(failure).toMatchObject({ code: "upstream_error", status: 502 });
  });

  it("should reject a response that breaks the contract", async () => {
    server.use(http.post(OFF_PRODUCT_URL, () => HttpResponse.json({ food: null, portions: [] })));

    await expect(fetchOffProduct(createTestClient(), VALID_BARCODE)).rejects.toThrow();
  });

  it("should not call the function for a code the contract refuses", async () => {
    let calls = 0;
    server.use(
      http.post(OFF_PRODUCT_URL, () => {
        calls += 1;
        return HttpResponse.json(offProductResponse());
      }),
    );

    await expect(fetchOffProduct(createTestClient(), "not digits")).rejects.toThrow();
    expect(calls).toBe(0);
  });
});
