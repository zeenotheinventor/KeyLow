import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { deleteSession, finishSession, startSession } from "../../src/repos/sessionWrites";
import { createTestClient } from "../createTestClient";
import {
  NEW_SESSION_ID,
  OPEN_SESSION_ID,
  RECOGNISABLE_NOTE,
  finishedSession,
  installSessionWritesFake,
  openSession,
} from "../support/sessionWrites";
import { RECOGNISABLE_DAY_NAME, ROUTINE_DAY_ID } from "../support/training";

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

const rejectionOf = async (call: Promise<unknown>): Promise<Error | null> => {
  try {
    await call;
  } catch (error) {
    return error instanceof Error ? error : new Error("(not an Error)");
  }
  return null;
};

const textOf = (error: Error | null) =>
  JSON.stringify({ message: error?.message, name: error?.name, cause: error?.cause });

const NOT_A_SESSION = "00000000-0000-4000-8000-000000000000";

// Monday 12 October 2026, 00:30 in London (BST), which is still Sunday in UTC.
const MONDAY_HALF_PAST_MIDNIGHT_IN_LONDON = new Date("2026-10-11T23:30:00Z");

describe("startSession", () => {
  it("should store the start, the local day in the zone, the zone and the routine day", async () => {
    const fake = installSessionWritesFake(server);

    await startSession(createTestClient(), {
      routineDayId: ROUTINE_DAY_ID,
      now: new Date("2026-10-18T09:00:00Z"),
      tz: "Europe/London",
    });

    expect(fake.inserts).toEqual([
      {
        started_at: "2026-10-18T09:00:00.000Z",
        local_date: "2026-10-18",
        tz: "Europe/London",
        routine_day_id: ROUTINE_DAY_ID,
      },
    ]);
  });

  it("should store a null routine day when the session is free", async () => {
    const fake = installSessionWritesFake(server);

    await startSession(createTestClient(), { now: new Date(), tz: "Europe/London" });

    expect(fake.inserts).toMatchObject([{ routine_day_id: null }]);
  });

  it("should store Monday for a start at 00:30 on Monday in London, which is Sunday in UTC", async () => {
    const fake = installSessionWritesFake(server);

    await startSession(createTestClient(), {
      now: MONDAY_HALF_PAST_MIDNIGHT_IN_LONDON,
      tz: "Europe/London",
    });

    expect(fake.inserts).toMatchObject([{ local_date: "2026-10-12", tz: "Europe/London" }]);
  });

  it("should resolve to the session as stored, with its routine day's name and no sets", async () => {
    installSessionWritesFake(server);

    const session = await startSession(createTestClient(), {
      routineDayId: ROUTINE_DAY_ID,
      now: new Date("2026-10-18T09:00:00Z"),
      tz: "Europe/London",
    });

    expect(session).toMatchObject({
      id: NEW_SESSION_ID,
      ended_at: null,
      routine_day_id: ROUTINE_DAY_ID,
      routine_day_name: RECOGNISABLE_DAY_NAME,
      sets: [],
    });
  });

  it("should resolve to the session in progress and insert nothing when there is one", async () => {
    const fake = installSessionWritesFake(server, { sessions: [openSession()] });

    const session = await startSession(createTestClient(), {
      routineDayId: ROUTINE_DAY_ID,
      now: new Date(),
      tz: "Europe/London",
    });

    expect(session.id).toBe(OPEN_SESSION_ID);
    expect(fake.inserts).toEqual([]);
  });

  it("should leave one open session when it is called twice, one call after the other", async () => {
    const fake = installSessionWritesFake(server);
    const client = createTestClient();
    const input = { now: new Date("2026-10-18T09:00:00Z"), tz: "Europe/London" };

    const first = await startSession(client, input);
    const second = await startSession(client, { ...input, now: new Date("2026-10-18T09:00:01Z") });

    expect(second.id).toBe(first.id);
    expect(fake.inserts).toHaveLength(1);
  });

  it("should start a new session when the only one has ended or been deleted", async () => {
    const fake = installSessionWritesFake(server, {
      sessions: [
        finishedSession({ id: "bbbbbbbb-bbbb-4bbb-8bbb-00000000aaaa" }),
        openSession({ deleted_at: "2026-10-18T09:30:00+00:00" }),
      ],
    });

    const session = await startSession(createTestClient(), {
      now: new Date(),
      tz: "Europe/London",
    });

    expect(session.id).toBe(NEW_SESSION_ID);
    expect(fake.inserts).toHaveLength(1);
  });

  it("should resolve to the session in progress that won the race when the insert is refused as a duplicate", async () => {
    const fake = installSessionWritesFake(server);
    fake.loseNextInsertsTo(openSession());

    const session = await startSession(createTestClient(), {
      routineDayId: ROUTINE_DAY_ID,
      now: new Date(),
      tz: "UTC",
    });

    expect(session.id).toBe(OPEN_SESSION_ID);
    expect(fake.inserts).toHaveLength(1);
  });

  it("should start the session again once when the insert is refused as a duplicate and no session in progress can be read", async () => {
    const fake = installSessionWritesFake(server);
    fake.loseNextInsertsTo(openSession({ deleted_at: "2026-10-18T09:30:00+00:00" }));

    const session = await startSession(createTestClient(), { now: new Date(), tz: "UTC" });

    expect(session.id).toBe(NEW_SESSION_ID);
    expect(fake.inserts).toHaveLength(2);
  });

  it("should name the action and the code only when the insert is refused as a duplicate twice with no session in progress to read", async () => {
    const fake = installSessionWritesFake(server);
    fake.loseNextInsertsTo(openSession({ deleted_at: "2026-10-18T09:30:00+00:00" }), 2);

    const error = await rejectionOf(
      startSession(createTestClient(), { now: new Date(), tz: "UTC" }),
    );

    expect(error?.message).toBe("Could not start the session (23505)");
    expect(error?.cause).toEqual({ code: "23505" });
    expect(textOf(error)).not.toContain(RECOGNISABLE_NOTE);
    expect(fake.inserts).toHaveLength(2);
  });

  it("should refuse a zone that is not an IANA name before any request", async () => {
    const fake = installSessionWritesFake(server);

    const error = await rejectionOf(
      startSession(createTestClient(), { now: new Date(), tz: "Mars/Olympus_Mons" }),
    );

    expect(error).toBeInstanceOf(RangeError);
    expect(error?.message).toBe("A session time zone must be an IANA name");
    expect(textOf(error)).not.toContain("Olympus");
    expect(fake.requestCount).toBe(0);
  });

  it("should refuse a routine day id that is not a UUID before any request", async () => {
    const fake = installSessionWritesFake(server);

    const error = await rejectionOf(
      startSession(createTestClient(), { routineDayId: "monday", now: new Date(), tz: "UTC" }),
    );

    expect(error).toBeInstanceOf(RangeError);
    expect(error?.message).toBe("A routine day id must be a UUID");
    expect(fake.requestCount).toBe(0);
  });

  it("should refuse a start that is not a valid date before any request", async () => {
    const fake = installSessionWritesFake(server);

    const error = await rejectionOf(
      startSession(createTestClient(), { now: new Date(Number.NaN), tz: "UTC" }),
    );

    expect(error).toBeInstanceOf(RangeError);
    expect(error?.message).toBe("A session start must be a valid date");
    expect(fake.requestCount).toBe(0);
  });

  it("should name the action and the code only when the insert is refused", async () => {
    const fake = installSessionWritesFake(server);
    fake.failWith("42501", `the note ${RECOGNISABLE_NOTE} is not allowed`);

    const error = await rejectionOf(
      startSession(createTestClient(), { now: new Date(), tz: "UTC" }),
    );

    expect(error?.message).toBe("Could not start the session (42501)");
    expect(error?.cause).toEqual({ code: "42501" });
    expect(textOf(error)).not.toContain(RECOGNISABLE_NOTE);
  });
});

describe("finishSession", () => {
  const endedAt = new Date("2026-10-18T10:00:00Z");

  it("should set the end and the trimmed note on a session that is still open", async () => {
    const fake = installSessionWritesFake(server, { sessions: [openSession()] });

    await finishSession(createTestClient(), OPEN_SESSION_ID, {
      endedAt,
      note: `  ${RECOGNISABLE_NOTE}  `,
    });

    expect(fake.updates).toHaveLength(1);
    expect(fake.updates[0]?.body).toEqual({
      ended_at: "2026-10-18T10:00:00.000Z",
      note: RECOGNISABLE_NOTE,
    });
    const filters = fake.updates[0]?.url.searchParams;
    expect(filters?.get("id")).toBe(`eq.${OPEN_SESSION_ID}`);
    expect(filters?.get("ended_at")).toBe("is.null");
    expect(filters?.get("deleted_at")).toBe("is.null");
  });

  it("should store a blank note as null", async () => {
    const fake = installSessionWritesFake(server, { sessions: [openSession()] });

    await finishSession(createTestClient(), OPEN_SESSION_ID, { endedAt, note: " \n\t " });

    expect(fake.updates[0]?.body).toMatchObject({ note: null });
  });

  it("should store no note when none is given", async () => {
    const fake = installSessionWritesFake(server, { sessions: [openSession()] });

    await finishSession(createTestClient(), OPEN_SESSION_ID, { endedAt, note: null });

    expect(fake.updates[0]?.body).toMatchObject({ note: null });
  });

  it("should resolve to the session as stored, with its end and its note", async () => {
    installSessionWritesFake(server, { sessions: [openSession()] });

    const session = await finishSession(createTestClient(), OPEN_SESSION_ID, {
      endedAt,
      note: RECOGNISABLE_NOTE,
    });

    expect(session).toMatchObject({
      id: OPEN_SESSION_ID,
      ended_at: "2026-10-18T10:00:00.000Z",
      note: RECOGNISABLE_NOTE,
    });
  });

  it("should accept a note of 1,000 characters, counted as the database counts them", async () => {
    const fake = installSessionWritesFake(server, { sessions: [openSession()] });
    // An emoji is two UTF-16 units and one character.
    const note = "\u{1F4AA}".repeat(1000);

    await finishSession(createTestClient(), OPEN_SESSION_ID, { endedAt, note });

    expect(fake.updates).toHaveLength(1);
  });

  it("should refuse a note of 1,001 characters with the rule and not the note, before any request", async () => {
    const fake = installSessionWritesFake(server, { sessions: [openSession()] });
    const note = "n".repeat(1001);

    const error = await rejectionOf(
      finishSession(createTestClient(), OPEN_SESSION_ID, { endedAt, note }),
    );

    expect(error).toBeInstanceOf(RangeError);
    expect(error?.message).toBe("A session note must be 1,000 characters or fewer");
    expect(textOf(error)).not.toContain("nnnnn");
    expect(fake.requestCount).toBe(0);
  });

  it("should refuse an end before the start without writing", async () => {
    const fake = installSessionWritesFake(server, { sessions: [openSession()] });

    const error = await rejectionOf(
      finishSession(createTestClient(), OPEN_SESSION_ID, {
        endedAt: new Date("2026-10-18T08:59:59Z"),
        note: RECOGNISABLE_NOTE,
      }),
    );

    expect(error).toBeInstanceOf(RangeError);
    expect(error?.message).toBe("A session cannot end before it starts");
    expect(textOf(error)).not.toContain(RECOGNISABLE_NOTE);
    expect(fake.updates).toEqual([]);
  });

  it("should accept an end at the very moment of the start", async () => {
    const fake = installSessionWritesFake(server, { sessions: [openSession()] });

    await finishSession(createTestClient(), OPEN_SESSION_ID, {
      endedAt: new Date("2026-10-18T09:00:00Z"),
      note: null,
    });

    expect(fake.updates).toHaveLength(1);
  });

  it("should resolve to a session that has already ended and change nothing", async () => {
    const fake = installSessionWritesFake(server, { sessions: [finishedSession()] });

    const session = await finishSession(createTestClient(), OPEN_SESSION_ID, {
      endedAt: new Date("2026-10-18T11:00:00Z"),
      note: "a later note",
    });

    expect(session).toMatchObject({
      ended_at: "2026-10-18T10:00:00+00:00",
      note: RECOGNISABLE_NOTE,
    });
    expect(fake.updates).toEqual([]);
  });

  it("should refuse an id that is not a UUID before any request", async () => {
    const fake = installSessionWritesFake(server);

    const error = await rejectionOf(
      finishSession(createTestClient(), "not-an-id", { endedAt, note: null }),
    );

    expect(error).toBeInstanceOf(RangeError);
    expect(error?.message).toBe("A session id must be a UUID");
    expect(fake.requestCount).toBe(0);
  });

  it("should fail with the code of a missing row for a session that is not the caller's, and write nothing", async () => {
    const fake = installSessionWritesFake(server, { sessions: [] });

    const error = await rejectionOf(
      finishSession(createTestClient(), NOT_A_SESSION, { endedAt, note: RECOGNISABLE_NOTE }),
    );

    expect(error?.message).toBe("Could not finish the session (PGRST116)");
    expect(error?.cause).toEqual({ code: "PGRST116" });
    expect(textOf(error)).not.toContain(RECOGNISABLE_NOTE);
    expect(fake.updates).toEqual([]);
  });

  it("should not finish a session that has been deleted", async () => {
    const fake = installSessionWritesFake(server, {
      sessions: [openSession({ deleted_at: "2026-10-18T09:30:00+00:00" })],
    });

    const error = await rejectionOf(
      finishSession(createTestClient(), OPEN_SESSION_ID, { endedAt, note: null }),
    );

    expect(error?.message).toBe("Could not finish the session (PGRST116)");
    expect(fake.updates).toEqual([]);
  });

  it("should name the action and the code only when the update is refused", async () => {
    const fake = installSessionWritesFake(server, { sessions: [openSession()] });
    fake.failWith("23514", `the note ${RECOGNISABLE_NOTE} is too long`);

    const error = await rejectionOf(
      finishSession(createTestClient(), OPEN_SESSION_ID, { endedAt, note: RECOGNISABLE_NOTE }),
    );

    expect(error?.message).toBe("Could not finish the session (23514)");
    expect(textOf(error)).not.toContain(RECOGNISABLE_NOTE);
  });
});

describe("deleteSession", () => {
  it("should call delete_workout_session with the session id and resolve to nothing", async () => {
    const fake = installSessionWritesFake(server, { sessions: [openSession()] });

    await expect(deleteSession(createTestClient(), OPEN_SESSION_ID)).resolves.toBeUndefined();

    expect(fake.deletes).toEqual([{ p_session_id: OPEN_SESSION_ID }]);
  });

  it("should refuse an id that is not a UUID before any request", async () => {
    const fake = installSessionWritesFake(server);

    const error = await rejectionOf(deleteSession(createTestClient(), "not-an-id"));

    expect(error).toBeInstanceOf(RangeError);
    expect(error?.message).toBe("A session id must be a UUID");
    expect(fake.requestCount).toBe(0);
  });

  it("should name the action and the code only when the database refuses", async () => {
    const fake = installSessionWritesFake(server);
    fake.failWith("P0002", `the session with ${RECOGNISABLE_NOTE} does not exist`);

    const error = await rejectionOf(deleteSession(createTestClient(), NOT_A_SESSION));

    expect(error?.message).toBe("Could not delete the session (P0002)");
    expect(error?.cause).toEqual({ code: "P0002" });
    expect(textOf(error)).not.toContain(RECOGNISABLE_NOTE);
  });
});
