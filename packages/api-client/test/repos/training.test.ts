import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  getActiveRoutine,
  hasLoggedSession,
  listSetsFrom,
  listWeekSessions,
} from "../../src/repos/training";
import { createTestClient } from "../createTestClient";
import {
  BENCH_MUSCLES,
  EXERCISE_ID,
  RECOGNISABLE_EXERCISE_NAME,
  RECOGNISABLE_WEIGHT,
  installTrainingFake,
  routineRow,
  sessionRow,
  setRow,
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

describe("listSetsFrom", () => {
  it("should ask for the live sets of live sessions inside the days, oldest first, with explicit columns", async () => {
    const fake = installTrainingFake(server, { sets: [setRow()] });

    await listSetsFrom(createTestClient(), "2026-10-03", "2026-10-18");

    const url = firstRequest(fake.requestsTo("workout_sets"));
    expect(url.searchParams.get("select")).toBe(
      "id,session_id,exercise_id,set_type,rir,rpe,performed_at,snapshot,deleted_at,workout_sessions!inner()",
    );
    expect(url.searchParams.get("deleted_at")).toBe("is.null");
    expect(url.searchParams.get("workout_sessions.deleted_at")).toBe("is.null");
    expect(url.searchParams.getAll("workout_sessions.local_date")).toEqual([
      "gte.2026-10-03",
      "lte.2026-10-18",
    ]);
    expect(url.searchParams.get("order")).toBe("performed_at.asc,id.asc");
  });

  it("should return the rows with their snapshots read by core", async () => {
    const row = setRow();
    installTrainingFake(server, { sets: [row] });

    const sets = await listSetsFrom(createTestClient(), "2026-10-03", "2026-10-18");

    expect(sets).toEqual([
      {
        id: row.id,
        session_id: row.session_id,
        exercise_id: EXERCISE_ID,
        set_type: "working",
        rir: 2,
        rpe: null,
        performed_at: "2026-10-16T18:00:00+00:00",
        snapshot: snapshotOf(),
        deleted_at: null,
      },
    ]);
  });

  it("should read a page at a time until a page comes back short", async () => {
    const fake = installTrainingFake(server, {
      sets: Array.from({ length: 2040 }, () => setRow()),
    });

    const sets = await listSetsFrom(createTestClient(), "2026-10-03", "2026-10-18");

    expect(sets).toHaveLength(2040);
    expect(
      fake
        .requestsTo("workout_sets")
        .map(({ url }) => [url.searchParams.get("offset"), url.searchParams.get("limit")]),
    ).toEqual([
      ["0", "1000"],
      ["1000", "1000"],
      ["2000", "1000"],
    ]);
  });

  it("should refuse a day that is not a calendar date before any request", async () => {
    const fake = installTrainingFake(server, { sets: [setRow()] });

    await expect(listSetsFrom(createTestClient(), "2026-13-03", "2026-10-18")).rejects.toThrow(
      RangeError,
    );
    await expect(listSetsFrom(createTestClient(), "2026-10-03", "18 October")).rejects.toThrow(
      RangeError,
    );
    expect(fake.requests).toEqual([]);
  });

  it("should name the action and the error code only when the database fails", async () => {
    const fake = installTrainingFake(server, { sets: [setRow()] });
    fake.failWith("23514");

    const error = await rejectionOf(listSetsFrom(createTestClient(), "2026-10-03", "2026-10-18"));

    expect(error?.message).toBe("Could not load your sets (23514)");
    expect(error?.cause).toEqual({ code: "23514" });
    expect(textOf(error)).not.toContain(RECOGNISABLE_EXERCISE_NAME);
    expect(textOf(error)).not.toContain(String(RECOGNISABLE_WEIGHT));
  });

  it("should refuse a snapshot of a version this build does not know, naming the row and the problem only", async () => {
    const row = setRow({
      snapshot: { ...snapshotOf(), version: 2, name: RECOGNISABLE_EXERCISE_NAME },
    });
    installTrainingFake(server, { sets: [row] });

    const error = await rejectionOf(listSetsFrom(createTestClient(), "2026-10-03", "2026-10-18"));

    expect(error?.message).toBe(
      `Could not read the sets: row ${row.id} has a snapshot this app cannot read (unknown_version)`,
    );
    expect(textOf(error)).not.toContain(RECOGNISABLE_EXERCISE_NAME);
  });

  it("should refuse a row of an unexpected shape, naming the row and the field only", async () => {
    const row = setRow({ rir: 99 });
    installTrainingFake(server, { sets: [row] });

    const error = await rejectionOf(listSetsFrom(createTestClient(), "2026-10-03", "2026-10-18"));

    expect(error?.message).toBe(
      `Could not read the sets: row ${row.id} has an unexpected shape at rir`,
    );
  });
});

describe("listWeekSessions", () => {
  it("should ask for the live sessions of the seven days with their live sets, in order", async () => {
    const fake = installTrainingFake(server, { sessions: [sessionRow()] });

    await listWeekSessions(createTestClient(), "2026-10-12");

    const url = firstRequest(fake.requestsTo("workout_sessions"));
    expect(url.searchParams.get("select")).toBe(
      "id,local_date,routine_day_id,started_at,ended_at,deleted_at,workout_sets(id,session_id,exercise_id,set_type,rir,rpe,performed_at,snapshot,deleted_at)",
    );
    expect(url.searchParams.get("deleted_at")).toBe("is.null");
    expect(url.searchParams.getAll("local_date")).toEqual(["gte.2026-10-12", "lte.2026-10-18"]);
    expect(url.searchParams.get("workout_sets.deleted_at")).toBe("is.null");
    expect(url.searchParams.get("order")).toBe("local_date.asc,started_at.asc,id.asc");
    expect(url.searchParams.get("workout_sets.order")).toBe("performed_at.asc,id.asc");
  });

  it("should return each session with its sets, the snapshots read by core", async () => {
    const row = sessionRow({ routine_day_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" });
    installTrainingFake(server, { sessions: [row] });

    const sessions = await listWeekSessions(createTestClient(), "2026-10-12");

    expect(sessions).toEqual([
      {
        id: row.id,
        local_date: "2026-10-14",
        routine_day_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        started_at: "2026-10-14T17:00:00+00:00",
        ended_at: "2026-10-14T18:00:00+00:00",
        deleted_at: null,
        sets: [
          {
            id: row.workout_sets[0]?.id,
            session_id: row.id,
            exercise_id: EXERCISE_ID,
            set_type: "working",
            rir: 2,
            rpe: null,
            performed_at: "2026-10-16T18:00:00+00:00",
            snapshot: snapshotOf(),
            deleted_at: null,
          },
        ],
      },
    ]);
  });

  it("should read a session that is still open with no end", async () => {
    installTrainingFake(server, { sessions: [sessionRow({ ended_at: null })] });

    const sessions = await listWeekSessions(createTestClient(), "2026-10-12");

    expect(sessions[0]).toMatchObject({ started_at: "2026-10-14T17:00:00+00:00", ended_at: null });
  });

  it("should return a session with no sets", async () => {
    installTrainingFake(server, { sessions: [sessionRow({ workout_sets: [] })] });

    const sessions = await listWeekSessions(createTestClient(), "2026-10-12");

    expect(sessions[0]?.sets).toEqual([]);
  });

  it("should refuse a date that is not a Monday before any request", async () => {
    const fake = installTrainingFake(server, { sessions: [sessionRow()] });

    await expect(listWeekSessions(createTestClient(), "2026-10-14")).rejects.toThrow(RangeError);
    await expect(listWeekSessions(createTestClient(), "next week")).rejects.toThrow(RangeError);
    expect(fake.requests).toEqual([]);
  });

  it("should name the action and the error code only when the database fails", async () => {
    const fake = installTrainingFake(server, { sessions: [sessionRow()] });
    fake.failWith("42501");

    const error = await rejectionOf(listWeekSessions(createTestClient(), "2026-10-12"));

    expect(error?.message).toBe("Could not load your week (42501)");
    expect(error?.cause).toEqual({ code: "42501" });
    expect(textOf(error)).not.toContain(RECOGNISABLE_EXERCISE_NAME);
  });

  it.each([
    ["missing", undefined],
    ["null", null],
    ["not a list", {}],
  ])(
    "should refuse a session whose sets are %s, naming the row and the field only",
    async (_, sets) => {
      const row = sessionRow();
      installTrainingFake(server, { sessions: [{ ...row, workout_sets: sets }] });

      const error = await rejectionOf(listWeekSessions(createTestClient(), "2026-10-12"));

      expect(error?.message).toBe(
        `Could not read the week: row ${row.id} has an unexpected shape at workout_sets`,
      );
    },
  );

  it("should refuse a snapshot this build cannot read in a nested set", async () => {
    const row = sessionRow();
    const nested = setRow({ session_id: row.id, snapshot: { version: 1, muscles: "not a list" } });
    installTrainingFake(server, { sessions: [{ ...row, workout_sets: [nested] }] });

    const error = await rejectionOf(listWeekSessions(createTestClient(), "2026-10-12"));

    expect(error?.message).toBe(
      `Could not read the week: row ${nested.id} has a snapshot this app cannot read (invalid)`,
    );
  });
});

describe("getActiveRoutine", () => {
  it("should ask for the active routine with its days and exercises in position order, and their current muscle maps", async () => {
    const fake = installTrainingFake(server, { routine: routineRow() });

    await getActiveRoutine(createTestClient());

    const url = firstRequest(fake.requestsTo("routines"));
    expect(url.searchParams.get("select")).toBe(
      "id,name,activated_at,routine_days(id,name,position,weekday,routine_exercises(id,position,exercise_id,target_sets,target_rir,exercises(id,name,equipment,mechanic,exercise_muscles(muscle_id,role,weight))))",
    );
    expect(url.searchParams.get("is_active")).toBe("eq.true");
    expect(url.searchParams.get("routine_days.order")).toBe("position.asc");
    expect(url.searchParams.get("routine_days.routine_exercises.order")).toBe("position.asc");
  });

  it("should return the routine in the shape core plans from", async () => {
    installTrainingFake(server, { routine: routineRow() });

    const routine = await getActiveRoutine(createTestClient());

    expect(routine).toEqual({
      id: "88888888-8888-4888-8888-888888888888",
      name: "key354 routine",
      activatedAt: null,
      days: [
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          name: "key354 day",
          position: 0,
          weekday: 0,
          exercises: [
            {
              id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
              position: 0,
              exercise_id: EXERCISE_ID,
              target_sets: 3,
              target_rir: 2,
              exercise: {
                id: EXERCISE_ID,
                name: RECOGNISABLE_EXERCISE_NAME,
                equipment: "barbell",
                mechanic: "compound",
              },
              muscles: BENCH_MUSCLES,
            },
          ],
        },
      ],
    });
  });

  it("should keep the instant the routine was made active, and never a date", async () => {
    installTrainingFake(server, {
      routine: routineRow({ activated_at: "2026-10-15T23:30:00+00:00" }),
    });

    const routine = await getActiveRoutine(createTestClient());

    expect(routine?.activatedAt).toBe("2026-10-15T23:30:00+00:00");
    expect(routine).not.toHaveProperty("activeFrom");
  });

  it("should refuse an activation that is not a timestamp, naming the row and the field only", async () => {
    installTrainingFake(server, { routine: routineRow({ activated_at: "Thursday" }) });

    const error = await rejectionOf(getActiveRoutine(createTestClient()));

    expect(error?.message).toMatch(
      /^Could not read the routine: row .* has an unexpected shape at activated_at/,
    );
    expect(textOf(error)).not.toContain("Thursday");
  });

  it("should resolve to null when the user has no active routine", async () => {
    installTrainingFake(server, { routine: null });

    expect(await getActiveRoutine(createTestClient())).toBeNull();
  });

  it("should name the action and the error code only when the database fails", async () => {
    const fake = installTrainingFake(server, { routine: routineRow() });
    fake.failWith("42501");

    const error = await rejectionOf(getActiveRoutine(createTestClient()));

    expect(error?.message).toBe("Could not load your routine (42501)");
    expect(error?.cause).toEqual({ code: "42501" });
    expect(textOf(error)).not.toContain(RECOGNISABLE_EXERCISE_NAME);
  });

  it("should refuse a row of an unexpected shape, naming the row and the field only", async () => {
    installTrainingFake(server, {
      routine: routineRow({
        routine_days: [{ id: "x", name: "Day", position: 0, weekday: 9, routine_exercises: [] }],
      }),
    });

    const error = await rejectionOf(getActiveRoutine(createTestClient()));

    expect(error?.message).toMatch(
      /^Could not read the routine: row .* has an unexpected shape at /,
    );
    expect(textOf(error)).not.toContain(RECOGNISABLE_EXERCISE_NAME);
  });
});

describe("hasLoggedSession", () => {
  it("should ask for one id of a live session and read nothing else", async () => {
    const fake = installTrainingFake(server, { sessions: [sessionRow()] });

    await hasLoggedSession(createTestClient());

    const url = firstRequest(fake.requestsTo("workout_sessions"));
    expect(url.searchParams.get("select")).toBe("id");
    expect(url.searchParams.get("deleted_at")).toBe("is.null");
    expect(url.searchParams.get("limit")).toBe("1");
  });

  it("should be true when the user has a session", async () => {
    installTrainingFake(server, { sessions: [sessionRow()] });

    expect(await hasLoggedSession(createTestClient())).toBe(true);
  });

  it("should be false when the user has no session", async () => {
    installTrainingFake(server, { sessions: [] });

    expect(await hasLoggedSession(createTestClient())).toBe(false);
  });

  it("should name the action and the error code only when the database fails", async () => {
    const fake = installTrainingFake(server, { sessions: [sessionRow()] });
    fake.failWith("42501");

    const error = await rejectionOf(hasLoggedSession(createTestClient()));

    expect(error?.message).toBe("Could not check your sessions (42501)");
    expect(error?.cause).toEqual({ code: "42501" });
    expect(textOf(error)).not.toContain(RECOGNISABLE_EXERCISE_NAME);
  });
});
