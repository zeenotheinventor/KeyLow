import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { EdgeFunctionError, RateLimitedError } from "../../src/errors";
import { searchOff } from "../../src/repos/off";
import { createTestClient } from "../createTestClient";
import { OFF_SEARCH_URL, edgeErrorResponse, offCandidate } from "../support/search";

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

describe("searchOff", () => {
  it("should post the query and return the candidates", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(OFF_SEARCH_URL, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ candidates: [offCandidate()] });
      }),
    );

    const candidates = await searchOff(createTestClient(), "  chicken soup ");

    expect(bodies).toEqual([{ q: "chicken soup" }]);
    expect(candidates).toEqual([offCandidate()]);
  });

  it("should clip a query longer than 100 characters instead of rejecting it", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(OFF_SEARCH_URL, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ candidates: [] });
      }),
    );

    await searchOff(createTestClient(), `  ${"a".repeat(150)}  `);

    expect(bodies).toEqual([{ q: "a".repeat(100) }]);
  });

  it("should reject a response that breaks the contract", async () => {
    server.use(
      http.post(OFF_SEARCH_URL, () =>
        HttpResponse.json({ candidates: [{ ...offCandidate(), code: "not digits" }] }),
      ),
    );

    await expect(searchOff(createTestClient(), "chicken")).rejects.toThrow();
  });

  it("should not call the function for a query the contract refuses", async () => {
    let calls = 0;
    server.use(
      http.post(OFF_SEARCH_URL, () => {
        calls += 1;
        return HttpResponse.json({ candidates: [] });
      }),
    );

    await expect(searchOff(createTestClient(), " c ")).rejects.toThrow();
    expect(calls).toBe(0);
  });

  describe("error mapping", () => {
    it("should map a 429 to a RateLimitedError carrying the retry delay", async () => {
      server.use(
        http.post(OFF_SEARCH_URL, () => edgeErrorResponse(429, "rate_limited", "Slow down", 20)),
      );

      const failure = await searchOff(createTestClient(), "chicken").catch(
        (error: unknown) => error,
      );

      expect(failure).toBeInstanceOf(RateLimitedError);
      expect(failure).toHaveProperty("retryAfterSeconds", 20);
    });

    it("should map a 429 with only a Retry-After header", async () => {
      server.use(
        http.post(OFF_SEARCH_URL, () =>
          HttpResponse.text("Too Many Requests", { status: 429, headers: { "Retry-After": "8" } }),
        ),
      );

      const failure = await searchOff(createTestClient(), "chicken").catch(
        (error: unknown) => error,
      );

      expect(failure).toBeInstanceOf(RateLimitedError);
      expect(failure).toHaveProperty("retryAfterSeconds", 8);
    });

    it("should map a typed edge error to an EdgeFunctionError with its code and status", async () => {
      server.use(
        http.post(OFF_SEARCH_URL, () =>
          edgeErrorResponse(502, "upstream_error", "Open Food Facts is unavailable"),
        ),
      );

      const failure = await searchOff(createTestClient(), "chicken").catch(
        (error: unknown) => error,
      );

      expect(failure).toBeInstanceOf(EdgeFunctionError);
      expect(failure).toMatchObject({ code: "upstream_error", status: 502 });
    });

    it("should leave any other failure as a plain error", async () => {
      server.use(
        http.post(OFF_SEARCH_URL, () => HttpResponse.text("Bad gateway", { status: 500 })),
      );

      const failure = await searchOff(createTestClient(), "chicken").catch(
        (error: unknown) => error,
      );

      expect(failure).toBeInstanceOf(Error);
      expect(failure).not.toBeInstanceOf(EdgeFunctionError);
      expect(failure).not.toBeInstanceOf(RateLimitedError);
    });
  });
});
