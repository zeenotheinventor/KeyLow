import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { getMyTargets, getMyTimeZone, updateMyTargets } from "../../src/repos/targets";
import { createTestClient } from "../createTestClient";
import { REST_URL, SIGNED_IN_USER_ID, postgrestError, postgrestRows } from "../support/postgrest";

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

const profileRow = {
  target_kcal: 2200,
  target_protein_g: 160,
  target_carbs_g: 220,
  target_fat_g: 70,
};

describe("getMyTargets", () => {
  it("should select only the four target columns of the profiles table", async () => {
    let requestUrl: URL | undefined;
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) => {
        requestUrl = new URL(request.url);
        return postgrestRows(request, [profileRow]);
      }),
    );

    await getMyTargets(createTestClient());

    expect(requestUrl?.searchParams.get("select")).toBe(
      "target_kcal,target_protein_g,target_carbs_g,target_fat_g",
    );
  });

  it("should return the targets as core's progress bars name them", async () => {
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) => postgrestRows(request, [profileRow])),
    );

    expect(await getMyTargets(createTestClient())).toEqual({
      kcal: 2200,
      protein_g: 160,
      carbs_g: 220,
      fat_g: 70,
    });
  });

  it("should return every target as null for a user who never set one", async () => {
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) =>
        postgrestRows(request, [
          { target_kcal: null, target_protein_g: null, target_carbs_g: null, target_fat_g: null },
        ]),
      ),
    );

    expect(await getMyTargets(createTestClient())).toEqual({
      kcal: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
    });
  });

  it("should return every target as null when the user has no profile row", async () => {
    server.use(http.get(`${REST_URL}/profiles`, ({ request }) => postgrestRows(request, [])));

    expect(await getMyTargets(createTestClient())).toEqual({
      kcal: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
    });
  });

  it("should throw with the database error as the cause and no value in the message", async () => {
    server.use(
      http.get(`${REST_URL}/profiles`, () => postgrestError(500, "XX000", "database unavailable")),
    );

    await expect(getMyTargets(createTestClient())).rejects.toMatchObject({
      message: "Could not load your targets: database unavailable",
      cause: { code: "XX000" },
    });
  });
});

describe("updateMyTargets", () => {
  const targets = { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 };

  it("should update only the profile row of the given user, with only the target columns and the time", async () => {
    let requestUrl: URL | undefined;
    let body: unknown;
    server.use(
      http.patch(`${REST_URL}/profiles`, async ({ request }) => {
        requestUrl = new URL(request.url);
        body = await request.json();
        return postgrestRows(request, [profileRow]);
      }),
    );

    await updateMyTargets(createTestClient(), SIGNED_IN_USER_ID, targets);

    expect(requestUrl?.searchParams.get("id")).toBe(`eq.${SIGNED_IN_USER_ID}`);
    // Exactly these five columns, and nothing else: a strict schema refuses any other key.
    const written = z
      .strictObject({
        target_kcal: z.number(),
        target_protein_g: z.number(),
        target_carbs_g: z.number(),
        target_fat_g: z.number(),
        targets_updated_at: z.iso.datetime(),
      })
      .parse(body);
    expect(written).toMatchObject({
      target_kcal: 2200,
      target_protein_g: 160,
      target_carbs_g: 220,
      target_fat_g: 70,
    });
  });

  it("should clear a macro the user left blank, by writing null", async () => {
    let body: unknown;
    server.use(
      http.patch(`${REST_URL}/profiles`, async ({ request }) => {
        body = await request.json();
        return postgrestRows(request, [
          { ...profileRow, target_protein_g: null, target_carbs_g: null, target_fat_g: null },
        ]);
      }),
    );

    const saved = await updateMyTargets(createTestClient(), SIGNED_IN_USER_ID, {
      kcal: 2200,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
    });

    expect(body).toMatchObject({
      target_kcal: 2200,
      target_protein_g: null,
      target_carbs_g: null,
      target_fat_g: null,
    });
    expect(saved).toEqual({ kcal: 2200, protein_g: null, carbs_g: null, fat_g: null });
  });

  it("should return the saved targets", async () => {
    server.use(
      http.patch(`${REST_URL}/profiles`, ({ request }) => postgrestRows(request, [profileRow])),
    );

    expect(await updateMyTargets(createTestClient(), SIGNED_IN_USER_ID, targets)).toEqual(targets);
  });

  it("should throw when no row was updated, as it is for a profile that is not the caller's", async () => {
    server.use(http.patch(`${REST_URL}/profiles`, ({ request }) => postgrestRows(request, [])));

    await expect(updateMyTargets(createTestClient(), SIGNED_IN_USER_ID, targets)).rejects.toThrow(
      "Could not save your targets",
    );
  });

  it("should throw with the database error as the cause and no value in the message", async () => {
    server.use(
      http.patch(`${REST_URL}/profiles`, () =>
        HttpResponse.json(
          { code: "23514", message: "check constraint violated", details: null, hint: null },
          { status: 400 },
        ),
      ),
    );

    const failure = updateMyTargets(createTestClient(), SIGNED_IN_USER_ID, targets);

    await expect(failure).rejects.toMatchObject({ cause: { code: "23514" } });
    // A target is health data, so the message holds none of the digits that were sent.
    await expect(failure).rejects.toThrow(/^\D+$/);
  });
});

describe("getMyTimeZone", () => {
  it("should select only the timezone column", async () => {
    let requestUrl: URL | undefined;
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) => {
        requestUrl = new URL(request.url);
        return postgrestRows(request, [{ timezone: "Europe/London" }]);
      }),
    );

    await getMyTimeZone(createTestClient());

    expect(requestUrl?.searchParams.get("select")).toBe("timezone");
  });

  it("should return the profile's time zone", async () => {
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) =>
        postgrestRows(request, [{ timezone: "Europe/London" }]),
      ),
    );

    expect(await getMyTimeZone(createTestClient())).toBe("Europe/London");
  });

  it("should return null when the user has no profile row", async () => {
    server.use(http.get(`${REST_URL}/profiles`, ({ request }) => postgrestRows(request, [])));

    expect(await getMyTimeZone(createTestClient())).toBeNull();
  });

  it("should throw with the database error as the cause", async () => {
    server.use(
      http.get(`${REST_URL}/profiles`, () => postgrestError(500, "XX000", "database unavailable")),
    );

    await expect(getMyTimeZone(createTestClient())).rejects.toMatchObject({
      message: "Could not load your time zone: database unavailable",
    });
  });
});
