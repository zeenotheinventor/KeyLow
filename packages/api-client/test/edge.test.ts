import { FunctionsHttpError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { createTestClient } from "./createTestClient";
import { invokeEdgeFunction } from "../src/edge";
import { EdgeFunctionError, RateLimitedError } from "../src/errors";

// client.functions is a getter that builds a new FunctionsClient on every access,
// so the getter is pinned to one instance before that instance's invoke is spied on.
function spyOnInvoke(client: ReturnType<typeof createTestClient>) {
  const functionsClient = client.functions;
  vi.spyOn(client, "functions", "get").mockReturnValue(functionsClient);
  return vi.spyOn(functionsClient, "invoke");
}

describe("invokeEdgeFunction", () => {
  it("should return the data of the invoked function", async () => {
    const client = createTestClient();
    const invoke = spyOnInvoke(client).mockResolvedValue({
      data: { results: ["oats"] },
      error: null,
    });

    const response = await invokeEdgeFunction<{ results: string[] }>(client, "off-search", {
      query: "oats",
    });

    expect(response).toEqual({ results: ["oats"] });
    expect(invoke).toHaveBeenCalledWith("off-search", { body: { query: "oats" } });
  });

  it("should throw an error naming the function and carrying the cause when the invocation fails", async () => {
    const client = createTestClient();
    const failure = new FunctionsHttpError(new Response());
    spyOnInvoke(client).mockResolvedValue({ data: null, error: failure });

    const rejection = invokeEdgeFunction(client, "run-checkin");
    await expect(rejection).rejects.toThrow(/run-checkin/);
    await expect(rejection).rejects.toHaveProperty("cause", failure);
  });

  it("should throw an error naming the function when it returns no data", async () => {
    const client = createTestClient();
    spyOnInvoke(client).mockResolvedValue({ data: null, error: null });

    await expect(invokeEdgeFunction(client, "off-product")).rejects.toThrow(/off-product/);
  });

  describe("when the function answers with an error status", () => {
    const failWith = (status: number, body: unknown, headers: Record<string, string> = {}) => {
      const client = createTestClient();
      const failure = new FunctionsHttpError(
        new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers }),
      );
      spyOnInvoke(client).mockResolvedValue({ data: null, error: failure });
      return { client, failure };
    };

    it("should throw a RateLimitedError with the retry delay of the body on a 429", async () => {
      const { client, failure } = failWith(429, {
        error: { code: "rate_limited", message: "Slow down", retryAfterSeconds: 12 },
      });

      const rejection = invokeEdgeFunction(client, "off-search");

      await expect(rejection).rejects.toBeInstanceOf(RateLimitedError);
      await expect(rejection).rejects.toHaveProperty("retryAfterSeconds", 12);
      await expect(rejection).rejects.toHaveProperty("cause", failure);
    });

    it("should fall back to the Retry-After header when the body has no delay", async () => {
      const { client } = failWith(
        429,
        { error: { code: "rate_limited", message: "Slow down" } },
        { "Retry-After": "30" },
      );

      await expect(invokeEdgeFunction(client, "off-search")).rejects.toHaveProperty(
        "retryAfterSeconds",
        30,
      );
    });

    it("should throw a RateLimitedError without a delay on a 429 with an unreadable body", async () => {
      const { client } = failWith(429, "Too Many Requests");

      const rejection = invokeEdgeFunction(client, "off-search");

      await expect(rejection).rejects.toBeInstanceOf(RateLimitedError);
      await expect(rejection).rejects.toHaveProperty("retryAfterSeconds", undefined);
    });

    it("should throw an EdgeFunctionError with the status and the code of the body", async () => {
      const { client } = failWith(502, {
        error: { code: "upstream_error", message: "Open Food Facts is down" },
      });

      const rejection = invokeEdgeFunction(client, "off-search");

      await expect(rejection).rejects.toBeInstanceOf(EdgeFunctionError);
      await expect(rejection).rejects.toMatchObject({
        status: 502,
        code: "upstream_error",
        message: "Open Food Facts is down",
      });
    });

    it("should throw a plain error when the body is not a typed edge error", async () => {
      const { client, failure } = failWith(500, "Internal Server Error");

      const rejection = invokeEdgeFunction(client, "off-search");

      await expect(rejection).rejects.toThrow(/off-search/);
      await expect(rejection).rejects.not.toBeInstanceOf(EdgeFunctionError);
      await expect(rejection).rejects.toHaveProperty("cause", failure);
    });
  });
  describe("when the response is not a global Response, as React Native's fetch returns", () => {
    // Expo's fetch answers with its own class, so `instanceof Response` is false. Only what the code reads is given.
    class FetchResponseLike {
      constructor(
        readonly status: number,
        private readonly body: unknown,
        private readonly headerValues: Record<string, string> = {},
      ) {}

      readonly headers = { get: (name: string) => this.headerValues[name] ?? null };

      clone() {
        return new FetchResponseLike(this.status, this.body, this.headerValues);
      }

      json() {
        return Promise.resolve(this.body);
      }
    }

    const failWith = (response: FetchResponseLike) => {
      const client = createTestClient();
      spyOnInvoke(client).mockResolvedValue({
        data: null,
        error: new FunctionsHttpError(response),
      });
      return client;
    };

    it("should throw a RateLimitedError with the retry delay on a 429", async () => {
      expect(new FetchResponseLike(429, {})).not.toBeInstanceOf(Response);
      const client = failWith(
        new FetchResponseLike(
          429,
          { error: { code: "rate_limited", message: "Slow down" } },
          { "Retry-After": "30" },
        ),
      );

      const rejection = invokeEdgeFunction(client, "off-search");

      await expect(rejection).rejects.toBeInstanceOf(RateLimitedError);
      await expect(rejection).rejects.toHaveProperty("retryAfterSeconds", 30);
    });

    it("should throw an EdgeFunctionError with the code of the body on a 404", async () => {
      const client = failWith(
        new FetchResponseLike(404, {
          error: { code: "not_found", message: "No such product" },
        }),
      );

      const rejection = invokeEdgeFunction(client, "off-product");

      await expect(rejection).rejects.toBeInstanceOf(EdgeFunctionError);
      await expect(rejection).rejects.toMatchObject({ status: 404, code: "not_found" });
    });

    it("should throw a plain error when the context has no status", async () => {
      const client = failWith(Object.assign(new FetchResponseLike(0, {}), { status: undefined }));

      await expect(invokeEdgeFunction(client, "off-search")).rejects.not.toBeInstanceOf(
        RateLimitedError,
      );
    });
  });
});
