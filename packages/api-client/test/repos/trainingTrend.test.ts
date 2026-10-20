import { exerciseWeeklyTrend } from "@keylow/core/training";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { keys } from "../../src/queryKeys";
import { listTrendSets } from "../../src/repos/trainingTrend";
import { createTestClient } from "../createTestClient";
import {
  TREND_EXERCISE_ID,
  TREND_OTHER_EXERCISE_ID,
  TREND_RECOGNISABLE_EXERCISE_NAME,
  TREND_RECOGNISABLE_LOAD,
  TREND_ROUTINE_ID,
  installTrendFake,
  trendRow,
  trendRowOn,
  trendSetOf,
} from "../support/trend";

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

const WINDOW = { fromWeek: "2026-09-28", throughDay: "2026-10-20" };

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

const earlierRow = (localDate: string, exerciseId = TREND_EXERCISE_ID, loadKg = 50) =>
  trendRowOn(localDate, exerciseId, loadKg);

describe("listTrendSets", () => {
  it("should ask for the narrow columns of the exercise's live working sets in live sessions across the range", async () => {
    const fake = installTrendFake(server, { sets: [trendRow()] });

    await listTrendSets(createTestClient(), [TREND_EXERCISE_ID], WINDOW);

    const [url] = fake.rangeRequests();
    const params = url?.searchParams;
    expect(params?.get("select")).toBe(
      "exercise_id,set_type,reps,load_kg,workout_sessions!inner(local_date)",
    );
    expect(params?.get("exercise_id")).toBe(`in.(${TREND_EXERCISE_ID})`);
    expect(params?.get("set_type")).toBe("neq.warmup");
    expect(params?.get("deleted_at")).toBe("is.null");
    expect(params?.get("workout_sessions.deleted_at")).toBe("is.null");
    expect(params?.getAll("workout_sessions.local_date").sort()).toEqual([
      "gte.2026-09-28",
      "lte.2026-10-20",
    ]);
  });

  it("should give the rows with the session's day and deletion flattened beside the set's", async () => {
    installTrendFake(server, { sets: [trendRow({ reps: 5, load_kg: 82.5 })] });

    const { sets } = await listTrendSets(createTestClient(), [TREND_EXERCISE_ID], WINDOW);

    expect(sets).toEqual([trendSetOf("2026-10-20", { reps: 5, load_kg: 82.5 })]);
  });

  it("should read the sets of many exercises in one request, and give them together", async () => {
    const fake = installTrendFake(server, {
      sets: [trendRow(), trendRow({ exercise_id: TREND_OTHER_EXERCISE_ID })],
    });

    const { sets } = await listTrendSets(
      createTestClient(),
      [TREND_EXERCISE_ID, TREND_OTHER_EXERCISE_ID],
      WINDOW,
    );

    expect(fake.rangeRequests()).toHaveLength(1);
    expect(fake.rangeRequests()[0]?.searchParams.get("exercise_id")).toBe(
      `in.(${TREND_EXERCISE_ID},${TREND_OTHER_EXERCISE_ID})`,
    );
    expect(sets.map((set) => set.exercise_id)).toEqual([
      TREND_EXERCISE_ID,
      TREND_OTHER_EXERCISE_ID,
    ]);
  });

  it("should list an exercise given twice once", async () => {
    const fake = installTrendFake(server);

    await listTrendSets(createTestClient(), [TREND_EXERCISE_ID, TREND_EXERCISE_ID], WINDOW);

    expect(fake.rangeRequests()[0]?.searchParams.get("exercise_id")).toBe(
      `in.(${TREND_EXERCISE_ID})`,
    );
  });

  it("should read a page at a time until a page comes back short, and join the pages", async () => {
    // 1,001 rows on 1,001 different days: the pages are joined before the rows are reduced.
    const rows = Array.from({ length: 1001 }, (_, index) =>
      trendRowOn(new Date(Date.UTC(2026, 9, 1 + index)).toISOString().slice(0, 10)),
    );
    const fake = installTrendFake(server, { sets: rows });

    const { sets } = await listTrendSets(createTestClient(), [TREND_EXERCISE_ID], WINDOW);

    expect(fake.rangeRequests()).toHaveLength(2);
    expect(sets).toHaveLength(144); // 1,001 days from a Thursday touch 144 Monday to Sunday weeks.
  });

  describe("the best set of each week", () => {
    it("should keep one row for each exercise and week: the heaviest load, then the most reps", async () => {
      installTrendFake(server, {
        sets: [
          trendRowOn("2026-09-29", TREND_EXERCISE_ID, 60, 8),
          trendRowOn("2026-09-30", TREND_EXERCISE_ID, 62.5, 5),
          trendRowOn("2026-10-01", TREND_EXERCISE_ID, 62.5, 6),
          trendRowOn("2026-10-02", TREND_EXERCISE_ID, 57.5, 12),
          trendRowOn("2026-09-29", TREND_OTHER_EXERCISE_ID, 40, 10),
          trendRowOn("2026-10-07", TREND_EXERCISE_ID, 60, 8),
        ],
      });

      const { sets } = await listTrendSets(
        createTestClient(),
        [TREND_EXERCISE_ID, TREND_OTHER_EXERCISE_ID],
        WINDOW,
      );

      expect(
        sets.map(({ exercise_id, local_date, load_kg, reps }) => [
          exercise_id,
          local_date,
          load_kg,
          reps,
        ]),
      ).toEqual([
        [TREND_EXERCISE_ID, "2026-10-01", 62.5, 6],
        [TREND_OTHER_EXERCISE_ID, "2026-09-29", 40, 10],
        [TREND_EXERCISE_ID, "2026-10-07", 60, 8],
      ]);
    });

    it("should leave the trend core works out exactly as the whole list of sets gives it", async () => {
      const sets = [
        trendRowOn("2026-09-29", TREND_EXERCISE_ID, 60, 10),
        trendRowOn("2026-09-30", TREND_EXERCISE_ID, 55, 15),
        trendRowOn("2026-10-06", TREND_EXERCISE_ID, 62.5, 6),
        trendRowOn("2026-10-08", TREND_EXERCISE_ID, 62.5, 4),
        trendRowOn("2026-10-20", TREND_EXERCISE_ID, 60, 8),
      ];
      installTrendFake(server, { sets, earlier: [earlierRow("2026-09-10")] });
      const options = { range: "4w", now: "2026-10-20T12:00:00Z", timeZone: "UTC" } as const;

      const reduced = await listTrendSets(createTestClient(), [TREND_EXERCISE_ID], WINDOW);

      const whole = sets.map((row) => ({
        exercise_id: row.exercise_id,
        set_type: "working" as const,
        reps: row.reps,
        load_kg: row.load_kg,
        local_date: row.workout_sessions.local_date,
      }));
      expect(exerciseWeeklyTrend(reduced.sets, { ...options, earlier: reduced.earlier })).toEqual(
        exerciseWeeklyTrend(whole, { ...options, earlier: reduced.earlier }),
      );
      expect(reduced.sets).toHaveLength(3);
    });

    it("should store a year of a six exercise routine in about 40 KB, not hundreds", async () => {
      // 6 exercises, 4 sessions a week of 4 sets each, 52 weeks: 4,992 rows read, one per week stored.
      const exerciseIds = Array.from(
        { length: 6 },
        (_, index) => `77777777-7777-4777-8777-00000000000${index}`,
      );
      const day = (week: number, session: number) =>
        new Date(Date.UTC(2025, 9, 27 + week * 7 + session)).toISOString().slice(0, 10);
      const rows = Array.from({ length: 52 }, (_, week) =>
        Array.from({ length: 4 }, (_, session) =>
          exerciseIds.flatMap((id) =>
            Array.from({ length: 4 }, (_, set) =>
              trendRowOn(day(week, session), id, 60 + week * 0.5 + set, 8),
            ),
          ),
        ).flat(),
      ).flat();
      installTrendFake(server, {
        sets: rows,
        earlier: exerciseIds.map((id) => earlierRow("2025-10-20", id)),
      });

      const stored = await listTrendSets(createTestClient(), exerciseIds, {
        fromWeek: "2025-10-27",
        throughDay: "2026-10-20",
      });

      const bytes = JSON.stringify({
        queryKey: keys.training.routineTrend(TREND_ROUTINE_ID, "2025-10-27"),
        state: { data: stored, dataUpdatedAt: 1_792_000_000_000, status: "success" },
      }).length;
      expect(rows).toHaveLength(4992);
      expect(stored.sets).toHaveLength(312);
      expect(bytes).toBeLessThan(55 * 1024);
      expect(bytes).toBeGreaterThan(30 * 1024);
    });
  });

  it("should make no request and give nothing for no exercises", async () => {
    const fake = installTrendFake(server);

    await expect(listTrendSets(createTestClient(), [], WINDOW)).resolves.toEqual({
      sets: [],
      earlier: [],
    });
    expect(fake.requests).toEqual([]);
  });

  describe("the earlier week", () => {
    it("should ask for the newest working sets before the range, newest first, in a second request", async () => {
      const fake = installTrendFake(server, { earlier: [earlierRow("2026-09-10")] });

      await listTrendSets(createTestClient(), [TREND_EXERCISE_ID], WINDOW);

      expect(fake.earlierRequests()).toHaveLength(1);
      const params = fake.earlierRequests()[0]?.searchParams;
      expect(params?.getAll("workout_sessions.local_date")).toEqual(["lt.2026-09-28"]);
      expect(params?.get("set_type")).toBe("neq.warmup");
      expect(params?.get("deleted_at")).toBe("is.null");
      expect(params?.get("workout_sessions.deleted_at")).toBe("is.null");
      expect(params?.get("order")).toBe("performed_at.desc,id.desc");
      expect(params?.get("limit")).toBe("200");
    });

    it("should allow 200 rows for each exercise asked for", async () => {
      const fake = installTrendFake(server);

      await listTrendSets(createTestClient(), [TREND_EXERCISE_ID, TREND_OTHER_EXERCISE_ID], WINDOW);

      expect(fake.earlierRequests()[0]?.searchParams.get("limit")).toBe("400");
    });

    it("should keep only the sets of the week of each exercise's newest earlier session", async () => {
      installTrendFake(server, {
        earlier: [
          earlierRow("2026-09-17", TREND_EXERCISE_ID, 70),
          earlierRow("2026-09-15", TREND_EXERCISE_ID, 72.5),
          earlierRow("2026-09-09", TREND_EXERCISE_ID, 65),
          earlierRow("2026-08-04", TREND_OTHER_EXERCISE_ID, 40),
          earlierRow("2026-07-01", TREND_OTHER_EXERCISE_ID, 35),
        ],
      });

      const { earlier } = await listTrendSets(
        createTestClient(),
        [TREND_EXERCISE_ID, TREND_OTHER_EXERCISE_ID],
        WINDOW,
      );

      expect(earlier.map((set) => [set.exercise_id, set.load_kg])).toEqual([
        [TREND_EXERCISE_ID, 70],
        [TREND_EXERCISE_ID, 72.5],
        [TREND_OTHER_EXERCISE_ID, 40],
      ]);
    });

    it("should give no earlier sets for an exercise never trained before the range", async () => {
      installTrendFake(server, { earlier: [] });

      const { earlier } = await listTrendSets(createTestClient(), [TREND_EXERCISE_ID], WINDOW);

      expect(earlier).toEqual([]);
    });

    it("should still find the earlier week of a rare exercise that a busy one fills the limit before", async () => {
      // 250 earlier rows of the busy exercise, newest first, fill the 200 a pass allows for two
      // exercises... and the rare one's single, older row comes after them.
      const busyRows = Array.from({ length: 450 }, (_, index) =>
        earlierRow(
          new Date(Date.UTC(2026, 8, 20) - index * 86_400_000).toISOString().slice(0, 10),
          TREND_EXERCISE_ID,
          50,
        ),
      );
      const rareRow = earlierRow("2026-03-02", TREND_OTHER_EXERCISE_ID, 35);
      const fake = installTrendFake(server, { earlier: [...busyRows, rareRow] });

      const { earlier } = await listTrendSets(
        createTestClient(),
        [TREND_EXERCISE_ID, TREND_OTHER_EXERCISE_ID],
        WINDOW,
      );

      expect(earlier.filter((set) => set.exercise_id === TREND_OTHER_EXERCISE_ID)).toEqual([
        trendSetOf("2026-03-02", { load_kg: 35 }, TREND_OTHER_EXERCISE_ID),
      ]);
      // The busy exercise's newest week, 14 to 20 September, is the one it keeps.
      const busyDays = earlier
        .filter((set) => set.exercise_id === TREND_EXERCISE_ID)
        .map((set) => set.local_date);
      expect(Math.min(...busyDays.map((day) => Date.parse(day)))).toBeGreaterThanOrEqual(
        Date.parse("2026-09-14"),
      );
      // Pass one asks for both and fills its limit with the busy exercise; pass two asks for the rare one only.
      expect(fake.earlierRequests().map((url) => url.searchParams.get("exercise_id"))).toEqual([
        `in.(${TREND_EXERCISE_ID},${TREND_OTHER_EXERCISE_ID})`,
        `in.(${TREND_OTHER_EXERCISE_ID})`,
      ]);
      expect(fake.earlierRequests().map((url) => url.searchParams.get("limit"))).toEqual([
        "400",
        "200",
      ]);
    });

    it("should not ask again once every exercise has been seen", async () => {
      const fake = installTrendFake(server, {
        earlier: [
          earlierRow("2026-09-10", TREND_EXERCISE_ID),
          earlierRow("2026-08-10", TREND_OTHER_EXERCISE_ID),
        ],
      });

      await listTrendSets(createTestClient(), [TREND_EXERCISE_ID, TREND_OTHER_EXERCISE_ID], WINDOW);

      expect(fake.earlierRequests()).toHaveLength(1);
    });

    it("should ask for ids in lower case and end, whatever the case of the ids it is given", async () => {
      const id = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
      const lower = id.toLowerCase();
      const fake = installTrendFake(server, { earlier: [earlierRow("2026-09-10", lower)] });

      const { earlier } = await listTrendSets(createTestClient(), [id, lower], WINDOW);

      expect(fake.earlierRequests().map((url) => url.searchParams.get("exercise_id"))).toEqual([
        `in.(${lower})`,
      ]);
      expect(earlier).toEqual([trendSetOf("2026-09-10", { load_kg: 50 }, lower)]);
    });

    it("should end when a pass finds none of the exercises still asked for", async () => {
      const fake = installTrendFake(server, {
        earlier: [earlierRow("2026-09-10", TREND_OTHER_EXERCISE_ID)],
        answerAnyExercise: true,
      });

      await listTrendSets(createTestClient(), [TREND_EXERCISE_ID], WINDOW);

      expect(fake.earlierRequests()).toHaveLength(1);
    });

    it("should make a last pass for the exercises never seen, which finds nothing and ends the reading", async () => {
      const fake = installTrendFake(server, { earlier: [earlierRow("2026-09-10")] });

      await listTrendSets(createTestClient(), [TREND_EXERCISE_ID, TREND_OTHER_EXERCISE_ID], WINDOW);

      expect(fake.earlierRequests().map((url) => url.searchParams.get("exercise_id"))).toEqual([
        `in.(${TREND_EXERCISE_ID},${TREND_OTHER_EXERCISE_ID})`,
        `in.(${TREND_OTHER_EXERCISE_ID})`,
      ]);
    });
  });

  describe("input rules", () => {
    it.each([
      ["an exercise id that is not a UUID", ["bench"], WINDOW],
      [
        "a first week that is not a Monday",
        [TREND_EXERCISE_ID],
        { ...WINDOW, fromWeek: "2026-09-29" },
      ],
      [
        "a first week that is not a date",
        [TREND_EXERCISE_ID],
        { ...WINDOW, fromWeek: "last week" },
      ],
      ["a last day that is not a date", [TREND_EXERCISE_ID], { ...WINDOW, throughDay: "20 Oct" }],
    ])("should throw a RangeError before any request for %s", async (_name, ids, window) => {
      const fake = installTrendFake(server);

      await expect(listTrendSets(createTestClient(), ids, window)).rejects.toThrow(RangeError);
      expect(fake.requests).toEqual([]);
    });
  });

  describe("failures", () => {
    it("should name the action and the database code only, with no name or load", async () => {
      const fake = installTrendFake(server, { sets: [trendRow()] });
      fake.failWith("42501");

      const error = await rejectionOf(
        listTrendSets(createTestClient(), [TREND_EXERCISE_ID], WINDOW),
      );

      expect(error?.message).toBe("Could not load your trend (42501)");
      expect(textOf(error)).not.toContain(TREND_RECOGNISABLE_EXERCISE_NAME);
      expect(textOf(error)).not.toContain(String(TREND_RECOGNISABLE_LOAD));
    });

    it("should name the row and the field of a row of an unexpected shape, and quote no value", async () => {
      installTrendFake(server, { sets: [trendRow({ load_kg: "heavy 187.25", reps: "eight" })] });

      const error = await rejectionOf(
        listTrendSets(createTestClient(), [TREND_EXERCISE_ID], WINDOW),
      );

      expect(error?.message).toContain("Could not read the trend");
      expect(textOf(error)).not.toContain("187.25");
      expect(textOf(error)).not.toContain("eight");
    });
  });
});
