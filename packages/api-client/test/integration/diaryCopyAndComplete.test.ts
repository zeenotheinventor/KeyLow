import { buildLogEntry, buildQuickEntry } from "@keylow/core/diary";
import { customFoodInputSchema } from "@keylow/core/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { setDayComplete } from "../../src/repos/dayLogs";
import { getDiaryDay, getDiaryWeek } from "../../src/repos/diary";
import { copyDay, undoCopyDay } from "../../src/repos/diaryCopy";
import { createFood } from "../../src/repos/foods";

import type { TestUser } from "./support/users";
import type { Food } from "@keylow/core/schemas";

const RUN_ID = crypto.randomUUID();
const LONDON = "Europe/London";

const customFood = (name: string, kcal: number) =>
  customFoodInputSchema.parse({
    name: `key200-${name}-${RUN_ID}`,
    basis: "per_100g",
    kcal,
    protein_g: 10,
    fat_g: 5,
    carbs_g: 30,
    portions: [],
  });

/** The clock time of an instant in London, "08:05". */
const londonClock = (loggedAt: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: LONDON, hour: "2-digit", minute: "2-digit" }).format(
    new Date(loggedAt),
  );

describe("copying a day and marking a day complete against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;
  let oats: Food;
  let milk: Food;

  const logAt = async (food: Food, localDate: string, instant: string, quantity = 100) => {
    const { data, error } = await userA.client
      .from("food_log_entries")
      .insert(buildLogEntry({ food, quantity, unit: "g", localDate, loggedAt: instant }))
      .select("id")
      .single();
    expect(error).toBeNull();
    return data?.id ?? "";
  };

  beforeAll(async () => {
    [userA, userB] = await Promise.all([createTestUser("key200"), createTestUser("key200")]);
    ({ food: oats } = await createFood(userA.client, userA.id, customFood("oats", 200)));
    ({ food: milk } = await createFood(userA.client, userA.id, customFood("milk", 50)));
  });

  afterAll(async () => {
    // The users' own rows (foods, entries, day logs) go with them (on delete cascade).
    expect(await deleteCreatedTestUsers()).toHaveLength(2);
  });

  describe("copying a day", () => {
    // October 2026 is British Summer Time until the 25th: 08:05 on the clock is 07:05 UTC.
    const yesterday = "2026-10-14";
    const today = "2026-10-15";
    let existingId: string;
    let copied: Awaited<ReturnType<typeof copyDay>>;

    beforeAll(async () => {
      // Two entries at the very same instant, saved one after the other, then a quick add, and a
      // deleted entry that must not be copied.
      await logAt(oats, yesterday, "2026-10-14T07:05:00+00:00", 50);
      await logAt(milk, yesterday, "2026-10-14T07:05:00+00:00", 200);
      const { error } = await userA.client.from("food_log_entries").insert(
        buildQuickEntry({
          localDate: yesterday,
          loggedAt: "2026-10-14T11:40:00+00:00",
          kcal: 130,
          label: "key200 crisps",
        }),
      );
      expect(error).toBeNull();
      const removedId = await logAt(oats, yesterday, "2026-10-14T13:00:00+00:00");
      const removal = await userA.client
        .from("food_log_entries")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", removedId);
      expect(removal.error).toBeNull();

      // Something already logged today at the same time as the first copy.
      existingId = await logAt(oats, today, "2026-10-15T07:05:00+00:00", 25);

      copied = await copyDay(userA.client, { from: yesterday, to: today, timeZone: LONDON });
    });

    it("should copy the live entries only, and say how many", () => {
      expect(copied).toMatchObject({ localDate: today, count: 3 });
      expect(copied.entryIds).toHaveLength(3);
    });

    it("should put the copies on the target day at the clock times of the originals", async () => {
      const { entries } = await getDiaryDay(userA.client, today);

      expect(entries.map((entry) => londonClock(entry.logged_at))).toEqual([
        "08:05",
        "08:05",
        "08:05",
        "12:40",
      ]);
      expect(entries.every((entry) => entry.local_date === today)).toBe(true);
    });

    it("should sort a copy after the entry already at that time, and the copies in their original order", async () => {
      const { entries } = await getDiaryDay(userA.client, today);

      expect(entries[0]?.id).toBe(existingId);
      expect(entries.slice(1, 4).map((entry) => entry.id)).toEqual(copied.entryIds);
      expect(entries.slice(1, 3).map((entry) => entry.food_id)).toEqual([oats.id, milk.id]);
    });

    it("should keep the snapshot and nutrients of every copy as they were", async () => {
      const source = await getDiaryDay(userA.client, yesterday);
      const { entries } = await getDiaryDay(userA.client, today);

      const copies = entries.filter((entry) => copied.entryIds.includes(entry.id));
      expect(copies.map(({ snapshot, nutrients }) => ({ snapshot, nutrients }))).toEqual(
        source.entries.map(({ snapshot, nutrients }) => ({ snapshot, nutrients })),
      );
    });

    it("should leave the source day as it was", async () => {
      const { entries } = await getDiaryDay(userA.client, yesterday);

      expect(entries).toHaveLength(3);
      expect(entries.every((entry) => entry.local_date === yesterday)).toBe(true);
    });

    it("should remove exactly the copied rows on Undo, keeping an entry added since", async () => {
      const addedSince = await logAt(milk, today, "2026-10-15T15:00:00+00:00");

      await undoCopyDay(userA.client, copied);

      const { entries } = await getDiaryDay(userA.client, today);
      expect(entries.map((entry) => entry.id)).toEqual([existingId, addedSince]);
      const source = await getDiaryDay(userA.client, yesterday);
      expect(source.entries).toHaveLength(3);
    });

    it("should copy nothing from a day with nothing logged", async () => {
      const copy = await copyDay(userA.client, {
        from: "2026-10-01",
        to: "2026-10-02",
        timeZone: LONDON,
      });

      expect(copy).toEqual({ localDate: "2026-10-02", count: 0, entryIds: [] });
      expect((await getDiaryDay(userA.client, "2026-10-02")).entries).toEqual([]);
    });

    it("should copy nothing of another user's day", async () => {
      const copy = await copyDay(userB.client, { from: yesterday, to: today, timeZone: LONDON });

      expect(copy.count).toBe(0);
    });
  });

  describe("copying across a clock change", () => {
    it("should keep 08:05 on the clock when the clocks go forward", async () => {
      // Saturday 28 March 2026 is GMT, Sunday 29 March is BST.
      await logAt(oats, "2026-03-28", "2026-03-28T08:05:00+00:00");

      const copy = await copyDay(userA.client, {
        from: "2026-03-28",
        to: "2026-03-29",
        timeZone: LONDON,
      });

      const { entries } = await getDiaryDay(userA.client, "2026-03-29");
      expect(copy.count).toBe(1);
      expect(entries.map((entry) => londonClock(entry.logged_at))).toEqual(["08:05"]);
      expect(new Date(entries[0]?.logged_at ?? "").toISOString()).toBe("2026-03-29T07:05:00.000Z");
    });

    it("should keep 08:05 on the clock when the clocks go back", async () => {
      // Saturday 24 October 2026 is BST, Sunday 25 October is GMT.
      await logAt(oats, "2026-10-24", "2026-10-24T07:05:00+00:00");

      await copyDay(userA.client, { from: "2026-10-24", to: "2026-10-25", timeZone: LONDON });

      const { entries } = await getDiaryDay(userA.client, "2026-10-25");
      expect(entries.map((entry) => londonClock(entry.logged_at))).toEqual(["08:05"]);
      expect(new Date(entries[0]?.logged_at ?? "").toISOString()).toBe("2026-10-25T08:05:00.000Z");
    });
  });

  describe("the seconds of an entry", () => {
    it("should be kept, so the copy is the same clock instant on the target day", async () => {
      await logAt(oats, "2026-10-26", "2026-10-26T07:05:37+00:00");

      await copyDay(userA.client, { from: "2026-10-26", to: "2026-10-27", timeZone: LONDON });

      const { entries } = await getDiaryDay(userA.client, "2026-10-27");
      expect(entries.map((entry) => new Date(entry.logged_at).toISOString())).toEqual([
        "2026-10-27T07:05:37.000Z",
      ]);
    });
  });

  describe("marking a day complete", () => {
    const monday = "2026-11-02";
    const wednesday = "2026-11-04";

    const weekOfMonday = async (client: TestUser["client"]) => getDiaryWeek(client, monday);

    it("should mark a day with no day log complete, with the time it was completed", async () => {
      await setDayComplete(userA.client, wednesday, true);

      const week = await weekOfMonday(userA.client);
      expect(week[2]?.dayLog).toMatchObject({ local_date: wednesday, is_complete: true });
      expect(week[2]?.dayLog?.completed_at).not.toBeNull();
      expect(week.filter((day) => day.dayLog?.is_complete)).toHaveLength(1);
    });

    it("should keep a single day log when the day is marked complete again", async () => {
      await setDayComplete(userA.client, wednesday, true);

      const { data, error } = await userA.client
        .from("day_logs")
        .select("local_date")
        .eq("local_date", wednesday);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("should clear the completion and its time, and keep the note", async () => {
      const note = await userA.client
        .from("day_logs")
        .update({ note: "key200 note" })
        .eq("local_date", wednesday);
      expect(note.error).toBeNull();

      await setDayComplete(userA.client, wednesday, false);

      const { dayLog } = await getDiaryDay(userA.client, wednesday);
      expect(dayLog).toMatchObject({
        is_complete: false,
        completed_at: null,
        note: "key200 note",
      });
    });

    it("should write no day log for an incomplete day that has none", async () => {
      await setDayComplete(userA.client, "2026-11-05", false);

      const { dayLog } = await getDiaryDay(userA.client, "2026-11-05");
      expect(dayLog).toBeNull();
    });

    it("should not touch another user's days", async () => {
      await setDayComplete(userA.client, "2026-11-06", true);

      const week = await weekOfMonday(userB.client);
      expect(week.every((day) => day.dayLog === null)).toBe(true);
    });
  });
});
