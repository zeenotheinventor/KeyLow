import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  getDiaryDay,
  getDiaryWeek,
  listCompleteDays,
  listRecentFoods,
} from "../../src/repos/diary";
import { createTestClient } from "../createTestClient";
import { FOOD_ID, dayLogRow, dayTotalsRow, foodEntryRow, quickEntryRow } from "../support/diary";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";

const recorded: URL[] = [];

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  recorded.length = 0;
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const requestsTo = (table: string) =>
  recorded.filter((url) => url.pathname === `/rest/v1/${table}`);

/** Answers each diary table with the given rows and records every request URL. */
function answerWith(rows: { entries?: unknown[]; dayLogs?: unknown[]; dayTotals?: unknown[] }) {
  server.use(
    http.get(`${REST_URL}/food_log_entries`, ({ request }) => {
      recorded.push(new URL(request.url));
      return postgrestRows(request, rows.entries ?? []);
    }),
    http.get(`${REST_URL}/day_logs`, ({ request }) => {
      recorded.push(new URL(request.url));
      return postgrestRows(request, rows.dayLogs ?? []);
    }),
    http.get(`${REST_URL}/day_totals`, ({ request }) => {
      recorded.push(new URL(request.url));
      return postgrestRows(request, rows.dayTotals ?? []);
    }),
  );
}

describe("getDiaryDay", () => {
  it("should return the day's entries, its day log and its totals", async () => {
    const breakfast = foodEntryRow();
    const cake = quickEntryRow();
    answerWith({
      entries: [breakfast, cake],
      dayLogs: [dayLogRow()],
      dayTotals: [dayTotalsRow()],
    });

    const day = await getDiaryDay(createTestClient(), "2026-10-15");

    expect(day).toEqual({
      localDate: "2026-10-15",
      entries: [breakfast, cake],
      dayLog: dayLogRow(),
      totals: dayTotalsRow(),
    });
  });

  it("should return no day log and no totals for a day with nothing logged", async () => {
    answerWith({});

    const day = await getDiaryDay(createTestClient(), "2026-10-15");

    expect(day).toEqual({ localDate: "2026-10-15", entries: [], dayLog: null, totals: null });
  });

  it("should ask for the day's live entries by time, then creation time, then id", async () => {
    answerWith({});

    await getDiaryDay(createTestClient(), "2026-10-15");

    const [request] = requestsTo("food_log_entries");
    expect(request?.searchParams.get("local_date")).toBe("eq.2026-10-15");
    expect(request?.searchParams.get("deleted_at")).toBe("is.null");
    expect(request?.searchParams.get("order")).toBe("logged_at.asc,created_at.asc,id.asc");
  });

  it("should ask for the day's totals and day log by the same date", async () => {
    answerWith({});

    await getDiaryDay(createTestClient(), "2026-10-15");

    expect(requestsTo("day_logs")[0]?.searchParams.get("local_date")).toBe("eq.2026-10-15");
    expect(requestsTo("day_totals")[0]?.searchParams.get("local_date")).toBe("eq.2026-10-15");
  });

  it("should throw without asking when the date is not a calendar date", async () => {
    answerWith({});

    await expect(getDiaryDay(createTestClient(), "2026-02-30")).rejects.toThrow(RangeError);
    expect(recorded).toEqual([]);
  });

  it("should name item_type when a row is a recipe, which the diary does not read until M4", async () => {
    // Recipes in the diary are M4 (KEY-3 scope): until then a `recipe` row is a shape the read
    // refuses loudly instead of dropping it, so a day never silently loses an entry.
    const recipe = { ...foodEntryRow(), item_type: "recipe", food_id: null, recipe_id: FOOD_ID };
    answerWith({ entries: [recipe] });

    await expect(getDiaryDay(createTestClient(), "2026-10-15")).rejects.toThrow(/item_type/);
  });

  it("should throw an error that names the failed read when the database refuses", async () => {
    server.use(
      http.get(`${REST_URL}/food_log_entries`, () => postgrestError(500, "XX000", "unavailable")),
      http.get(`${REST_URL}/day_logs`, ({ request }) => postgrestRows(request, [])),
      http.get(`${REST_URL}/day_totals`, ({ request }) => postgrestRows(request, [])),
    );

    await expect(getDiaryDay(createTestClient(), "2026-10-15")).rejects.toThrow(
      "Could not load the day's entries: unavailable",
    );
  });

  it("should leave the entry values out of the error when a row has an unexpected shape", async () => {
    const malformed = foodEntryRow({ quantity: -1 });
    answerWith({ entries: [{ ...malformed, snapshot: { ...malformed.snapshot, name: 9 } }] });

    let message = "";
    try {
      await getDiaryDay(createTestClient(), "2026-10-15");
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }

    expect(message).toContain(malformed.id);
    expect(message).toContain("quantity");
    expect(message).toContain("snapshot.name");
    expect(message).not.toContain("Rolled oats");
    expect(message).not.toContain("-1");
  });
});

describe("getDiaryWeek", () => {
  it("should return seven days from the Monday, each with its totals and day log", async () => {
    answerWith({
      dayLogs: [dayLogRow({ local_date: "2026-10-14" })],
      dayTotals: [
        dayTotalsRow({ local_date: "2026-10-12" }),
        dayTotalsRow({ local_date: "2026-10-14" }),
      ],
    });

    const week = await getDiaryWeek(createTestClient(), "2026-10-12");

    expect(week.map((day) => day.localDate)).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
    expect(week[0]).toEqual({
      localDate: "2026-10-12",
      totals: dayTotalsRow({ local_date: "2026-10-12" }),
      dayLog: null,
    });
    expect(week[2]).toEqual({
      localDate: "2026-10-14",
      totals: dayTotalsRow({ local_date: "2026-10-14" }),
      dayLog: dayLogRow({ local_date: "2026-10-14" }),
    });
    expect(week[1]).toEqual({ localDate: "2026-10-13", totals: null, dayLog: null });
  });

  it("should read a day with no day log row as not complete", async () => {
    answerWith({ dayLogs: [dayLogRow({ local_date: "2026-10-14" })] });

    const week = await getDiaryWeek(createTestClient(), "2026-10-12");

    expect(week.map((day) => day.dayLog?.is_complete ?? false)).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it("should ask for the seven dates of the week in both tables", async () => {
    answerWith({});

    await getDiaryWeek(createTestClient(), "2026-10-12");

    for (const table of ["day_logs", "day_totals"]) {
      const params = requestsTo(table)[0]?.searchParams;
      expect(params?.getAll("local_date")).toEqual(["gte.2026-10-12", "lte.2026-10-18"]);
    }
  });

  it("should throw without asking when the date is not a Monday", async () => {
    answerWith({});

    await expect(getDiaryWeek(createTestClient(), "2026-10-14")).rejects.toThrow(RangeError);
    expect(recorded).toEqual([]);
  });
});

describe("listCompleteDays", () => {
  it("should return the dates the day log marks complete, in date order", async () => {
    answerWith({
      dayLogs: [dayLogRow({ local_date: "2026-10-03" }), dayLogRow({ local_date: "2026-10-20" })],
    });

    expect(await listCompleteDays(createTestClient(), "2026-10")).toEqual([
      "2026-10-03",
      "2026-10-20",
    ]);
  });

  it("should ask only the day log, for complete days inside the month, by date", async () => {
    answerWith({});

    await listCompleteDays(createTestClient(), "2026-10");

    expect(requestsTo("food_log_entries")).toEqual([]);
    expect(requestsTo("day_totals")).toEqual([]);
    const params = requestsTo("day_logs")[0]?.searchParams;
    expect(params?.get("is_complete")).toBe("eq.true");
    expect(params?.getAll("local_date")).toEqual(["gte.2026-10-01", "lt.2026-11-01"]);
    expect(params?.get("order")).toBe("local_date.asc");
  });

  it("should end December at the first of the next year", async () => {
    answerWith({});

    await listCompleteDays(createTestClient(), "2026-12");

    expect(requestsTo("day_logs")[0]?.searchParams.getAll("local_date")).toEqual([
      "gte.2026-12-01",
      "lt.2027-01-01",
    ]);
  });

  it.each(["2026-13", "2026-1", "2026-10-01", "October"])(
    "should throw without asking when the month is %s",
    async (month) => {
      answerWith({});

      await expect(listCompleteDays(createTestClient(), month)).rejects.toThrow(RangeError);
      expect(recorded).toEqual([]);
    },
  );
});

describe("listRecentFoods", () => {
  const recentRow = (overrides: Partial<ReturnType<typeof foodEntryRow>> = {}) => {
    const entry = foodEntryRow(overrides);
    return {
      id: entry.id,
      food_id: entry.food_id,
      logged_at: entry.logged_at,
      portion_id: entry.portion_id,
      snapshot: entry.snapshot,
      foods: { deleted_at: null },
    };
  };

  it("should return each food once, with the snapshot of its newest entry, newest first", async () => {
    const oats = recentRow({ id: "44444444-4444-4444-8444-444444444441" });
    const oatsAgain = recentRow({ id: "44444444-4444-4444-8444-444444444442" });
    const toast = recentRow({
      id: "44444444-4444-4444-8444-444444444443",
      food_id: "66666666-6666-4666-8666-666666666666",
    });
    answerWith({ entries: [oats, toast, oatsAgain] });

    const recent = await listRecentFoods(createTestClient());

    expect(recent.map((food) => [food.foodId, food.entryId])).toEqual([
      [oats.food_id, oats.id],
      [toast.food_id, toast.id],
    ]);
    expect(recent[0]).toEqual({
      foodId: oats.food_id,
      entryId: oats.id,
      loggedAt: oats.logged_at,
      portionId: null,
      snapshot: oats.snapshot,
    });
  });

  it("should stop at the limit", async () => {
    answerWith({
      entries: [
        recentRow({ id: "44444444-4444-4444-8444-444444444441" }),
        recentRow({
          id: "44444444-4444-4444-8444-444444444442",
          food_id: "66666666-6666-4666-8666-666666666666",
        }),
      ],
    });

    expect(await listRecentFoods(createTestClient(), { limit: 1 })).toHaveLength(1);
  });

  it("should ask for live food entries of foods that are not deleted, newest first", async () => {
    answerWith({});

    await listRecentFoods(createTestClient());

    const params = requestsTo("food_log_entries")[0]?.searchParams;
    expect(params?.get("item_type")).toBe("eq.food");
    expect(params?.get("deleted_at")).toBe("is.null");
    expect(params?.get("foods.deleted_at")).toBe("is.null");
    expect(params?.get("order")).toBe("logged_at.desc,created_at.desc,id.desc");
    expect(params?.get("select")).toContain("foods!inner");
  });

  it("should look at the newest 200 entries, whatever the limit", async () => {
    answerWith({});

    await listRecentFoods(createTestClient(), { limit: 3 });

    expect(requestsTo("food_log_entries")[0]?.searchParams.get("limit")).toBe("200");
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "should throw without asking when the limit is %s",
    async (limit) => {
      answerWith({});

      await expect(listRecentFoods(createTestClient(), { limit })).rejects.toThrow(RangeError);
      expect(recorded).toEqual([]);
    },
  );
});
