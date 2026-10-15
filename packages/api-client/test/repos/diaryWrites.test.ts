import { buildFoodSnapshot } from "@keylow/core/diary";
import { buildFood, buildFoodPortion } from "@keylow/core/testing";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import {
  logFood,
  logQuickEntry,
  restoreLogEntry,
  softDeleteLogEntry,
  updateLogEntry,
} from "../../src/repos/diaryWrites";
import { createTestClient } from "../createTestClient";
import { FOOD_ID, foodEntryRow, quickEntryRow } from "../support/diary";
import { REST_URL, foodRow, portionRow, postgrestError, postgrestRows } from "../support/postgrest";

type Recorded = { method: string; url: URL; body: unknown };

const recorded: Recorded[] = [];
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

const writesTo = (table: string) =>
  recorded.filter((call) => call.url.pathname === `/rest/v1/${table}`);

/** Answers writes to the entries table with the given rows (an empty list reads as "no row matched") and records them. */
function answerEntryWrites(rows: unknown[]) {
  const record = async (request: Request) => {
    const text = await request.text();
    recorded.push({
      method: request.method,
      url: new URL(request.url),
      body: text === "" ? undefined : JSON.parse(text),
    });
  };
  server.use(
    http.post(`${REST_URL}/food_log_entries`, async ({ request }) => {
      await record(request);
      return postgrestRows(request, rows, 201);
    }),
    http.patch(`${REST_URL}/food_log_entries`, async ({ request }) => {
      await record(request);
      return postgrestRows(request, rows);
    }),
  );
}

const food = buildFood({ id: FOOD_ID, name: "Rolled oats", kcal: 200 });

describe("logFood", () => {
  const input = {
    food,
    quantity: 50,
    unit: "g",
    loggedAt: "2026-10-15T12:00:00.000Z",
    localDate: "2026-10-15",
  } as const;

  it("should insert the entry built from the food, the amount and the time, and return the stored row", async () => {
    const stored = foodEntryRow({ logged_at: "2026-10-15T12:00:00+00:00" });
    answerEntryWrites([stored]);

    const entry = await logFood(createTestClient(), input);

    expect(entry).toEqual(stored);
    const [write] = writesTo("food_log_entries");
    expect(write?.method).toBe("POST");
    expect(write?.body).toMatchObject({
      item_type: "food",
      food_id: FOOD_ID,
      local_date: "2026-10-15",
      logged_at: "2026-10-15T12:00:00.000Z",
      quantity: 50,
      unit: "g",
      resolved_grams: 50,
      snapshot: { kind: "food", ref: FOOD_ID, quantity: 50, unit: "g" },
    });
  });

  it("should send no column the client may not write", async () => {
    answerEntryWrites([foodEntryRow()]);

    await logFood(createTestClient(), input);

    const body = writesTo("food_log_entries")[0]?.body;
    for (const column of ["id", "user_id", "created_at", "kcal", "deleted_at", "recipe_id"]) {
      expect(body).not.toHaveProperty(column);
    }
  });

  it("should send no meal slot and read none back", async () => {
    answerEntryWrites([foodEntryRow()]);

    const entry = await logFood(createTestClient(), input);

    expect(JSON.stringify(writesTo("food_log_entries")[0]?.body)).not.toMatch(/slot/i);
    expect(Object.keys(entry).join(",")).not.toMatch(/slot/i);
  });

  it("should throw without asking for a quantity below zero", async () => {
    answerEntryWrites([foodEntryRow()]);

    const failure = await logFood(createTestClient(), { ...input, quantity: -1 }).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(RangeError);
    expect(failure instanceof Error ? failure.message : "").not.toContain("-1");
    expect(recorded).toEqual([]);
  });

  it("should throw without asking, naming the field only, when the day is not a calendar date", async () => {
    answerEntryWrites([foodEntryRow()]);

    const failure = await logFood(createTestClient(), { ...input, localDate: "2026-02-30" }).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(Error);
    expect(failure instanceof Error ? failure.message : "").toContain("local_date");
    expect(failure instanceof Error ? failure.message : "").not.toContain("Rolled oats");
    expect(recorded).toEqual([]);
  });

  it("should throw an error that names the failed write when the database refuses", async () => {
    server.use(
      http.post(`${REST_URL}/food_log_entries`, () => postgrestError(403, "42501", "denied")),
    );

    await expect(logFood(createTestClient(), input)).rejects.toThrow(
      "Could not log the food: denied",
    );
  });
});

describe("logQuickEntry", () => {
  const input = {
    kcal: 300,
    label: "Office cake",
    loggedAt: "2026-10-15T15:30:00.000Z",
    localDate: "2026-10-15",
  };

  it("should insert a quick entry with no food, quantity or portion, and return the stored row", async () => {
    const stored = quickEntryRow();
    answerEntryWrites([stored]);

    const entry = await logQuickEntry(createTestClient(), input);

    expect(entry).toEqual(stored);
    expect(writesTo("food_log_entries")[0]?.body).toMatchObject({
      item_type: "quick",
      food_id: null,
      quantity: null,
      unit: null,
      portion_id: null,
      logged_at: "2026-10-15T15:30:00.000Z",
      local_date: "2026-10-15",
      nutrients: { kcal: 300, protein_g: null, fat_g: null, carbs_g: null, fibre_g: null },
      snapshot: { kind: "quick", label: "Office cake" },
    });
  });
});

describe("softDeleteLogEntry", () => {
  const { id } = foodEntryRow();

  it("should set deleted_at to the current time on that entry only", async () => {
    answerEntryWrites([{ id }]);

    await softDeleteLogEntry(createTestClient(), id);

    const [write] = writesTo("food_log_entries");
    expect(write?.method).toBe("PATCH");
    expect(write?.url.searchParams.get("id")).toBe(`eq.${id}`);
    expect(Object.keys(write?.body ?? {})).toEqual(["deleted_at"]);
    const { deleted_at: deletedAt } = z.object({ deleted_at: z.string() }).parse(write?.body);
    expect(Math.abs(Date.now() - Date.parse(deletedAt))).toBeLessThan(5_000);
  });

  it("should throw when no entry of the caller matched", async () => {
    answerEntryWrites([]);

    await expect(softDeleteLogEntry(createTestClient(), id)).rejects.toThrow(
      `The entry ${id} was not found`,
    );
  });

  it("should throw an error that names the failed write when the database refuses", async () => {
    server.use(
      http.patch(`${REST_URL}/food_log_entries`, () => postgrestError(500, "XX000", "unavailable")),
    );

    await expect(softDeleteLogEntry(createTestClient(), id)).rejects.toThrow(
      "Could not delete the entry: unavailable",
    );
  });
});

describe("restoreLogEntry", () => {
  const { id } = foodEntryRow();

  it("should clear deleted_at on that entry only", async () => {
    answerEntryWrites([{ id }]);

    await restoreLogEntry(createTestClient(), id);

    const [write] = writesTo("food_log_entries");
    expect(write?.method).toBe("PATCH");
    expect(write?.url.searchParams.get("id")).toBe(`eq.${id}`);
    expect(write?.body).toEqual({ deleted_at: null });
  });

  it("should throw when no entry of the caller matched", async () => {
    answerEntryWrites([]);

    await expect(restoreLogEntry(createTestClient(), id)).rejects.toThrow(
      `The entry ${id} was not found`,
    );
  });
});

describe("updateLogEntry", () => {
  const original = foodEntryRow();

  /** The columns the update grant allows, the only ones an update may send. */
  const grantedColumns = [
    "local_date",
    "logged_at",
    "quantity",
    "unit",
    "portion_id",
    "resolved_grams",
    "snapshot",
    "nutrients",
    "deleted_at",
  ];

  const bodyOfUpdate = () =>
    z.record(z.string(), z.unknown()).parse(writesTo("food_log_entries")[0]?.body);

  describe("changing the amount", () => {
    it("should recompute the nutrients from the entry's own snapshot and keep the time", async () => {
      answerEntryWrites([original]);

      await updateLogEntry(createTestClient(), {
        entry: original,
        amount: { quantity: 100, unit: "g" },
      });

      expect(bodyOfUpdate()).toMatchObject({
        quantity: 100,
        unit: "g",
        resolved_grams: 100,
        nutrients: { kcal: 200 },
        snapshot: { quantity: 100, per100: original.snapshot.per100 },
      });
      expect(bodyOfUpdate()).not.toHaveProperty("logged_at");
      expect(bodyOfUpdate()).not.toHaveProperty("local_date");
    });

    it("should write only columns the update grant allows, on that entry", async () => {
      answerEntryWrites([original]);

      await updateLogEntry(createTestClient(), {
        entry: original,
        amount: { quantity: 100, unit: "g" },
      });

      expect(Object.keys(bodyOfUpdate()).filter((key) => !grantedColumns.includes(key))).toEqual(
        [],
      );
      const [write] = writesTo("food_log_entries");
      expect(write?.method).toBe("PATCH");
      expect(write?.url.searchParams.get("id")).toBe(`eq.${original.id}`);
      expect(write?.url.searchParams.get("deleted_at")).toBe("is.null");
    });

    it("should return the stored row", async () => {
      const stored = foodEntryRow({ quantity: 100 });
      answerEntryWrites([stored]);

      expect(
        await updateLogEntry(createTestClient(), {
          entry: original,
          amount: { quantity: 100, unit: "g" },
        }),
      ).toEqual(stored);
    });

    it("should throw without asking for a quick add, which has no amount", async () => {
      answerEntryWrites([quickEntryRow()]);

      await expect(
        // @ts-expect-error A quick add takes its values or a time only; the run time guard is for callers past the types.
        updateLogEntry(createTestClient(), {
          entry: quickEntryRow(),
          amount: { quantity: 100, unit: "g" },
        }),
      ).rejects.toThrow(RangeError);
      expect(recorded).toEqual([]);
    });
  });

  describe("changing the values of a quick add", () => {
    const crisps = quickEntryRow({
      snapshot: { v: 1, kind: "quick", label: "Meal deal crisps" },
      nutrients: { kcal: 130, protein_g: 2, fat_g: 7, carbs_g: 15, fibre_g: null },
      kcal: 130,
    });

    it("should write the whole nutrients object and the snapshot, and nothing else", async () => {
      answerEntryWrites([crisps]);

      await updateLogEntry(createTestClient(), {
        entry: crisps,
        quick: { kcal: 150, protein_g: 3, carbs_g: 16, fat_g: 8, label: "Crisps" },
      });

      expect(bodyOfUpdate()).toEqual({
        nutrients: { kcal: 150, protein_g: 3, fat_g: 8, carbs_g: 16, fibre_g: null },
        snapshot: { v: 1, kind: "quick", label: "Crisps" },
      });
    });

    it("should never write the generated or fixed columns", async () => {
      answerEntryWrites([crisps]);

      await updateLogEntry(createTestClient(), {
        entry: crisps,
        quick: { kcal: 150, protein_g: 3, carbs_g: 16, fat_g: 8, label: "Crisps" },
      });

      for (const column of ["kcal", "item_type", "food_id", "recipe_id", "quantity", "unit"]) {
        expect(bodyOfUpdate()).not.toHaveProperty(column);
      }
    });

    it("should store a macro that was cleared as null, never as 0", async () => {
      answerEntryWrites([crisps]);

      await updateLogEntry(createTestClient(), {
        entry: crisps,
        quick: { kcal: 130, protein_g: null, carbs_g: null, fat_g: 0, label: "Crisps" },
      });

      expect(bodyOfUpdate()).toMatchObject({
        nutrients: { kcal: 130, protein_g: null, carbs_g: null, fat_g: 0, fibre_g: null },
      });
    });

    it("should store a blank label as null and trim a label", async () => {
      answerEntryWrites([crisps]);

      await updateLogEntry(createTestClient(), {
        entry: crisps,
        quick: { kcal: 130, protein_g: null, carbs_g: null, fat_g: null, label: "   " },
      });
      await updateLogEntry(createTestClient(), {
        entry: crisps,
        quick: { kcal: 130, protein_g: null, carbs_g: null, fat_g: null, label: " Crisps " },
      });

      const [blank, trimmed] = writesTo("food_log_entries").map((write) =>
        z.record(z.string(), z.unknown()).parse(write.body),
      );
      expect(blank).toMatchObject({ snapshot: { label: null } });
      expect(trimmed).toMatchObject({ snapshot: { label: "Crisps" } });
    });

    it("should write the values and the time together in one request", async () => {
      answerEntryWrites([crisps]);

      await updateLogEntry(createTestClient(), {
        entry: crisps,
        quick: { kcal: 150, protein_g: null, carbs_g: null, fat_g: null, label: null },
        time: { loggedAt: "2026-10-15T18:00:00.000Z", timeZone: "UTC" },
      });

      expect(writesTo("food_log_entries")).toHaveLength(1);
      expect(bodyOfUpdate()).toMatchObject({
        logged_at: "2026-10-15T18:00:00.000Z",
        local_date: "2026-10-15",
        nutrients: { kcal: 150 },
      });
    });

    it("should throw without asking for values that are not valid", async () => {
      answerEntryWrites([crisps]);

      await expect(
        updateLogEntry(createTestClient(), {
          entry: crisps,
          quick: { kcal: -1, protein_g: null, carbs_g: null, fat_g: null, label: null },
        }),
      ).rejects.toThrow(RangeError);
      expect(recorded).toEqual([]);
    });

    it("should leave the values out of the error", async () => {
      answerEntryWrites([crisps]);

      const failure = await updateLogEntry(createTestClient(), {
        entry: crisps,
        quick: { kcal: -12345, protein_g: null, carbs_g: null, fat_g: null, label: null },
      }).catch((error: unknown) => error);

      expect(failure instanceof Error ? failure.message : "").not.toContain("12345");
    });

    it("should throw without asking for a food, which has no quick values", async () => {
      answerEntryWrites([original]);
      const values = { kcal: 150, protein_g: null, carbs_g: null, fat_g: null, label: null };

      await expect(
        // @ts-expect-error A food takes an amount, the current food data or a time; the run time guard is for callers past the types.
        updateLogEntry(createTestClient(), { entry: original, quick: values }),
      ).rejects.toThrow(RangeError);
      expect(recorded).toEqual([]);
    });
  });

  describe("changing the time", () => {
    it("should write logged_at and the local date of that instant in the time zone", async () => {
      answerEntryWrites([original]);

      await updateLogEntry(createTestClient(), {
        entry: original,
        time: { loggedAt: "2026-10-16T00:15:00+01:00", timeZone: "Europe/London" },
      });

      expect(bodyOfUpdate()).toEqual({
        logged_at: "2026-10-16T00:15:00+01:00",
        local_date: "2026-10-16",
      });
    });

    it("should move an entry across midnight in the zone, not in UTC", async () => {
      answerEntryWrites([original]);

      // 23:30 on the 15th in New York is 03:30 UTC on the 16th.
      await updateLogEntry(createTestClient(), {
        entry: original,
        time: { loggedAt: "2026-10-16T03:30:00.000Z", timeZone: "America/New_York" },
      });

      expect(bodyOfUpdate()).toMatchObject({ local_date: "2026-10-15" });
    });

    it("should update the time of a quick add", async () => {
      answerEntryWrites([quickEntryRow()]);

      await updateLogEntry(createTestClient(), {
        entry: quickEntryRow(),
        time: { loggedAt: "2026-10-15T18:00:00.000Z", timeZone: "UTC" },
      });

      expect(bodyOfUpdate()).toEqual({
        logged_at: "2026-10-15T18:00:00.000Z",
        local_date: "2026-10-15",
      });
    });

    it("should throw without asking when the time is not an instant with an offset", async () => {
      answerEntryWrites([original]);

      await expect(
        updateLogEntry(createTestClient(), {
          entry: original,
          time: { loggedAt: "tomorrow", timeZone: "UTC" },
        }),
      ).rejects.toThrow(RangeError);
      expect(recorded).toEqual([]);
    });
  });

  describe("changing the amount and the time together", () => {
    it("should send both in one write", async () => {
      answerEntryWrites([original]);

      await updateLogEntry(createTestClient(), {
        entry: original,
        amount: { quantity: 75, unit: "g" },
        time: { loggedAt: "2026-10-15T13:00:00.000Z", timeZone: "UTC" },
      });

      expect(writesTo("food_log_entries")).toHaveLength(1);
      expect(bodyOfUpdate()).toMatchObject({ quantity: 75, logged_at: "2026-10-15T13:00:00.000Z" });
    });
  });

  describe("updating to the current food data", () => {
    const edited = foodRow({ id: FOOD_ID, name: "Rolled oats", kcal: 400 });
    const entryOfOldOats = foodEntryRow({
      snapshot: buildFoodSnapshot(buildFood({ id: FOOD_ID, name: "Rolled oats", kcal: 200 }), {
        quantity: 50,
        unit: "g",
      }),
    });
    const requests: URL[] = [];

    const answerFood = (rows: unknown[], portions: unknown[] = []) => {
      requests.length = 0;
      server.use(
        http.get(`${REST_URL}/foods`, ({ request }) => {
          requests.push(new URL(request.url));
          return postgrestRows(request, rows);
        }),
        http.get(`${REST_URL}/food_portions`, ({ request }) => postgrestRows(request, portions)),
      );
    };

    it("should rebuild the snapshot and nutrients from the food as it is now, keeping the amount", async () => {
      answerFood([edited]);
      answerEntryWrites([entryOfOldOats]);

      await updateLogEntry(createTestClient(), {
        entry: entryOfOldOats,
        useCurrentFoodData: true,
      });

      expect(bodyOfUpdate()).toMatchObject({
        quantity: 50,
        unit: "g",
        nutrients: { kcal: 200 },
        snapshot: { per100: { kcal: 400 } },
      });
    });

    it("should look the food up without hiding a deleted one", async () => {
      answerFood([{ ...edited, deleted_at: "2026-10-14T10:00:00+00:00" }]);
      answerEntryWrites([entryOfOldOats]);

      await updateLogEntry(createTestClient(), {
        entry: entryOfOldOats,
        useCurrentFoodData: true,
      });

      expect(requests[0]?.searchParams.has("deleted_at")).toBe(false);
      expect(requests[0]?.searchParams.get("id")).toBe(`eq.${FOOD_ID}`);
    });

    it("should relink a portion by its label on the food as it is now", async () => {
      const bar = buildFoodPortion({
        id: portionRow().id,
        food_id: FOOD_ID,
        label: "1 bar",
        grams: 60,
      });
      const loggedWithBar = foodEntryRow({
        quantity: 2,
        unit: "portion",
        portion_id: "99999999-9999-4999-8999-999999999999",
        resolved_grams: 100,
        snapshot: buildFoodSnapshot(buildFood({ id: FOOD_ID, kcal: 200 }), {
          quantity: 2,
          unit: "portion",
          portion: { label: "1 bar", grams: 50, ml: null },
        }),
      });
      answerFood([edited], [bar]);
      answerEntryWrites([loggedWithBar]);

      await updateLogEntry(createTestClient(), { entry: loggedWithBar, useCurrentFoodData: true });

      expect(bodyOfUpdate()).toMatchObject({ portion_id: bar.id, resolved_grams: 120 });
    });

    it("should throw, without a value in the message, when the food cannot be read any more", async () => {
      answerFood([]);
      answerEntryWrites([entryOfOldOats]);

      const failure = await updateLogEntry(createTestClient(), {
        entry: entryOfOldOats,
        useCurrentFoodData: true,
      }).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(Error);
      expect(failure instanceof Error ? failure.message : "").toContain(FOOD_ID);
      expect(failure instanceof Error ? failure.message : "").not.toContain("Rolled oats");
      expect(recorded).toEqual([]);
    });

    it("should throw without asking for a quick add, which has no food", async () => {
      answerEntryWrites([quickEntryRow()]);

      await expect(
        // @ts-expect-error A quick add takes its values or a time only; the run time guard is for callers past the types.
        updateLogEntry(createTestClient(), { entry: quickEntryRow(), useCurrentFoodData: true }),
      ).rejects.toThrow(RangeError);
      expect(recorded).toEqual([]);
    });
  });

  it("should throw without asking when there is nothing to change", async () => {
    answerEntryWrites([original]);

    await expect(updateLogEntry(createTestClient(), { entry: original })).rejects.toThrow(
      RangeError,
    );
    expect(recorded).toEqual([]);
  });

  it("should throw when no live entry of the caller matched", async () => {
    answerEntryWrites([]);

    await expect(
      updateLogEntry(createTestClient(), {
        entry: original,
        amount: { quantity: 10, unit: "g" },
      }),
    ).rejects.toThrow(`The entry ${original.id} was not found`);
  });
});
