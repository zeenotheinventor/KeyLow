import { toLocalDate } from "@keylow/core/dates";
import { sumEntries } from "@keylow/core/diary";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { CopyDayPartialWriteError, copyDay, undoCopyDay } from "../../src/repos/diaryCopy";
import { createTestClient } from "../createTestClient";
import { answerCopyDay, copiedId } from "../support/copyDayServer";
import { foodEntryRow, quickEntryRow } from "../support/diary";
import { recipeEntryRow, servingInput } from "../support/recipeEntries";

import type { LogEntry } from "../../src/repos/diarySchemas";

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

const LONDON = "Europe/London";

const entryId = (number: number) => `44444444-4444-4444-8444-${String(number).padStart(12, "0")}`;

const nutrientsOf = (kcal: number, protein_g: number, fat_g: number, carbs_g: number) => ({
  kcal,
  protein_g,
  fat_g,
  carbs_g,
  fibre_g: null,
});

const foodAt = (number: number, time: string, nutrients: LogEntry["nutrients"]) =>
  foodEntryRow({ id: entryId(number), logged_at: `2026-10-15T${time}:00+00:00`, nutrients });

/** The sample day of brief 16 (Thursday 15 October 2026, BST), as stored: UTC instants an hour behind the clock. */
const sampleDay: LogEntry[] = [
  foodAt(1, "07:05", nutrientsOf(187, 5.6, 4.2, 30.2)),
  foodAt(2, "07:05", nutrientsOf(92, 7, 3.4, 9.6)),
  foodAt(3, "07:10", nutrientsOf(95, 1.2, 0.1, 20.3)),
  foodAt(4, "11:40", nutrientsOf(222, 48, 3.3, 0)),
  foodAt(5, "11:40", nutrientsOf(216, 4.9, 0.7, 47.5)),
  quickEntryRow({
    id: entryId(6),
    logged_at: "2026-10-15T11:45:00+00:00",
    nutrients: nutrientsOf(130, 2, 7, 15),
  }),
  foodAt(7, "14:20", nutrientsOf(97, 17.3, 0.3, 6.5)),
];

const insertedBodies = (writes: { method: string; body: unknown }[]) =>
  writes.filter((write) => write.method === "POST").map((write) => write.body);

const clockOf = (instant: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" }).format(
    new Date(instant),
  );

describe("copyDay", () => {
  it("should copy the brief 16 sample day onto the next day with every clock time kept", async () => {
    const { handlers, writes } = answerCopyDay({ sourceEntries: sampleDay });
    server.use(...handlers);

    await copyDay(createTestClient(), { from: "2026-10-15", to: "2026-10-16", timeZone: LONDON });

    const copies = insertedBodies(writes) as { logged_at: string; local_date: string }[];
    expect(copies.map((copy) => clockOf(copy.logged_at, LONDON))).toEqual([
      "08:05",
      "08:05",
      "08:10",
      "12:40",
      "12:40",
      "12:45",
      "15:20",
    ]);
    expect(copies.map((copy) => toLocalDate(new Date(copy.logged_at), LONDON))).toEqual(
      Array.from({ length: 7 }, () => "2026-10-16"),
    );
  });

  it("should give the copies the target local_date, not the source one", async () => {
    const { handlers, writes } = answerCopyDay({ sourceEntries: sampleDay });
    server.use(...handlers);

    await copyDay(createTestClient(), { from: "2026-10-15", to: "2026-10-16", timeZone: LONDON });

    const copies = insertedBodies(writes) as { local_date: string }[];
    expect(copies.map((copy) => copy.local_date)).toEqual(
      Array.from({ length: 7 }, () => "2026-10-16"),
    );
  });

  it("should leave the day at 1,039 kcal after the copy", async () => {
    const { handlers, writes } = answerCopyDay({ sourceEntries: sampleDay });
    server.use(...handlers);

    await copyDay(createTestClient(), { from: "2026-10-15", to: "2026-10-16", timeZone: LONDON });

    const copies = insertedBodies(writes) as { nutrients: LogEntry["nutrients"] }[];
    expect(sumEntries(copies).kcal).toBe(1039);
  });

  it("should keep each entry's snapshot, nutrients and food as they were", async () => {
    const [oats, , , , , cake] = sampleDay;
    const { handlers, writes } = answerCopyDay({ sourceEntries: sampleDay });
    server.use(...handlers);

    await copyDay(createTestClient(), { from: "2026-10-15", to: "2026-10-16", timeZone: LONDON });

    const [firstCopy, , , , , quickCopy] = insertedBodies(writes);
    expect(firstCopy).toMatchObject({
      item_type: "food",
      food_id: oats?.food_id,
      quantity: oats?.quantity,
      unit: oats?.unit,
      portion_id: oats?.portion_id,
      resolved_grams: oats?.resolved_grams,
      snapshot: oats?.snapshot,
      nutrients: oats?.nutrients,
    });
    expect(quickCopy).toMatchObject({
      item_type: "quick",
      snapshot: cake?.snapshot,
      nutrients: cake?.nutrients,
    });
  });

  it("should send only the columns a client may insert", async () => {
    const { handlers, writes } = answerCopyDay({ sourceEntries: [foodEntryRow()] });
    server.use(...handlers);

    await copyDay(createTestClient(), { from: "2026-10-15", to: "2026-10-16", timeZone: LONDON });

    const [copy] = insertedBodies(writes);
    expect(Object.keys(copy as object).sort()).toEqual(
      [
        "food_id",
        "item_type",
        "local_date",
        "logged_at",
        "nutrients",
        "portion_id",
        "quantity",
        "resolved_grams",
        "snapshot",
        "unit",
      ].sort(),
    );
  });

  describe("a recipe entry in the day", () => {
    const dinner = recipeEntryRow({ ...servingInput, loggedAt: "2026-10-15T17:00:00+00:00" });

    it("should copy it as a recipe entry, with its frozen snapshot, recipe id and nutrients as they were", async () => {
      const { handlers, writes } = answerCopyDay({ sourceEntries: [dinner] });
      server.use(...handlers);

      await copyDay(createTestClient(), { from: "2026-10-15", to: "2026-10-16", timeZone: LONDON });

      const [copy] = insertedBodies(writes);
      expect(copy).toMatchObject({
        item_type: "recipe",
        recipe_id: dinner.recipe_id,
        food_id: null,
        portion_id: null,
        quantity: 1,
        unit: "serving",
        resolved_grams: dinner.resolved_grams,
        snapshot: dinner.snapshot,
        nutrients: dinner.nutrients,
        local_date: "2026-10-16",
      });
    });

    it("should keep the clock time of the original on the target day", async () => {
      const { handlers, writes } = answerCopyDay({ sourceEntries: [dinner] });
      server.use(...handlers);

      await copyDay(createTestClient(), { from: "2026-10-15", to: "2026-10-16", timeZone: LONDON });

      const [copy] = insertedBodies(writes) as { logged_at: string }[];
      expect(clockOf(copy?.logged_at ?? "", LONDON)).toBe("18:00");
    });

    it("should send only the columns a client may insert, and no generated one", async () => {
      const { handlers, writes } = answerCopyDay({ sourceEntries: [dinner] });
      server.use(...handlers);

      await copyDay(createTestClient(), { from: "2026-10-15", to: "2026-10-16", timeZone: LONDON });

      const [copy] = insertedBodies(writes);
      expect(Object.keys(copy as object).sort()).toEqual(
        [
          "food_id",
          "item_type",
          "local_date",
          "logged_at",
          "nutrients",
          "portion_id",
          "quantity",
          "recipe_id",
          "resolved_grams",
          "snapshot",
          "unit",
        ].sort(),
      );
    });

    it("should not read the recipe, so an archived or edited recipe makes no difference", async () => {
      // answerCopyDay has no handler for the recipes tables: a read of one would fail the run.
      const { handlers } = answerCopyDay({ sourceEntries: [dinner] });
      server.use(...handlers);

      const copied = await copyDay(createTestClient(), {
        from: "2026-10-15",
        to: "2026-10-16",
        timeZone: LONDON,
      });

      expect(copied.count).toBe(1);
    });

    it("should leave the day at the sum of the original entries with the recipe serving added", async () => {
      const { handlers, writes } = answerCopyDay({ sourceEntries: [...sampleDay, dinner] });
      server.use(...handlers);

      await copyDay(createTestClient(), { from: "2026-10-15", to: "2026-10-16", timeZone: LONDON });

      const copies = insertedBodies(writes) as { nutrients: LogEntry["nutrients"] }[];
      expect(copies).toHaveLength(8);
      expect(sumEntries(copies).kcal).toBeCloseTo(1039 + 374.2, 10);
    });
  });

  it("should insert one entry at a time in the order of the source day, so the copies keep their order", async () => {
    const { handlers, writes } = answerCopyDay({ sourceEntries: sampleDay });
    server.use(...handlers);

    await copyDay(createTestClient(), { from: "2026-10-15", to: "2026-10-16", timeZone: LONDON });

    const copies = insertedBodies(writes) as { nutrients: { kcal: number } }[];
    expect(copies.map((copy) => copy.nutrients.kcal)).toEqual([187, 92, 95, 222, 216, 130, 97]);
  });

  it("should return the number of copies and the ids of exactly the rows it inserted", async () => {
    const { handlers } = answerCopyDay({ sourceEntries: sampleDay });
    server.use(...handlers);

    const copied = await copyDay(createTestClient(), {
      from: "2026-10-15",
      to: "2026-10-16",
      timeZone: LONDON,
    });

    expect(copied).toEqual({
      localDate: "2026-10-16",
      count: 7,
      entryIds: [1, 2, 3, 4, 5, 6, 7].map(copiedId),
    });
  });

  it("should read only the live entries of the source day", async () => {
    const { handlers, reads } = answerCopyDay({ sourceEntries: [] });
    server.use(...handlers);

    await copyDay(createTestClient(), { from: "2026-10-15", to: "2026-10-16", timeZone: LONDON });

    const entryRead = reads.find((url) => url.pathname.endsWith("/food_log_entries"));
    expect(entryRead?.searchParams.get("local_date")).toBe("eq.2026-10-15");
    expect(entryRead?.searchParams.get("deleted_at")).toBe("is.null");
  });

  it("should write nothing and return 0 for a day with nothing logged", async () => {
    const { handlers, writes } = answerCopyDay({ sourceEntries: [] });
    server.use(...handlers);

    const copied = await copyDay(createTestClient(), {
      from: "2026-10-15",
      to: "2026-10-16",
      timeZone: LONDON,
    });

    expect(copied).toEqual({ localDate: "2026-10-16", count: 0, entryIds: [] });
    expect(writes).toEqual([]);
  });

  it("should keep the local clock time across the clocks going forward", async () => {
    // Saturday 28 March 2026 is GMT, Sunday 29 March is BST: 08:05 on both days is an hour apart in UTC.
    const saturday = foodEntryRow({ logged_at: "2026-03-28T08:05:00+00:00" });
    const { handlers, writes } = answerCopyDay({ sourceEntries: [saturday] });
    server.use(...handlers);

    await copyDay(createTestClient(), { from: "2026-03-28", to: "2026-03-29", timeZone: LONDON });

    const [copy] = insertedBodies(writes) as { logged_at: string; local_date: string }[];
    expect(new Date(copy?.logged_at ?? "").toISOString()).toBe("2026-03-29T07:05:00.000Z");
    expect(copy?.local_date).toBe("2026-03-29");
  });

  it("should keep the local clock time across the clocks going back", async () => {
    // Saturday 24 October 2026 is BST, Sunday 25 October is GMT.
    const saturday = foodEntryRow({ logged_at: "2026-10-24T07:05:00+00:00" });
    const { handlers, writes } = answerCopyDay({ sourceEntries: [saturday] });
    server.use(...handlers);

    await copyDay(createTestClient(), { from: "2026-10-24", to: "2026-10-25", timeZone: LONDON });

    const [copy] = insertedBodies(writes) as { logged_at: string; local_date: string }[];
    expect(new Date(copy?.logged_at ?? "").toISOString()).toBe("2026-10-25T08:05:00.000Z");
    expect(copy?.local_date).toBe("2026-10-25");
  });

  it("should read the clock time in the profile's zone, not in UTC", async () => {
    // 23:30 in Auckland (NZDT, +13) on 15 October is 10:30 UTC the same day.
    const lateEvening = foodEntryRow({ logged_at: "2026-10-15T10:30:00+00:00" });
    const { handlers, writes } = answerCopyDay({ sourceEntries: [lateEvening] });
    server.use(...handlers);

    await copyDay(createTestClient(), {
      from: "2026-10-15",
      to: "2026-10-16",
      timeZone: "Pacific/Auckland",
    });

    const [copy] = insertedBodies(writes) as { logged_at: string; local_date: string }[];
    expect(new Date(copy?.logged_at ?? "").toISOString()).toBe("2026-10-16T10:30:00.000Z");
    expect(copy?.local_date).toBe("2026-10-16");
  });

  it("should take back the copies already inserted when a later insert fails", async () => {
    const { handlers, writes } = answerCopyDay({ sourceEntries: sampleDay, failInsertNumber: 3 });
    server.use(...handlers);

    await expect(
      copyDay(createTestClient(), { from: "2026-10-15", to: "2026-10-16", timeZone: LONDON }),
    ).rejects.toThrow(/copy the day/);

    const takeBack = writes.find((write) => write.method === "PATCH");
    expect(takeBack?.url.searchParams.get("id")).toBe(`in.(${copiedId(1)},${copiedId(2)})`);
    expect(insertedBodies(writes)).toHaveLength(3);
  });

  it("should not put a quantity or a nutrient value in the error", async () => {
    const { handlers } = answerCopyDay({ sourceEntries: sampleDay, failInsertNumber: 1 });
    server.use(...handlers);

    const failure = await copyDay(createTestClient(), {
      from: "2026-10-15",
      to: "2026-10-16",
      timeZone: LONDON,
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    const message = failure instanceof Error ? failure.message : "";
    expect(message).not.toMatch(/187|5\.6|Rolled oats/);
  });

  it("should refuse a target that is not a calendar date, before any request", async () => {
    const { handlers, reads, writes } = answerCopyDay({ sourceEntries: sampleDay });
    server.use(...handlers);

    await expect(
      copyDay(createTestClient(), { from: "2026-10-15", to: "tomorrow", timeZone: LONDON }),
    ).rejects.toThrow(RangeError);
    expect([reads, writes]).toEqual([[], []]);
  });

  it("should refuse a source that is not a calendar date, before any request", async () => {
    const { handlers, reads, writes } = answerCopyDay({ sourceEntries: sampleDay });
    server.use(...handlers);

    await expect(
      copyDay(createTestClient(), { from: "tomorrow", to: "2026-10-16", timeZone: LONDON }),
    ).rejects.toThrow(RangeError);
    expect([reads, writes]).toEqual([[], []]);
  });

  it("should refuse to copy a day onto itself, before any request", async () => {
    const { handlers, reads, writes } = answerCopyDay({ sourceEntries: sampleDay });
    server.use(...handlers);

    await expect(
      copyDay(createTestClient(), { from: "2026-10-15", to: "2026-10-15", timeZone: LONDON }),
    ).rejects.toThrow(RangeError);
    expect([reads, writes]).toEqual([[], []]);
  });

  it("should move a time the clocks skip forward, as core does, on the day they go forward", async () => {
    // 01:30 on Saturday 28 March 2026 exists (GMT). On Sunday 29 March the clocks jump from 01:00 to
    // 02:00, so 01:30 does not exist and core's rule gives the instant that reads 02:30.
    const earlyHours = foodEntryRow({ logged_at: "2026-03-28T01:30:00+00:00" });
    const { handlers, writes } = answerCopyDay({ sourceEntries: [earlyHours] });
    server.use(...handlers);

    await copyDay(createTestClient(), { from: "2026-03-28", to: "2026-03-29", timeZone: LONDON });

    const [copy] = insertedBodies(writes) as { logged_at: string; local_date: string }[];
    expect(clockOf(copy?.logged_at ?? "", LONDON)).toBe("02:30");
    expect(new Date(copy?.logged_at ?? "").toISOString()).toBe("2026-03-29T01:30:00.000Z");
    expect(copy?.local_date).toBe("2026-03-29");
  });

  it("should keep the seconds of the original, so a copy is the same clock instant on the target day", async () => {
    const early = foodEntryRow({ id: entryId(1), logged_at: "2026-10-15T07:05:10+00:00" });
    const late = foodEntryRow({ id: entryId(2), logged_at: "2026-10-15T07:05:50.250+00:00" });
    const { handlers, writes } = answerCopyDay({ sourceEntries: [early, late] });
    server.use(...handlers);

    await copyDay(createTestClient(), { from: "2026-10-15", to: "2026-10-16", timeZone: LONDON });

    const copies = insertedBodies(writes) as { logged_at: string }[];
    expect(copies.map((copy) => new Date(copy.logged_at).toISOString())).toEqual([
      "2026-10-16T07:05:10.000Z",
      "2026-10-16T07:05:50.250Z",
    ]);
  });

  it("should not carry the database's error, which can quote the failing row, as the cause", async () => {
    const { handlers } = answerCopyDay({ sourceEntries: sampleDay, failInsertNumber: 1 });
    server.use(...handlers);

    const failure = await copyDay(createTestClient(), {
      from: "2026-10-15",
      to: "2026-10-16",
      timeZone: LONDON,
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(failure instanceof Error ? failure.cause : "set").toBeUndefined();
    expect(JSON.stringify(failure, Object.getOwnPropertyNames(failure))).not.toMatch(
      /Failing row|187/,
    );
  });

  it("should throw an error that carries the ids left behind when the copies cannot be taken back", async () => {
    const { handlers } = answerCopyDay({
      sourceEntries: sampleDay,
      failInsertNumber: 3,
      failTakeBack: true,
    });
    server.use(...handlers);

    const failure = await copyDay(createTestClient(), {
      from: "2026-10-15",
      to: "2026-10-16",
      timeZone: LONDON,
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(CopyDayPartialWriteError);
    expect(failure instanceof CopyDayPartialWriteError ? failure.entryIds : []).toEqual([
      copiedId(1),
      copiedId(2),
    ]);
    const message = failure instanceof Error ? failure.message : "";
    expect(message).toContain("2 entries");
    expect(message).not.toMatch(/Failing row|187|5\.6/);
  });

  it("should not throw the partial write error when the copies were taken back", async () => {
    const { handlers } = answerCopyDay({ sourceEntries: sampleDay, failInsertNumber: 3 });
    server.use(...handlers);

    const failure = await copyDay(createTestClient(), {
      from: "2026-10-15",
      to: "2026-10-16",
      timeZone: LONDON,
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(CopyDayPartialWriteError);
  });
});

describe("undoCopyDay", () => {
  it("should soft delete exactly the copied rows by id", async () => {
    const { handlers, writes } = answerCopyDay({ sourceEntries: [] });
    server.use(...handlers);

    await undoCopyDay(createTestClient(), {
      localDate: "2026-10-16",
      count: 2,
      entryIds: [copiedId(1), copiedId(2)],
    });

    expect(writes).toHaveLength(1);
    const [undo] = writes;
    expect(undo?.method).toBe("PATCH");
    expect(undo?.url.searchParams.get("id")).toBe(`in.(${copiedId(1)},${copiedId(2)})`);
    expect(undo?.url.searchParams.has("local_date")).toBe(false);
    expect(z.strictObject({ deleted_at: z.iso.datetime() }).safeParse(undo?.body).success).toBe(
      true,
    );
  });

  it("should only touch rows that are still live", async () => {
    const { handlers, writes } = answerCopyDay({ sourceEntries: [] });
    server.use(...handlers);

    await undoCopyDay(createTestClient(), {
      localDate: "2026-10-16",
      count: 1,
      entryIds: [copiedId(1)],
    });

    expect(writes[0]?.url.searchParams.get("deleted_at")).toBe("is.null");
  });

  it("should send nothing when nothing was copied", async () => {
    const { handlers, writes } = answerCopyDay({ sourceEntries: [] });
    server.use(...handlers);

    await undoCopyDay(createTestClient(), { localDate: "2026-10-16", count: 0, entryIds: [] });

    expect(writes).toEqual([]);
  });
});
