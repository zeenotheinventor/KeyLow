import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { EdgeFunctionError, RateLimitedError } from "../../src/errors";
import { getMyCheckinSchedule, runMyDueCheckins } from "../../src/repos/checkin";
import { createTestClient } from "../createTestClient";
import { RECOGNISABLE_MU_KCAL, installProgramFake, programRow } from "../support/program";
import { edgeErrorResponse } from "../support/search";

const RUN_CHECKIN_URL = "http://127.0.0.1:54321/functions/v1/run-checkin";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => {
  server.close();
});

const thrownBy = (action: () => Promise<unknown>) =>
  action().then(
    () => null,
    (thrown: unknown) => thrown,
  );

describe("getMyCheckinSchedule", () => {
  it("should be null when the user has no active program", async () => {
    installProgramFake(server, { programs: [] });

    expect(await getMyCheckinSchedule(createTestClient())).toBeNull();
  });

  it("should be null when the only program has ended", async () => {
    installProgramFake(server, { programs: [programRow({ ended_on: "2026-10-30" })] });

    expect(await getMyCheckinSchedule(createTestClient())).toBeNull();
  });

  it("should give the active program's next check-in date and the profile's time zone", async () => {
    installProgramFake(server, {
      programs: [programRow({ next_checkin_date: "2026-11-06" })],
      timeZone: "Pacific/Auckland",
    });

    expect(await getMyCheckinSchedule(createTestClient())).toEqual({
      nextCheckinDate: "2026-11-06",
      timeZone: "Pacific/Auckland",
    });
  });

  it("should give a null date for a program with no schedule yet", async () => {
    installProgramFake(server, {
      programs: [programRow({ next_checkin_date: null })],
      timeZone: "Europe/London",
    });

    expect(await getMyCheckinSchedule(createTestClient())).toEqual({
      nextCheckinDate: null,
      timeZone: "Europe/London",
    });
  });

  it("should give a null time zone for a profile with none", async () => {
    installProgramFake(server, { programs: [programRow()], timeZone: null });

    expect(await getMyCheckinSchedule(createTestClient())).toMatchObject({ timeZone: null });
  });

  it("should read only the date and the zone", async () => {
    const fake = installProgramFake(server, { programs: [programRow()] });

    await getMyCheckinSchedule(createTestClient());

    expect(fake.requestsTo("programs").map(({ url }) => url.searchParams.get("select"))).toEqual([
      "next_checkin_date",
    ]);
    expect(fake.requestsTo("profiles").map(({ url }) => url.searchParams.get("select"))).toEqual([
      "timezone",
    ]);
  });

  it("should throw an error naming the action and the code and nothing the database said", async () => {
    const consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    );
    const fake = installProgramFake(server, { programs: [programRow()] });
    fake.failWith("programs", "XX000");

    const failure = await thrownBy(() => getMyCheckinSchedule(createTestClient()));

    expect(failure).toBeInstanceOf(Error);
    expect(failure).toHaveProperty("message", "Could not load your check-in schedule (XX000)");
    expect(failure).toHaveProperty("cause", { code: "XX000" });
    expect(
      JSON.stringify({
        message: failure instanceof Error ? failure.message : null,
        cause: failure instanceof Error ? failure.cause : null,
        console: consoleSpies.map((spy) => spy.mock.calls),
      }),
    ).not.toContain(String(RECOGNISABLE_MU_KCAL));
  });
});

describe("runMyDueCheckins", () => {
  it("should post the due mode and return what the function answers", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(RUN_CHECKIN_URL, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ ran: 2, nextCheckinDate: "2026-11-13" });
      }),
    );

    const answer = await runMyDueCheckins(createTestClient());

    expect(bodies).toEqual([{ mode: "due" }]);
    expect(answer).toEqual({ ran: 2, nextCheckinDate: "2026-11-13" });
  });

  it("should answer a run that recorded nothing as ran 0", async () => {
    server.use(
      http.post(RUN_CHECKIN_URL, () => HttpResponse.json({ ran: 0, nextCheckinDate: null })),
    );

    expect(await runMyDueCheckins(createTestClient())).toEqual({
      ran: 0,
      nextCheckinDate: null,
    });
  });

  it("should be null when the function answers 409 no_program, which is nothing to do", async () => {
    server.use(
      http.post(RUN_CHECKIN_URL, () =>
        HttpResponse.json(
          { error: { code: "no_program", message: "No active program" } },
          { status: 409 },
        ),
      ),
    );

    expect(await runMyDueCheckins(createTestClient())).toBeNull();
  });

  it("should be null when the function answers 409 missing_stats, which is nothing to do", async () => {
    server.use(
      http.post(RUN_CHECKIN_URL, () =>
        HttpResponse.json(
          { error: { code: "missing_stats", message: "A stat is missing" } },
          { status: 409 },
        ),
      ),
    );

    expect(await runMyDueCheckins(createTestClient())).toBeNull();
  });

  it("should be null for a 409 whose code the shared edge error schema knows", async () => {
    server.use(
      http.post(RUN_CHECKIN_URL, () => edgeErrorResponse(409, "invalid_request", "Nothing to run")),
    );

    expect(await runMyDueCheckins(createTestClient())).toBeNull();
  });

  it("should throw a RateLimitedError on a 429", async () => {
    server.use(http.post(RUN_CHECKIN_URL, () => edgeErrorResponse(429, "rate_limited", "Slow", 9)));

    const failure = await thrownBy(() => runMyDueCheckins(createTestClient()));

    expect(failure).toBeInstanceOf(RateLimitedError);
    expect(failure).toHaveProperty("retryAfterSeconds", 9);
  });

  it("should throw any other typed refusal as an EdgeFunctionError with no value in it", async () => {
    server.use(
      http.post(RUN_CHECKIN_URL, () => edgeErrorResponse(500, "internal_error", "Something broke")),
    );

    const failure = await thrownBy(() => runMyDueCheckins(createTestClient()));

    expect(failure).toBeInstanceOf(EdgeFunctionError);
    expect(failure).toMatchObject({ code: "internal_error", status: 500 });
  });

  it("should throw a bad_mode refusal as an EdgeFunctionError", async () => {
    server.use(http.post(RUN_CHECKIN_URL, () => edgeErrorResponse(400, "bad_mode", "Bad mode")));

    const failure = await thrownBy(() => runMyDueCheckins(createTestClient()));

    expect(failure).toBeInstanceOf(EdgeFunctionError);
    expect(failure).toMatchObject({ code: "bad_mode", status: 400 });
  });

  it("should throw the generic error for a refusal the edge helpers cannot classify", async () => {
    server.use(
      http.post(RUN_CHECKIN_URL, () =>
        HttpResponse.json(
          { error: { code: "not_a_code", message: "Not a code" } },
          { status: 400 },
        ),
      ),
    );

    const failure = await thrownBy(() => runMyDueCheckins(createTestClient()));

    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(EdgeFunctionError);
    expect(failure).toHaveProperty("message", 'Edge function "run-checkin" failed');
  });

  it("should throw for a 500 that is not an edge error body", async () => {
    server.use(
      http.post(RUN_CHECKIN_URL, () => new HttpResponse("upstream down", { status: 500 })),
    );

    await expect(runMyDueCheckins(createTestClient())).rejects.toThrow(
      'Edge function "run-checkin" failed',
    );
  });

  it("should reject a response that breaks the contract", async () => {
    server.use(http.post(RUN_CHECKIN_URL, () => HttpResponse.json({ ran: "two" })));

    await expect(runMyDueCheckins(createTestClient())).rejects.toThrow();
  });
});
