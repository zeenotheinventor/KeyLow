import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { reopenProgram } from "../../src/repos/program";
import { createTestClient } from "../createTestClient";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-03T10:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const PROGRAM_ID = "66666666-6666-4666-8666-666666666666";

type Fake = { patches: unknown[] };

// One latest program and the active one, as the two reads see them, and the write that clears `ended_on`.
function installFake({
  latest,
  active = null,
  updated = [{ id: PROGRAM_ID }],
  updateError,
}: {
  latest: { id: string; ended_on: string | null } | null;
  active?: { id: string } | null;
  updated?: unknown[];
  updateError?: { status: number; code: string };
}): Fake {
  const fake: Fake = { patches: [] };
  server.use(
    http.get(`${REST_URL}/programs`, ({ request }) => {
      const url = new URL(request.url);
      const isActiveRead = url.searchParams.get("ended_on") === "is.null";
      const row = isActiveRead ? active : latest;
      return postgrestRows(request, row === null ? [] : [row]);
    }),
    http.patch(`${REST_URL}/programs`, async ({ request }) => {
      fake.patches.push({ body: await request.json(), query: new URL(request.url).search });
      return updateError === undefined
        ? postgrestRows(request, updated)
        : postgrestError(updateError.status, updateError.code, "boom");
    }),
  );
  return fake;
}

describe("reopenProgram", () => {
  it("should clear ended_on and nothing else on the user's most recent program", async () => {
    const fake = installFake({ latest: { id: PROGRAM_ID, ended_on: "2026-11-03" } });

    await expect(reopenProgram(createTestClient(), PROGRAM_ID)).resolves.toBe(true);

    expect(fake.patches).toHaveLength(1);
    expect(fake.patches[0]).toMatchObject({
      body: { ended_on: null, updated_at: "2026-11-03T10:00:00.000Z" },
    });
    expect(Object.keys((fake.patches[0] as { body: object }).body).sort()).toEqual([
      "ended_on",
      "updated_at",
    ]);
  });

  it("should write nothing when the program is not the most recent one", async () => {
    const fake = installFake({
      latest: { id: "77777777-7777-4777-8777-777777777777", ended_on: "2026-11-03" },
    });

    await expect(reopenProgram(createTestClient(), PROGRAM_ID)).resolves.toBe(false);
    expect(fake.patches).toHaveLength(0);
  });

  it("should write nothing when another program is active", async () => {
    const fake = installFake({
      latest: { id: PROGRAM_ID, ended_on: "2026-11-03" },
      active: { id: "77777777-7777-4777-8777-777777777777" },
    });

    await expect(reopenProgram(createTestClient(), PROGRAM_ID)).resolves.toBe(false);
    expect(fake.patches).toHaveLength(0);
  });

  it("should write nothing when the program is not ended, or the user has no program", async () => {
    const notEnded = installFake({ latest: { id: PROGRAM_ID, ended_on: null } });
    await expect(reopenProgram(createTestClient(), PROGRAM_ID)).resolves.toBe(false);
    expect(notEnded.patches).toHaveLength(0);

    const none = installFake({ latest: null });
    await expect(reopenProgram(createTestClient(), PROGRAM_ID)).resolves.toBe(false);
    expect(none.patches).toHaveLength(0);
  });

  it("should answer false when the write matched no row or lost the race for the active slot", async () => {
    installFake({ latest: { id: PROGRAM_ID, ended_on: "2026-11-03" }, updated: [] });
    await expect(reopenProgram(createTestClient(), PROGRAM_ID)).resolves.toBe(false);

    installFake({
      latest: { id: PROGRAM_ID, ended_on: "2026-11-03" },
      updateError: { status: 409, code: "23505" },
    });
    await expect(reopenProgram(createTestClient(), PROGRAM_ID)).resolves.toBe(false);
  });

  it("should fail with the action and the code only", async () => {
    installFake({
      latest: { id: PROGRAM_ID, ended_on: "2026-11-03" },
      updateError: { status: 500, code: "XX000" },
    });

    const thrown = await reopenProgram(createTestClient(), PROGRAM_ID).then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(thrown).toEqual(new Error("Could not reopen your program (XX000)"));
    expect(thrown).toHaveProperty("cause", { code: "XX000" });
  });
});

describe("reopenProgram when the read fails", () => {
  it("should fail with the code and write nothing", async () => {
    server.use(
      http.get(`${REST_URL}/programs`, () => postgrestError(500, "XX000", "boom")),
      http.patch(`${REST_URL}/programs`, () => HttpResponse.json([{ id: PROGRAM_ID }])),
    );

    await expect(reopenProgram(createTestClient(), PROGRAM_ID)).rejects.toThrow(
      "Could not reopen your program (XX000)",
    );
  });
});
