import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  getMyTargets,
  getMyTimeZone,
  getMyWeightUnit,
  updateMyTargets,
} from "../../src/repos/targets";
import { createTestClient } from "../createTestClient";
import {
  ACTIVE_PROGRAM_ID,
  activeProgram,
  closedEngineRow,
  ENDED_PROGRAM_ID,
  endedProgram,
  engineRow,
  profileTargetsRead,
  programsRead,
  targetsRead,
} from "../support/liveTargetsFake";
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
  // Most cases are about the profile's manual targets, so by default the user has no program and no row.
  beforeEach(() => {
    server.use(programsRead([]), targetsRead([]));
  });

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
      source: "manual",
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
      source: "manual",
    });
  });

  it("should return every target as null when the user has no profile row", async () => {
    server.use(http.get(`${REST_URL}/profiles`, ({ request }) => postgrestRows(request, [])));

    expect(await getMyTargets(createTestClient())).toEqual({
      kcal: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      source: "manual",
    });
  });

  it("should throw with the database error as the cause and no value in the message", async () => {
    server.use(
      http.get(`${REST_URL}/profiles`, () => postgrestError(500, "XX000", "database unavailable")),
    );

    await expect(getMyTargets(createTestClient())).rejects.toMatchObject({
      message: "Could not load your targets (XX000)",
      cause: { code: "XX000" },
    });
  });

  describe("while a program is active", () => {
    it("should read the current targets row, with its day-by-day calories, as the engine's", async () => {
      server.use(programsRead([activeProgram]), targetsRead([engineRow]));

      expect(await getMyTargets(createTestClient())).toEqual({
        kcal: 2140,
        protein_g: 126,
        carbs_g: 245,
        fat_g: 73,
        dowCaloriesKcal: [2200, 2200, 2200, 2200, 2200, 1900, 2100],
        source: "engine",
      });
    });

    it("should ask only for the active program, and only for the current row's figures", async () => {
      let programsUrl: URL | undefined;
      let targetsUrl: URL | undefined;
      server.use(
        http.get(`${REST_URL}/programs`, ({ request }) => {
          programsUrl = new URL(request.url);
          return postgrestRows(request, [activeProgram]);
        }),
        http.get(`${REST_URL}/targets`, ({ request }) => {
          targetsUrl = new URL(request.url);
          return postgrestRows(request, [engineRow]);
        }),
      );

      await getMyTargets(createTestClient());

      expect(programsUrl?.searchParams.get("select")).toBe("id");
      expect(programsUrl?.searchParams.get("ended_on")).toBe("is.null");
      expect(targetsUrl?.searchParams.get("select")).toBe(
        "program_id,calories_kcal,protein_g,fat_g,carbs_g,dow_calories_kcal",
      );
      expect(targetsUrl?.searchParams.get("effective_to")).toBe("is.null");
    });

    it("should make both reads together and no profile read", async () => {
      let programsRequested = false;
      let targetsRequested = false;
      let profileRequested = false;
      let bothStartedBeforeAnswering = false;
      server.use(
        http.get(`${REST_URL}/programs`, async ({ request }) => {
          programsRequested = true;
          await vi.waitFor(() => {
            expect(targetsRequested).toBe(true);
          });
          bothStartedBeforeAnswering = true;
          return postgrestRows(request, [activeProgram]);
        }),
        http.get(`${REST_URL}/targets`, ({ request }) => {
          targetsRequested = true;
          return postgrestRows(request, [engineRow]);
        }),
        http.get(`${REST_URL}/profiles`, ({ request }) => {
          profileRequested = true;
          return postgrestRows(request, [profileRow]);
        }),
      );

      await getMyTargets(createTestClient());

      expect(programsRequested).toBe(true);
      expect(bothStartedBeforeAnswering).toBe(true);
      expect(profileRequested).toBe(false);
    });

    it("should read the profile's manual targets when the program has no targets row yet", async () => {
      server.use(programsRead([activeProgram]), targetsRead([]), profileTargetsRead);

      expect(await getMyTargets(createTestClient())).toEqual({
        kcal: 2200,
        protein_g: 160,
        carbs_g: 220,
        fat_g: 70,
        source: "manual",
      });
    });

    it("should read the profile's manual targets when the only open row is an ended program's and the new program has none yet", async () => {
      server.use(
        programsRead([activeProgram]),
        targetsRead([{ ...engineRow, program_id: ENDED_PROGRAM_ID }]),
        profileTargetsRead,
      );

      expect(await getMyTargets(createTestClient())).toEqual({
        kcal: 2200,
        protein_g: 160,
        carbs_g: 220,
        fat_g: 70,
        source: "manual",
      });
    });

    it("should read the profile's manual targets when the open row names no program", async () => {
      server.use(
        programsRead([activeProgram]),
        targetsRead([{ ...engineRow, program_id: null }]),
        profileTargetsRead,
      );

      expect(await getMyTargets(createTestClient())).toMatchObject({
        kcal: 2200,
        source: "manual",
      });
    });

    it("should refuse a row whose day-by-day calories are not seven whole numbers, naming no figure", async () => {
      server.use(
        programsRead([activeProgram]),
        targetsRead([{ ...engineRow, dow_calories_kcal: [2140, 2140, 2140, 2140, 2140, 2140] }]),
      );

      const failure = getMyTargets(createTestClient());

      await expect(failure).rejects.toBeInstanceOf(RangeError);
      await expect(failure).rejects.toThrow(
        "The day of week figures must hold 7 whole numbers, Monday first.",
      );
    });
  });

  describe("when no program is active", () => {
    it("should read the profile's manual targets, not an ended program's row that is still open", async () => {
      server.use(
        programsRead([endedProgram]),
        targetsRead([{ ...engineRow, program_id: ENDED_PROGRAM_ID }]),
        profileTargetsRead,
      );

      expect(await getMyTargets(createTestClient())).toEqual({
        kcal: 2200,
        protein_g: 160,
        carbs_g: 220,
        fat_g: 70,
        source: "manual",
      });
    });

    it("should read the profile's manual targets when the only row is closed", async () => {
      server.use(programsRead([activeProgram]), targetsRead([closedEngineRow]), profileTargetsRead);

      expect(await getMyTargets(createTestClient())).toMatchObject({
        kcal: 2200,
        source: "manual",
      });
    });
  });

  describe("when a read fails", () => {
    it("should name the action and the code only when the program read fails", async () => {
      server.use(
        http.get(`${REST_URL}/programs`, () =>
          postgrestError(500, "XX001", "program 2140 kcal unavailable"),
        ),
        targetsRead([engineRow]),
      );

      const failure = getMyTargets(createTestClient());

      await expect(failure).rejects.toThrow(new Error("Could not load your targets (XX001)"));
      await expect(failure).rejects.toHaveProperty("cause", { code: "XX001" });
    });

    it("should name the action and the code only when the targets read fails", async () => {
      server.use(
        programsRead([activeProgram]),
        http.get(`${REST_URL}/targets`, () =>
          postgrestError(500, "XX002", "row with 2140 kcal unavailable"),
        ),
      );

      const failure = getMyTargets(createTestClient());

      await expect(failure).rejects.toThrow(new Error("Could not load your targets (XX002)"));
      await expect(failure).rejects.toHaveProperty("cause", { code: "XX002" });
    });
  });
});

describe("updateMyTargets", () => {
  const targets = { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 };

  // Most cases are about the profile write, so by default the user has no program to end.
  beforeEach(() => {
    server.use(programsRead([]));
  });

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
    expect(saved).toEqual({
      kcal: 2200,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      source: "manual",
    });
  });

  it("should return the saved targets", async () => {
    server.use(
      http.patch(`${REST_URL}/profiles`, ({ request }) => postgrestRows(request, [profileRow])),
    );

    expect(await updateMyTargets(createTestClient(), SIGNED_IN_USER_ID, targets)).toEqual({
      ...targets,
      source: "manual",
    });
  });

  describe("while a program is active", () => {
    type Request = { table: "programs" | "profiles"; body: unknown; url: URL };
    let writes: Request[] = [];

    beforeEach(() => {
      writes = [];
      server.use(
        programsRead([activeProgram]),
        http.get(`${REST_URL}/profiles`, ({ request }) =>
          postgrestRows(request, [{ timezone: "Europe/London" }]),
        ),
        http.patch(`${REST_URL}/programs`, async ({ request }) => {
          writes.push({ table: "programs", body: await request.json(), url: new URL(request.url) });
          return postgrestRows(request, [activeProgram]);
        }),
        http.patch(`${REST_URL}/profiles`, async ({ request }) => {
          writes.push({ table: "profiles", body: await request.json(), url: new URL(request.url) });
          return postgrestRows(request, [profileRow]);
        }),
      );
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should end it with an update of exactly ended_on and updated_at", async () => {
      vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-24T09:30:00.000Z") });

      await updateMyTargets(createTestClient(), SIGNED_IN_USER_ID, targets);

      const ending = writes.find((write) => write.table === "programs");
      expect(ending?.body).toStrictEqual({
        ended_on: "2026-10-24",
        updated_at: "2026-10-24T09:30:00.000Z",
      });
    });

    it("should end only that program, and only while it is still open", async () => {
      await updateMyTargets(createTestClient(), SIGNED_IN_USER_ID, targets);

      const ending = writes.find((write) => write.table === "programs");
      expect(ending?.url.searchParams.get("id")).toBe(`eq.${ACTIVE_PROGRAM_ID}`);
      expect(ending?.url.searchParams.get("ended_on")).toBe("is.null");
    });

    it("should end it on the user's local date, not the date in UTC", async () => {
      // 23:30 UTC on the 24th is already the 25th in Auckland, where the program was started.
      vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-24T23:30:00.000Z") });
      server.use(
        http.get(`${REST_URL}/profiles`, ({ request }) =>
          postgrestRows(request, [{ timezone: "Pacific/Auckland" }]),
        ),
      );

      await updateMyTargets(createTestClient(), SIGNED_IN_USER_ID, targets);

      const ending = writes.find((write) => write.table === "programs");
      expect(ending?.body).toMatchObject({ ended_on: "2026-10-25" });
    });

    it("should end it on the program's start date when that is later than the user's local date", async () => {
      // A user who moved to an earlier time zone: local today is the 24th, and the program started on the 25th.
      vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-24T09:30:00.000Z") });
      server.use(programsRead([{ ...activeProgram, started_on: "2026-10-25" }]));

      await updateMyTargets(createTestClient(), SIGNED_IN_USER_ID, targets);

      const ending = writes.find((write) => write.table === "programs");
      expect(ending?.body).toMatchObject({ ended_on: "2026-10-25" });
    });

    it("should end it on the user's local date when the program started the same day", async () => {
      vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-24T09:30:00.000Z") });
      server.use(programsRead([{ ...activeProgram, started_on: "2026-10-24" }]));

      await updateMyTargets(createTestClient(), SIGNED_IN_USER_ID, targets);

      const ending = writes.find((write) => write.table === "programs");
      expect(ending?.body).toMatchObject({ ended_on: "2026-10-24" });
    });

    it("should read a time zone the database does not know as UTC", async () => {
      vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-24T23:30:00.000Z") });
      server.use(
        http.get(`${REST_URL}/profiles`, ({ request }) =>
          postgrestRows(request, [{ timezone: "Not/AZone" }]),
        ),
      );

      await updateMyTargets(createTestClient(), SIGNED_IN_USER_ID, targets);

      const ending = writes.find((write) => write.table === "programs");
      expect(ending?.body).toMatchObject({ ended_on: "2026-10-24" });
    });

    it("should end the program before it writes the profile", async () => {
      await updateMyTargets(createTestClient(), SIGNED_IN_USER_ID, targets);

      expect(writes.map((write) => write.table)).toEqual(["programs", "profiles"]);
    });

    it("should stop before the profile write when ending the program fails, naming the code only", async () => {
      server.use(
        http.patch(`${REST_URL}/programs`, () =>
          postgrestError(500, "XX003", "program row for 2200 kcal unavailable"),
        ),
      );

      const failure = updateMyTargets(createTestClient(), SIGNED_IN_USER_ID, targets);

      await expect(failure).rejects.toThrow(new Error("Could not save your targets (XX003)"));
      await expect(failure).rejects.toHaveProperty("cause", { code: "XX003" });
      expect(writes.filter((write) => write.table === "profiles")).toEqual([]);
    });

    it("should stop before any write when reading the time zone fails", async () => {
      server.use(
        http.get(`${REST_URL}/profiles`, () => postgrestError(500, "XX005", "unavailable")),
      );

      await expect(updateMyTargets(createTestClient(), SIGNED_IN_USER_ID, targets)).rejects.toThrow(
        "XX005",
      );
      expect(writes).toEqual([]);
    });

    it("should stop before any write when reading the program fails", async () => {
      server.use(
        http.get(`${REST_URL}/programs`, () => postgrestError(500, "XX004", "unavailable")),
      );

      await expect(updateMyTargets(createTestClient(), SIGNED_IN_USER_ID, targets)).rejects.toThrow(
        "Could not save your targets (XX004)",
      );
      expect(writes).toEqual([]);
    });
  });

  it("should write only the profile when there is no active program to end", async () => {
    const writtenTables: string[] = [];
    server.use(
      programsRead([endedProgram]),
      http.patch(`${REST_URL}/programs`, ({ request }) => {
        writtenTables.push("programs");
        return postgrestRows(request, []);
      }),
      http.patch(`${REST_URL}/profiles`, ({ request }) => {
        writtenTables.push("profiles");
        return postgrestRows(request, [profileRow]);
      }),
    );

    await updateMyTargets(createTestClient(), SIGNED_IN_USER_ID, targets);

    expect(writtenTables).toEqual(["profiles"]);
  });

  it("should throw when no row was updated, as it is for a profile that is not the caller's", async () => {
    server.use(http.patch(`${REST_URL}/profiles`, ({ request }) => postgrestRows(request, [])));

    await expect(updateMyTargets(createTestClient(), SIGNED_IN_USER_ID, targets)).rejects.toThrow(
      "Could not save your targets",
    );
  });

  it("should name the action and the error code only, even when the database quotes the value", async () => {
    server.use(
      http.patch(`${REST_URL}/profiles`, () =>
        HttpResponse.json(
          {
            code: "22P02",
            message: 'invalid input syntax for type integer: "2200.5"',
            details: null,
            hint: null,
          },
          { status: 400 },
        ),
      ),
    );

    const failure = updateMyTargets(createTestClient(), SIGNED_IN_USER_ID, {
      ...targets,
      kcal: 2200.5,
    });

    await expect(failure).rejects.toThrow(new Error("Could not save your targets (22P02)"));
    await expect(failure).rejects.toHaveProperty("cause", { code: "22P02" });
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
      message: "Could not load your time zone (XX000)",
    });
  });
});

describe("getMyWeightUnit", () => {
  const unitIs = (weight_unit: string | null) => {
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) => postgrestRows(request, [{ weight_unit }])),
    );
  };

  it("should select only the weight_unit column", async () => {
    let requestUrl: URL | undefined;
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) => {
        requestUrl = new URL(request.url);
        return postgrestRows(request, [{ weight_unit: "kg" }]);
      }),
    );

    await getMyWeightUnit(createTestClient());

    expect(requestUrl?.searchParams.get("select")).toBe("weight_unit");
  });

  it.each(["kg", "lb"] as const)(
    "should return %s when the profile shows loads in it",
    async (unit) => {
      unitIs(unit);

      expect(await getMyWeightUnit(createTestClient())).toBe(unit);
    },
  );

  it.each([
    ["not set", null],
    ["stone, which training does not use", "st"],
    ["a value this build does not know", "oz"],
  ])("should read as kg when the unit is %s", async (_name, stored) => {
    unitIs(stored);

    expect(await getMyWeightUnit(createTestClient())).toBe("kg");
  });

  it("should read as kg when the user has no profile row", async () => {
    server.use(http.get(`${REST_URL}/profiles`, ({ request }) => postgrestRows(request, [])));

    expect(await getMyWeightUnit(createTestClient())).toBe("kg");
  });

  it("should name the action and the error code only when the database fails", async () => {
    server.use(
      http.get(`${REST_URL}/profiles`, () => postgrestError(500, "XX000", "database unavailable")),
    );

    await expect(getMyWeightUnit(createTestClient())).rejects.toMatchObject({
      message: "Could not load your weight unit (XX000)",
    });
  });
});
