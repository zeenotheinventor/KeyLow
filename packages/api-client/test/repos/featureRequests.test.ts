import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createFeatureRequest, isDailyLimitFailure } from "../../src/repos/featureRequests";
import { createTestClient } from "../createTestClient";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";

const REQUEST_ID = "77777777-7777-4777-8777-777777777777";

const context = {
  version: 1 as const,
  ask: "stub ask",
  unsupported: "stub unsupported",
  recent: [{ role: "user" as const, text: "stub turn" }],
};

type Recorded = { url: URL; method: string; body: unknown };

let recorded: Recorded[] = [];

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  recorded = [];
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const answerInsert = (respond: (request: Request) => Response) => {
  server.use(
    http.post(`${REST_URL}/feature_requests`, async ({ request }) => {
      recorded.push({
        url: new URL(request.url),
        method: request.method,
        body: await request.clone().json(),
      });
      return respond(request);
    }),
  );
};

const answerCreated = () => {
  answerInsert((request) => postgrestRows(request, [{ id: REQUEST_ID }], 201));
};

describe("createFeatureRequest", () => {
  it("should insert a trimmed more_menu request with a null context and resolve to its id", async () => {
    answerCreated();

    const created = await createFeatureRequest(createTestClient(), {
      source: "more_menu",
      request: "  stub request  ",
    });

    expect(created).toEqual({ id: REQUEST_ID });
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.body).toEqual({
      source: "more_menu",
      request: "stub request",
      context: null,
    });
  });

  it("should insert an assistant request with its context and never send a user id", async () => {
    answerCreated();

    await createFeatureRequest(createTestClient(), {
      source: "assistant",
      request: "stub request",
      context,
    });

    expect(recorded[0]?.body).toEqual({ source: "assistant", request: "stub request", context });
  });

  it("should refuse a request that is too short before any request is sent", async () => {
    answerCreated();

    const failure = await createFeatureRequest(createTestClient(), {
      source: "more_menu",
      request: "ab",
    }).catch((error: unknown) => error);

    expect(failure).toHaveProperty("message", "Could not send the feature request (invalid)");
    expect(failure).toHaveProperty("cause", { code: "invalid" });
    expect(recorded).toHaveLength(0);
  });

  it("should refuse an assistant request with no context before any request is sent", async () => {
    answerCreated();

    const failure = await createFeatureRequest(
      createTestClient(),
      // @ts-expect-error The type requires a context, and a caller that skips the type is still refused.
      { source: "assistant", request: "stub request" },
    ).catch((error: unknown) => error);

    expect(failure).toHaveProperty("cause", { code: "invalid" });
    expect(recorded).toHaveLength(0);
  });

  it("should map the daily cap to the code rate_limited", async () => {
    answerInsert(() => postgrestError(400, "54000", "feature_requests_daily_cap"));

    const failure = await createFeatureRequest(createTestClient(), {
      source: "more_menu",
      request: "stub request",
    }).catch((error: unknown) => error);

    expect(failure).toHaveProperty("message", "Could not send the feature request (rate_limited)");
    expect(failure).toHaveProperty("cause", { code: "rate_limited" });
  });

  it("should name the action and the database code only for any other failure", async () => {
    answerInsert(() => postgrestError(500, "XX000", "secret stub request text"));

    const failure = await createFeatureRequest(createTestClient(), {
      source: "more_menu",
      request: "secret stub request text",
    }).catch((error: unknown) => error);

    expect(failure).toHaveProperty("message", "Could not send the feature request (XX000)");
    expect(failure).toHaveProperty("cause", { code: "XX000" });
    expect(String(failure)).not.toContain("secret");
  });

  it("should not take another error with the cap code for the cap", async () => {
    answerInsert(() => postgrestError(400, "54000", "program too complex"));

    const failure = await createFeatureRequest(createTestClient(), {
      source: "more_menu",
      request: "stub request",
    }).catch((error: unknown) => error);

    expect(failure).toHaveProperty("cause", { code: "54000" });
  });
});

describe("isDailyLimitFailure", () => {
  it("should recognise the failure a reached daily cap throws", async () => {
    answerInsert(() => postgrestError(400, "54000", "feature_requests_daily_cap"));

    const failure = await createFeatureRequest(createTestClient(), {
      source: "more_menu",
      request: "stub request",
    }).catch((error: unknown) => error);

    expect(isDailyLimitFailure(failure)).toBe(true);
  });

  it("should not take any other failure for the cap", () => {
    expect(isDailyLimitFailure(new Error("x", { cause: { code: "XX000" } }))).toBe(false);
    expect(isDailyLimitFailure(new Error("x"))).toBe(false);
    expect(isDailyLimitFailure("rate_limited")).toBe(false);
  });
});
