import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { findPreviousSessionWeek, listSessionsInWeek } from "../../src/repos/trainingHistory";
import { createTestClient } from "../createTestClient";
import {
  historySessionRow,
  historySetRow,
  historySetRows,
  installHistoryFake,
} from "../support/history";
import {
  EXERCISE_ID,
  RECOGNISABLE_DAY_NAME,
  RECOGNISABLE_EXERCISE_NAME,
  ROUTINE_DAY_ID,
  snapshotOf,
} from "../support/training";

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

const SET_COLUMNS =
  "id,session_id,exercise_id,set_type,rir,rpe,performed_at,snapshot,deleted_at,position";
const SESSION_COLUMNS = "id,local_date,routine_day_id,started_at,ended_at,deleted_at";

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

const firstRequest = (requests: { url: URL }[]) => requests[0]?.url ?? new URL("http://none");

describe("listSessionsInWeek", () => {
  it("should ask for the live sessions of the Monday to Sunday week, newest first, with the routine day's name and the live sets", async () => {
    const fake = installHistoryFake(server, { sessions: [] });

    await listSessionsInWeek(createTestClient(), "2026-10-12");

    const url = firstRequest(fake.requestsTo("workout_sessions"));
    expect(url.searchParams.get("select")).toBe(
      `${SESSION_COLUMNS},routine_days(name),workout_sets(${SET_COLUMNS})`,
    );
    expect(url.searchParams.get("deleted_at")).toBe("is.null");
    expect(url.searchParams.getAll("local_date").sort()).toEqual([
      "gte.2026-10-12",
      "lte.2026-10-18",
    ]);
    expect(url.searchParams.get("workout_sets.deleted_at")).toBe("is.null");
    expect(url.searchParams.get("order")).toBe("started_at.desc,id.desc");
    expect(url.searchParams.get("workout_sets.order")).toBe("position.asc,performed_at.asc,id.asc");
  });

  it("should not read the reps, the load or the note of anything", async () => {
    const fake = installHistoryFake(server, { sessions: [] });

    await listSessionsInWeek(createTestClient(), "2026-10-12");

    const select = firstRequest(fake.requestsTo("workout_sessions")).searchParams.get("select");
    expect(select).not.toContain("reps");
    expect(select).not.toContain("load_kg");
    expect(select).not.toContain("note");
  });

  it("should return the sessions newest first, each with its routine day's name and its sets, the snapshots read by core", async () => {
    const older = historySessionRow({ local_date: "2026-10-13" });
    const newer = historySessionRow({
      local_date: "2026-10-15",
      routine_day_id: ROUTINE_DAY_ID,
      routine_days: { name: RECOGNISABLE_DAY_NAME },
      workout_sets: [historySetRow({ position: 3, rir: 1 })],
    });
    installHistoryFake(server, { sessions: [older, newer] });

    const sessions = await listSessionsInWeek(createTestClient(), "2026-10-12");

    expect(sessions.map(({ id }) => id)).toEqual([newer.id, older.id]);
    expect(sessions[0]).toEqual({
      id: newer.id,
      local_date: "2026-10-15",
      routine_day_id: ROUTINE_DAY_ID,
      started_at: "2026-10-15T17:00:00+00:00",
      ended_at: "2026-10-15T18:00:00+00:00",
      deleted_at: null,
      routine_day_name: RECOGNISABLE_DAY_NAME,
      sets: [
        {
          id: newer.workout_sets[0]?.id,
          session_id: newer.workout_sets[0]?.session_id,
          exercise_id: EXERCISE_ID,
          position: 3,
          set_type: "working",
          rir: 1,
          rpe: null,
          performed_at: "2026-10-16T18:00:00+00:00",
          snapshot: snapshotOf(),
          deleted_at: null,
        },
      ],
    });
    expect(sessions[1]?.routine_day_name).toBeNull();
  });

  it("should leave out the sessions of other weeks and the soft-deleted ones", async () => {
    const inWeek = historySessionRow({ local_date: "2026-10-18" });
    installHistoryFake(server, {
      sessions: [
        historySessionRow({ local_date: "2026-10-11" }),
        inWeek,
        historySessionRow({ local_date: "2026-10-19" }),
        historySessionRow({ local_date: "2026-10-14", deleted_at: "2026-10-15T09:00:00+00:00" }),
      ],
    });

    const sessions = await listSessionsInWeek(createTestClient(), "2026-10-12");

    expect(sessions.map(({ id }) => id)).toEqual([inWeek.id]);
  });

  it("should resolve to an empty list for a week with nothing logged", async () => {
    installHistoryFake(server, { sessions: [] });

    await expect(listSessionsInWeek(createTestClient(), "2026-10-12")).resolves.toEqual([]);
  });

  it("should read the sessions a page of 1,000 at a time until a page comes back short", async () => {
    const sessions = Array.from({ length: 1001 }, () =>
      historySessionRow({ local_date: "2026-10-14" }),
    );
    const fake = installHistoryFake(server, { sessions });

    const listed = await listSessionsInWeek(createTestClient(), "2026-10-12");

    expect(listed).toHaveLength(1001);
    expect(
      fake
        .requestsTo("workout_sessions")
        .map(({ url }) => [url.searchParams.get("offset"), url.searchParams.get("limit")]),
    ).toEqual([
      ["0", "1000"],
      ["1000", "1000"],
    ]);
  });

  it("should throw a RangeError before any request for a date that is not a Monday", async () => {
    const fake = installHistoryFake(server, { sessions: [] });

    const failure = await rejectionOf(listSessionsInWeek(createTestClient(), "2026-10-14"));

    expect(failure).toBeInstanceOf(RangeError);
    expect(failure?.message).toBe("A training week must start on a Monday");
    expect(fake.requests).toEqual([]);
  });

  it("should throw a RangeError before any request for text that is not a date", async () => {
    const fake = installHistoryFake(server, { sessions: [] });

    const failure = await rejectionOf(listSessionsInWeek(createTestClient(), "next week"));

    expect(failure).toBeInstanceOf(RangeError);
    expect(fake.requests).toEqual([]);
  });

  it("should name the action and the database code only when the read fails, with no exercise name or value", async () => {
    const fake = installHistoryFake(server, { sessions: [historySessionRow()] });
    fake.failWith("42501");

    const failure = await rejectionOf(listSessionsInWeek(createTestClient(), "2026-10-12"));

    expect(failure?.message).toBe("Could not load your history (42501)");
    expect(failure?.cause).toEqual({ code: "42501" });
    expect(textOf(failure)).not.toContain(RECOGNISABLE_EXERCISE_NAME);
    expect(textOf(failure)).not.toContain("0.7351");
  });

  it("should name the row and the problem only when a set holds a snapshot this app cannot read", async () => {
    const session = historySessionRow({
      workout_sets: [historySetRow({ snapshot: { v: 99, name: RECOGNISABLE_EXERCISE_NAME } })],
    });
    installHistoryFake(server, { sessions: [session] });

    const failure = await rejectionOf(listSessionsInWeek(createTestClient(), "2026-10-12"));

    expect(failure).toBeInstanceOf(Error);
    expect(textOf(failure)).not.toContain(RECOGNISABLE_EXERCISE_NAME);
  });

  it("should read a session of 30 sets as it is", async () => {
    const session = historySessionRow({ workout_sets: [] });
    const withSets = { ...session, workout_sets: historySetRows(session.id, 30) };
    installHistoryFake(server, { sessions: [withSets] });

    const [listed] = await listSessionsInWeek(createTestClient(), "2026-10-12");

    expect(listed?.sets).toHaveLength(30);
  });
});

describe("findPreviousSessionWeek", () => {
  it("should ask for the newest local date before the week given, among the live sessions", async () => {
    const fake = installHistoryFake(server, { sessions: [] });

    await findPreviousSessionWeek(createTestClient(), "2026-10-12");

    const url = firstRequest(fake.requestsTo("workout_sessions"));
    expect(url.searchParams.get("select")).toBe("local_date");
    expect(url.searchParams.get("deleted_at")).toBe("is.null");
    expect(url.searchParams.get("local_date")).toBe("lt.2026-10-12");
    expect(url.searchParams.get("order")).toBe("local_date.desc");
    expect(url.searchParams.get("limit")).toBe("1");
  });

  it("should give the Monday of the newest earlier week that has a live session", async () => {
    installHistoryFake(server, {
      sessions: [
        historySessionRow({ local_date: "2026-09-02" }),
        historySessionRow({ local_date: "2026-10-08" }),
        historySessionRow({ local_date: "2026-10-05" }),
        historySessionRow({ local_date: "2026-10-14" }),
      ],
    });

    await expect(findPreviousSessionWeek(createTestClient(), "2026-10-12")).resolves.toBe(
      "2026-10-05",
    );
  });

  it("should skip the weeks with nothing logged and never give the week it was asked about", async () => {
    installHistoryFake(server, {
      sessions: [
        historySessionRow({ local_date: "2026-08-12" }),
        historySessionRow({ local_date: "2026-10-12" }),
      ],
    });

    const previous = await findPreviousSessionWeek(createTestClient(), "2026-10-12");

    expect(previous).toBe("2026-08-10");
    expect(previous).not.toBe("2026-10-12");
  });

  it("should give the last day of the week before as that week's Monday", async () => {
    installHistoryFake(server, { sessions: [historySessionRow({ local_date: "2026-10-11" })] });

    await expect(findPreviousSessionWeek(createTestClient(), "2026-10-12")).resolves.toBe(
      "2026-10-05",
    );
  });

  it("should not count a soft-deleted session", async () => {
    installHistoryFake(server, {
      sessions: [
        historySessionRow({ local_date: "2026-10-08", deleted_at: "2026-10-09T09:00:00+00:00" }),
        historySessionRow({ local_date: "2026-09-30" }),
      ],
    });

    await expect(findPreviousSessionWeek(createTestClient(), "2026-10-12")).resolves.toBe(
      "2026-09-28",
    );
  });

  it("should give null when there is no earlier week", async () => {
    installHistoryFake(server, { sessions: [historySessionRow({ local_date: "2026-10-12" })] });

    await expect(findPreviousSessionWeek(createTestClient(), "2026-10-12")).resolves.toBeNull();
  });

  it("should give the newest week with a live session when no week is given", async () => {
    const fake = installHistoryFake(server, {
      sessions: [
        historySessionRow({ local_date: "2026-10-14" }),
        historySessionRow({ local_date: "2026-10-05" }),
      ],
    });

    await expect(findPreviousSessionWeek(createTestClient())).resolves.toBe("2026-10-12");
    expect(firstRequest(fake.requestsTo("workout_sessions")).searchParams.has("local_date")).toBe(
      false,
    );
  });

  it("should throw a RangeError before any request for a date that is not a Monday", async () => {
    const fake = installHistoryFake(server, { sessions: [] });

    const failure = await rejectionOf(findPreviousSessionWeek(createTestClient(), "2026-10-14"));

    expect(failure).toBeInstanceOf(RangeError);
    expect(fake.requests).toEqual([]);
  });

  it("should name the action and the database code only when the read fails", async () => {
    const fake = installHistoryFake(server, { sessions: [] });
    fake.failWith("42501");

    const failure = await rejectionOf(findPreviousSessionWeek(createTestClient(), "2026-10-12"));

    expect(failure?.message).toBe("Could not load your history (42501)");
    expect(failure?.cause).toEqual({ code: "42501" });
    expect(textOf(failure)).not.toContain(RECOGNISABLE_EXERCISE_NAME);
  });
});
