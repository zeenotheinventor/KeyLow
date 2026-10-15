import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { updateMyTimeZone } from "../../src/repos/targets";
import { createTestClient } from "../createTestClient";
import {
  AUTH_USER_URL,
  REST_URL,
  SIGNED_IN_USER_ID,
  postgrestError,
  postgrestRows,
  signInAs,
} from "../support/postgrest";

const server = setupServer();

let requestUrl: URL | undefined;
let body: unknown;

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  requestUrl = undefined;
  body = undefined;
  server.use(
    http.get(AUTH_USER_URL, () =>
      HttpResponse.json({ id: SIGNED_IN_USER_ID, aud: "authenticated", role: "authenticated" }),
    ),
    http.patch(`${REST_URL}/profiles`, async ({ request }) => {
      requestUrl = new URL(request.url);
      body = await request.json();
      return postgrestRows(request, [{ timezone: "Europe/London" }]);
    }),
  );
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

async function signedInClient() {
  const client = createTestClient();
  await signInAs(client, SIGNED_IN_USER_ID);
  return client;
}

describe("updateMyTimeZone", () => {
  it("should update the profile row of the signed in user", async () => {
    await updateMyTimeZone(await signedInClient(), "Europe/London");

    expect(requestUrl?.searchParams.get("id")).toBe(`eq.${SIGNED_IN_USER_ID}`);
  });

  it("should write the time zone column and no other", async () => {
    await updateMyTimeZone(await signedInClient(), "Europe/London");

    // A strict schema refuses any other key.
    expect(z.strictObject({ timezone: z.literal("Europe/London") }).parse(body)).toEqual({
      timezone: "Europe/London",
    });
  });

  it("should make no write when nobody is signed in", async () => {
    server.use(
      http.get(AUTH_USER_URL, () => HttpResponse.json({ message: "no session" }, { status: 401 })),
    );

    await expect(updateMyTimeZone(createTestClient(), "Europe/London")).rejects.toThrow(
      "Could not save your time zone",
    );
    expect(requestUrl).toBeUndefined();
  });

  it("should name the action and the error code only, never the zone", async () => {
    server.use(
      http.patch(`${REST_URL}/profiles`, () =>
        postgrestError(400, "22023", 'invalid zone "Europe/London"'),
      ),
    );

    const failure = updateMyTimeZone(await signedInClient(), "Europe/London");

    await expect(failure).rejects.toThrow(new Error("Could not save your time zone (22023)"));
    await expect(failure).rejects.toHaveProperty("cause", { code: "22023" });
  });
});
