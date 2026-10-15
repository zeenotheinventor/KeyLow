import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { acceptTerms, getMyTermsAcceptance } from "../../src/repos/terms";
import { createTestClient } from "../createTestClient";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";

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

describe("getMyTermsAcceptance", () => {
  it("should select only the two terms columns of the profiles table", async () => {
    let requestUrl: URL | undefined;
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) => {
        requestUrl = new URL(request.url);
        return postgrestRows(request, [{ terms_accepted_at: null, terms_version: null }]);
      }),
    );

    await getMyTermsAcceptance(createTestClient());

    expect(requestUrl?.searchParams.get("select")).toBe("terms_accepted_at,terms_version");
    expect(requestUrl?.searchParams.has("id")).toBe(false);
  });

  it("should return the accepted time and version", async () => {
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) =>
        postgrestRows(request, [
          { terms_accepted_at: "2026-10-15T09:30:00.123456+00:00", terms_version: "2026-10-15" },
        ]),
      ),
    );

    expect(await getMyTermsAcceptance(createTestClient())).toEqual({
      terms_accepted_at: "2026-10-15T09:30:00.123456+00:00",
      terms_version: "2026-10-15",
    });
  });

  it("should return nulls for a user who never accepted", async () => {
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) =>
        postgrestRows(request, [{ terms_accepted_at: null, terms_version: null }]),
      ),
    );

    expect(await getMyTermsAcceptance(createTestClient())).toEqual({
      terms_accepted_at: null,
      terms_version: null,
    });
  });

  it("should return null when the user has no profile row", async () => {
    server.use(http.get(`${REST_URL}/profiles`, ({ request }) => postgrestRows(request, [])));

    expect(await getMyTermsAcceptance(createTestClient())).toBeNull();
  });

  it("should throw with the database error as the cause when the request fails", async () => {
    server.use(
      http.get(`${REST_URL}/profiles`, () => postgrestError(500, "XX000", "database unavailable")),
    );

    await expect(getMyTermsAcceptance(createTestClient())).rejects.toMatchObject({
      message: "Could not load your terms acceptance: database unavailable",
      cause: { code: "XX000" },
    });
  });
});

describe("acceptTerms", () => {
  it("should call the accept_terms RPC with the version as p_version", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${REST_URL}/rpc/accept_terms`, async ({ request }) => {
        bodies.push(await request.json());
        return new Response(null, { status: 204 });
      }),
    );

    await acceptTerms(createTestClient(), "2026-10-15");

    expect(bodies).toEqual([{ p_version: "2026-10-15" }]);
  });

  it("should send the version untrimmed", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${REST_URL}/rpc/accept_terms`, async ({ request }) => {
        bodies.push(await request.json());
        return new Response(null, { status: 204 });
      }),
    );

    await acceptTerms(createTestClient(), " 2026-10-15");

    expect(bodies).toEqual([{ p_version: " 2026-10-15" }]);
  });

  it("should resolve to nothing", async () => {
    server.use(
      http.post(`${REST_URL}/rpc/accept_terms`, () => new Response(null, { status: 204 })),
    );

    await expect(acceptTerms(createTestClient(), "2026-10-15")).resolves.toBeUndefined();
  });

  it.each([
    { code: "28000", status: 403, reason: "there is no signed in user" },
    { code: "22023", status: 400, reason: "the version is blank" },
    { code: "P0002", status: 404, reason: "the user has no profile row" },
  ])(
    "should throw with the database error $code as the cause when $reason",
    async ({ code, status }) => {
      server.use(
        http.post(`${REST_URL}/rpc/accept_terms`, () =>
          HttpResponse.json(
            { code, message: "refused by the database", details: null, hint: null },
            { status },
          ),
        ),
      );

      await expect(acceptTerms(createTestClient(), "2026-10-15")).rejects.toMatchObject({
        message: "Could not accept the terms: refused by the database",
        cause: { code },
      });
    },
  );
});
