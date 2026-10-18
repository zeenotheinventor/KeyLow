import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { getActiveSession, getLastPerformance, getSession } from "../../src/repos/trainingSessions";
import { createTestClient } from "../createTestClient";
import {
  EXERCISE_ID,
  RECOGNISABLE_DAY_NAME,
  RECOGNISABLE_EXERCISE_NAME,
  RECOGNISABLE_LOAD,
  ROUTINE_DAY_ID,
  installTrainingFake,
  openSessionRow,
  previousSetRow,
  sessionSetRow,
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

const SESSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EXCLUDED_SESSION_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

/** What a rejected call throws, as text, to look for a value in it. Null when the call did not reject. */
const rejectionOf = async (call: Promise<unknown>): Promise<Error | null> => {
  try {
    await call;
  } catch (error) {
    return error instanceof Error ? error : new Error("(not an Error)");
  }
  return null;
};

/** Everything a thrown error carries as text: its message, its name and its cause. */
const textOf = (error: Error | null) =>
  JSON.stringify({ message: error?.message, name: error?.name, cause: error?.cause });

const firstRequest = (requests: { url: URL }[]) => requests[0]?.url ?? new URL("http://none");

const SET_COLUMNS =
  "id,session_id,exercise_id,set_type,rir,rpe,performed_at,snapshot,deleted_at,position,reps,load_kg";
const SESSION_COLUMNS = "id,started_at,ended_at,local_date,routine_day_id,note,deleted_at";

describe("getSession", () => {
  it("should ask for the one live session by id with its routine day's name and its live sets in order", async () => {
    const fake = installTrainingFake(server, { sessions: [openSessionRow()] });

    await getSession(createTestClient(), SESSION_ID);

    const url = firstRequest(fake.requestsTo("workout_sessions"));
    expect(url.searchParams.get("select")).toBe(
      `${SESSION_COLUMNS},routine_days(name),workout_sets(${SET_COLUMNS})`,
    );
    expect(url.searchParams.get("id")).toBe(`eq.${SESSION_ID}`);
    expect(url.searchParams.get("deleted_at")).toBe("is.null");
    expect(url.searchParams.get("workout_sets.deleted_at")).toBe("is.null");
    expect(url.searchParams.get("workout_sets.order")).toBe("position.asc,performed_at.asc,id.asc");
  });

  it("should return the session with the name of its routine day and its sets, the snapshots read by core", async () => {
    const row = openSessionRow({
      note: "Felt strong",
      workout_sets: [
        sessionSetRow({ session_id: SESSION_ID, position: 0, reps: 10, load_kg: 82.5, rir: 1 }),
        sessionSetRow({
          session_id: SESSION_ID,
          position: 1,
          set_type: "warmup",
          load_kg: null,
          rir: null,
          rpe: 7.5,
        }),
      ],
    });
    installTrainingFake(server, { sessions: [row] });

    const session = await getSession(createTestClient(), SESSION_ID);

    expect(session).toEqual({
      id: row.id,
      started_at: "2026-10-18T09:00:00+00:00",
      ended_at: null,
      local_date: "2026-10-18",
      routine_day_id: ROUTINE_DAY_ID,
      note: "Felt strong",
      deleted_at: null,
      routine_day_name: RECOGNISABLE_DAY_NAME,
      sets: [
        {
          id: row.workout_sets[0]?.id,
          session_id: SESSION_ID,
          exercise_id: EXERCISE_ID,
          position: 0,
          set_type: "working",
          reps: 10,
          load_kg: 82.5,
          rir: 1,
          rpe: null,
          performed_at: "2026-10-16T18:00:00+00:00",
          snapshot: snapshotOf(),
          deleted_at: null,
        },
        expect.objectContaining({
          position: 1,
          set_type: "warmup",
          load_kg: null,
          rir: null,
          rpe: 7.5,
        }),
      ],
    });
  });

  it("should give a free session no routine day name", async () => {
    installTrainingFake(server, {
      sessions: [openSessionRow({ routine_day_id: null, routine_days: null, workout_sets: [] })],
    });

    const session = await getSession(createTestClient(), SESSION_ID);

    expect(session).toMatchObject({ routine_day_id: null, routine_day_name: null, sets: [] });
  });

  it("should read a session that has ended, with its end", async () => {
    installTrainingFake(server, {
      sessions: [openSessionRow({ ended_at: "2026-10-18T09:50:00+00:00" })],
    });

    const session = await getSession(createTestClient(), SESSION_ID);

    expect(session?.ended_at).toBe("2026-10-18T09:50:00+00:00");
  });

  it("should resolve to null when the session is not visible: another user's, missing or deleted", async () => {
    installTrainingFake(server, { sessions: [] });

    expect(await getSession(createTestClient(), SESSION_ID)).toBeNull();
  });

  it("should refuse an id that is not a UUID before any request", async () => {
    const fake = installTrainingFake(server, { sessions: [openSessionRow()] });

    await expect(getSession(createTestClient(), "not-an-id")).rejects.toThrow(RangeError);
    expect(fake.requests).toEqual([]);
  });

  it("should name the action and the error code only when the database fails", async () => {
    const fake = installTrainingFake(server, { sessions: [openSessionRow()] });
    fake.failWith("42501");

    const error = await rejectionOf(getSession(createTestClient(), SESSION_ID));

    expect(error?.message).toBe("Could not load your session (42501)");
    expect(error?.cause).toEqual({ code: "42501" });
    expect(textOf(error)).not.toContain(RECOGNISABLE_EXERCISE_NAME);
  });

  it("should refuse a snapshot of a version this build does not know, naming the row and the problem only", async () => {
    const set = sessionSetRow({
      snapshot: { ...snapshotOf(), version: 2, name: RECOGNISABLE_EXERCISE_NAME },
    });
    installTrainingFake(server, { sessions: [openSessionRow({ workout_sets: [set] })] });

    const error = await rejectionOf(getSession(createTestClient(), SESSION_ID));

    expect(error?.message).toBe(
      `Could not read the session: row ${set.id} has a snapshot this app cannot read (unknown_version)`,
    );
    expect(textOf(error)).not.toContain(RECOGNISABLE_EXERCISE_NAME);
  });

  it("should refuse a row of the wrong shape, naming the row and the field only", async () => {
    const row = openSessionRow({ started_at: "yesterday" });
    installTrainingFake(server, { sessions: [row] });

    const error = await rejectionOf(getSession(createTestClient(), SESSION_ID));

    expect(error?.message).toBe(
      `Could not read the session: row ${row.id} has an unexpected shape at started_at`,
    );
  });

  it("should refuse a session whose sets are missing, since that is not a session of no sets", async () => {
    const withoutSets = Object.fromEntries(
      Object.entries(openSessionRow()).filter(([column]) => column !== "workout_sets"),
    );
    installTrainingFake(server, { sessions: [withoutSets] });

    const error = await rejectionOf(getSession(createTestClient(), SESSION_ID));

    expect(error?.message).toContain("unexpected shape at workout_sets");
  });
});

describe("getActiveSession", () => {
  it("should ask for the newest live session that has not ended, with its sets in order", async () => {
    const fake = installTrainingFake(server, { sessions: [openSessionRow()] });

    await getActiveSession(createTestClient());

    const url = firstRequest(fake.requestsTo("workout_sessions"));
    expect(url.searchParams.get("select")).toBe(
      `${SESSION_COLUMNS},routine_days(name),workout_sets(${SET_COLUMNS})`,
    );
    expect(url.searchParams.get("deleted_at")).toBe("is.null");
    expect(url.searchParams.get("ended_at")).toBe("is.null");
    expect(url.searchParams.get("order")).toBe("started_at.desc,id.desc");
    expect(url.searchParams.get("limit")).toBe("1");
    expect(url.searchParams.get("workout_sets.deleted_at")).toBe("is.null");
    expect(url.searchParams.get("workout_sets.order")).toBe("position.asc,performed_at.asc,id.asc");
  });

  it("should return the session with its routine day's name and its sets", async () => {
    const row = openSessionRow();
    installTrainingFake(server, { sessions: [row] });

    const session = await getActiveSession(createTestClient());

    expect(session).toMatchObject({
      id: row.id,
      ended_at: null,
      routine_day_name: RECOGNISABLE_DAY_NAME,
    });
    expect(session?.sets).toHaveLength(1);
    expect(session?.sets[0]?.snapshot).toEqual(snapshotOf());
  });

  it("should resolve to null when there is no session in progress", async () => {
    installTrainingFake(server, { sessions: [] });

    expect(await getActiveSession(createTestClient())).toBeNull();
  });

  it("should name the action and the error code only when the database fails", async () => {
    const fake = installTrainingFake(server, { sessions: [openSessionRow()] });
    fake.failWith("57014");

    const error = await rejectionOf(getActiveSession(createTestClient()));

    expect(error?.message).toBe("Could not load your session (57014)");
    expect(error?.cause).toEqual({ code: "57014" });
    expect(textOf(error)).not.toContain(RECOGNISABLE_EXERCISE_NAME);
  });
});

describe("getLastPerformance", () => {
  it("should ask for the exercise's live working sets of live earlier sessions, newest first, at most 60", async () => {
    const fake = installTrainingFake(server, { sets: [previousSetRow()] });

    await getLastPerformance(createTestClient(), EXERCISE_ID, {
      excludeSessionId: EXCLUDED_SESSION_ID,
    });

    const url = firstRequest(fake.requestsTo("workout_sets"));
    expect(url.searchParams.get("select")).toBe(
      "id,session_id,position,set_type,reps,load_kg,rir,rpe,performed_at,deleted_at,workout_sessions!inner(local_date)",
    );
    expect(url.searchParams.get("exercise_id")).toBe(`eq.${EXERCISE_ID}`);
    expect(url.searchParams.get("set_type")).toBe("neq.warmup");
    expect(url.searchParams.get("session_id")).toBe(`neq.${EXCLUDED_SESSION_ID}`);
    expect(url.searchParams.get("deleted_at")).toBe("is.null");
    expect(url.searchParams.get("workout_sessions.deleted_at")).toBe("is.null");
    expect(url.searchParams.get("order")).toBe("performed_at.desc,id.desc");
    expect(url.searchParams.get("limit")).toBe("60");
  });

  it("should leave no session out when none is given", async () => {
    const fake = installTrainingFake(server, { sets: [] });

    await getLastPerformance(createTestClient(), EXERCISE_ID);

    expect(firstRequest(fake.requestsTo("workout_sets")).searchParams.has("session_id")).toBe(
      false,
    );
  });

  it("should group the sets by session, newest session first, with the session's local date", async () => {
    const latest = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";
    const earlier = "aaaaaaaa-aaaa-4aaa-8aaa-000000000002";
    installTrainingFake(server, {
      sets: [
        previousSetRow({
          session_id: latest,
          position: 1,
          performed_at: "2026-10-11T09:40:00+00:00",
          workout_sessions: { local_date: "2026-10-11" },
        }),
        previousSetRow({
          session_id: latest,
          position: 0,
          performed_at: "2026-10-11T09:30:00+00:00",
          workout_sessions: { local_date: "2026-10-11" },
        }),
        previousSetRow({
          session_id: earlier,
          position: 0,
          performed_at: "2026-10-04T09:30:00+00:00",
          workout_sessions: { local_date: "2026-10-04" },
        }),
      ],
    });

    const sessions = await getLastPerformance(createTestClient(), EXERCISE_ID);

    expect(sessions.map(({ session_id, local_date }) => [session_id, local_date])).toEqual([
      [latest, "2026-10-11"],
      [earlier, "2026-10-04"],
    ]);
    expect(sessions.map(({ sets }) => sets.length)).toEqual([2, 1]);
  });

  it("should list the sets of a session by position, then when they were performed, then id", async () => {
    const session_id = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";
    const row = (id: string, position: number, performed_at: string) =>
      previousSetRow({ id, session_id, position, performed_at });
    installTrainingFake(server, {
      // The order the database gives them in, newest first.
      sets: [
        row("00000000-0000-4000-8000-000000000003", 1, "2026-10-11T09:40:00+00:00"),
        row("00000000-0000-4000-8000-000000000002", 0, "2026-10-11T09:35:00+00:00"),
        row("00000000-0000-4000-8000-000000000001", 0, "2026-10-11T09:35:00+00:00"),
        row("00000000-0000-4000-8000-000000000004", 0, "2026-10-11T09:30:00+02:00"),
      ],
    });

    const [session] = await getLastPerformance(createTestClient(), EXERCISE_ID);

    // 09:30 at +02:00 is 07:30 in UTC, the earliest moment, so it comes first among the sets at position 0.
    expect(session?.sets.map(({ id }) => id.slice(-1))).toEqual(["4", "1", "2", "3"]);
  });

  it("should return the values of each set a prefill needs, and no more", async () => {
    const row = previousSetRow({ position: 2, reps: 11, load_kg: 180, rir: 1, rpe: null });
    installTrainingFake(server, { sets: [row] });

    const [session] = await getLastPerformance(createTestClient(), EXERCISE_ID);

    expect(session?.sets).toEqual([
      {
        id: row.id,
        position: 2,
        performed_at: "2026-10-11T09:30:00+00:00",
        deleted_at: null,
        set_type: "working",
        load_kg: 180,
        reps: 11,
        rir: 1,
        rpe: null,
      },
    ]);
  });

  it("should return two sessions at most, however many the rows reach into", async () => {
    installTrainingFake(server, {
      sets: ["1", "2", "3"].map((suffix) =>
        previousSetRow({ session_id: `aaaaaaaa-aaaa-4aaa-8aaa-00000000000${suffix}` }),
      ),
    });

    const sessions = await getLastPerformance(createTestClient(), EXERCISE_ID);

    expect(sessions.map(({ session_id }) => session_id.slice(-1))).toEqual(["1", "2"]);
  });

  it("should read as many rows and sessions as it is asked for", async () => {
    const fake = installTrainingFake(server, {
      sets: ["1", "2", "3"].map((suffix) =>
        previousSetRow({ session_id: `aaaaaaaa-aaaa-4aaa-8aaa-00000000000${suffix}` }),
      ),
    });

    const sessions = await getLastPerformance(createTestClient(), EXERCISE_ID, { sessions: 1 });

    expect(sessions).toHaveLength(1);
    expect(firstRequest(fake.requestsTo("workout_sets")).searchParams.get("limit")).toBe("30");
  });

  it("should resolve to an empty list when the exercise has no earlier working set", async () => {
    installTrainingFake(server, { sets: [] });

    expect(await getLastPerformance(createTestClient(), EXERCISE_ID)).toEqual([]);
  });

  it("should refuse an exercise id or a session id that is not a UUID, and a count of sessions that is not a positive whole number, before any request", async () => {
    const fake = installTrainingFake(server, { sets: [previousSetRow()] });
    const client = createTestClient();

    await expect(getLastPerformance(client, "bench")).rejects.toThrow(RangeError);
    await expect(
      getLastPerformance(client, EXERCISE_ID, { excludeSessionId: "today" }),
    ).rejects.toThrow(RangeError);
    await expect(getLastPerformance(client, EXERCISE_ID, { sessions: 0 })).rejects.toThrow(
      RangeError,
    );
    await expect(getLastPerformance(client, EXERCISE_ID, { sessions: 1.5 })).rejects.toThrow(
      RangeError,
    );
    expect(fake.requests).toEqual([]);
  });

  it("should name the action and the error code only when the database fails", async () => {
    const fake = installTrainingFake(server, { sets: [previousSetRow()] });
    fake.failWith("57014");

    const error = await rejectionOf(getLastPerformance(createTestClient(), EXERCISE_ID));

    expect(error?.message).toBe("Could not load your last sets (57014)");
    expect(error?.cause).toEqual({ code: "57014" });
    expect(textOf(error)).not.toContain(String(RECOGNISABLE_LOAD));
  });

  it("should refuse a row of the wrong shape, naming the row and the field only", async () => {
    const row = previousSetRow({ load_kg: "heavy" });
    installTrainingFake(server, { sets: [row] });

    const error = await rejectionOf(getLastPerformance(createTestClient(), EXERCISE_ID));

    expect(error?.message).toBe(
      `Could not read the last sets: row ${row.id} has an unexpected shape at load_kg`,
    );
    expect(textOf(error)).not.toContain("heavy");
  });
});
