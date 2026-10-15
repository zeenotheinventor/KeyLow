import { instantAtLocalTime } from "@keylow/core/dates";
import { defaultLoggedAt, groupEntriesByHour } from "@keylow/core/diary";
import { customFoodInputSchema } from "@keylow/core/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { getDiaryDay, listRecentFoods } from "../../src/repos/diary";
import {
  logFood,
  logQuickEntry,
  restoreLogEntry,
  softDeleteLogEntry,
  updateLogEntry,
} from "../../src/repos/diaryWrites";
import { createFood, updateFood } from "../../src/repos/foods";

import type { TestUser } from "./support/users";
import type { Food } from "@keylow/core/schemas";

const RUN_ID = crypto.randomUUID();
const TIME_ZONE = "Europe/London";

const customFoodInput = (name: string, kcal: number) =>
  customFoodInputSchema.parse({
    name: `key199-${name}-${RUN_ID}`,
    basis: "per_100g",
    kcal,
    protein_g: 10,
    fat_g: 5,
    carbs_g: 30,
    portions: [],
  });

/** The time and day an entry gets at `hour:minute` London time on `viewedDate`, in the shape `logFood` takes. */
const londonTime = (viewedDate: string, hour: number, minute = 0) => {
  const loggedAt = instantAtLocalTime(viewedDate, hour, minute, TIME_ZONE);
  return { loggedAt: loggedAt.toISOString(), timeZone: TIME_ZONE };
};

describe("writing the diary against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;
  let oats: Food;

  beforeAll(async () => {
    [userA, userB] = await Promise.all([createTestUser("key199"), createTestUser("key199")]);
    ({ food: oats } = await createFood(userA.client, userA.id, customFoodInput("oats", 200)));
  });

  afterAll(async () => {
    // The users' own rows (foods, entries) go with them (on delete cascade).
    const owners = await deleteCreatedTestUsers();
    expect(owners).toHaveLength(2);
  });

  describe("logging at a time", () => {
    const day = "2026-10-20";

    it("should file an entry logged at 12:00 in the 12 hour of its day", async () => {
      // 12:00 in London is 11:00 UTC on this day (summer time), so a day cut at UTC would get it wrong.
      const { loggedAt, localDate } = defaultLoggedAt(
        { now: new Date("2026-10-25T09:00:00Z"), viewedDate: day, hour: 12 },
        TIME_ZONE,
      );

      const entry = await logFood(userA.client, {
        food: oats,
        quantity: 50,
        unit: "g",
        loggedAt: loggedAt.toISOString(),
        localDate,
      });

      const { entries } = await getDiaryDay(userA.client, day);
      const twelve = groupEntriesByHour(entries, TIME_ZONE)[12];
      expect(twelve?.entries.map((listed) => listed.id)).toEqual([entry.id]);
      expect(entry.local_date).toBe(day);
    });

    it("should store a quick add at its time and total it with the day", async () => {
      const quickDay = "2026-10-21";

      const entry = await logQuickEntry(userA.client, {
        kcal: 300,
        label: "key199 quick",
        localDate: quickDay,
        ...londonTime(quickDay, 15, 30),
      });

      const { entries, totals } = await getDiaryDay(userA.client, quickDay);
      expect(entries.map((listed) => listed.id)).toEqual([entry.id]);
      expect(entry).toMatchObject({ item_type: "quick", snapshot: { label: "key199 quick" } });
      expect(totals).toMatchObject({ entry_count: 1, kcal: 300 });
    });

    it("should keep several entries logged one after another apart", async () => {
      const busyDay = "2026-10-22";
      const input = {
        food: oats,
        unit: "g",
        localDate: busyDay,
        ...londonTime(busyDay, 9),
      } as const;

      const [first, second] = await Promise.all([
        logFood(userA.client, { ...input, quantity: 30 }),
        logFood(userA.client, { ...input, quantity: 70 }),
      ]);

      expect(first.id).not.toBe(second.id);
      await softDeleteLogEntry(userA.client, first.id);
      const { entries } = await getDiaryDay(userA.client, busyDay);
      expect(entries.map((listed) => listed.id)).toEqual([second.id]);
    });

    it("should have no column or field called meal_slot or slot", async () => {
      const slotDay = "2026-10-23";
      const entry = await logFood(userA.client, {
        food: oats,
        quantity: 50,
        unit: "g",
        localDate: slotDay,
        ...londonTime(slotDay, 8),
      });

      const stored = await userA.client.from("food_log_entries").select("*").eq("id", entry.id);

      expect(stored.error).toBeNull();
      expect(Object.keys(stored.data?.[0] ?? {})).not.toContain("meal_slot");
      expect(Object.keys(stored.data?.[0] ?? {}).join(",")).not.toMatch(/slot/i);
      expect(Object.keys(entry).join(",")).not.toMatch(/slot/i);
    });
  });

  describe("a food edited after it was logged", () => {
    it("should leave the entry unchanged, and change it only on update to current food data", async () => {
      const day = "2026-10-24";
      const { food: porridge } = await createFood(
        userA.client,
        userA.id,
        customFoodInput("porridge", 200),
      );
      const entry = await logFood(userA.client, {
        food: porridge,
        quantity: 50,
        unit: "g",
        localDate: day,
        ...londonTime(day, 8),
      });
      expect(entry.nutrients.kcal).toBe(100);

      await updateFood(userA.client, porridge.id, customFoodInput("porridge", 400));

      const unchanged = (await getDiaryDay(userA.client, day)).entries[0];
      expect(unchanged).toMatchObject({
        nutrients: { kcal: 100 },
        snapshot: { per100: { kcal: 200 } },
      });

      // Changing the amount recomputes from the entry's own snapshot, so the edited food still does not leak in.
      const reweighed = await updateLogEntry(userA.client, {
        entry,
        amount: { quantity: 100, unit: "g" },
      });
      expect(reweighed).toMatchObject({
        nutrients: { kcal: 200 },
        snapshot: { per100: { kcal: 200 } },
      });

      if (reweighed.item_type !== "food") {
        throw new Error("The entry changed kind");
      }
      const refreshed = await updateLogEntry(userA.client, {
        entry: reweighed,
        useCurrentFoodData: true,
      });
      expect(refreshed).toMatchObject({
        quantity: 100,
        nutrients: { kcal: 400 },
        snapshot: { per100: { kcal: 400 } },
      });
      expect((await getDiaryDay(userA.client, day)).totals?.kcal).toBe(400);
    });

    it("should still update to current food data after the food was deleted", async () => {
      const day = "2026-10-24";
      const { food: bread } = await createFood(
        userA.client,
        userA.id,
        customFoodInput("bread", 250),
      );
      const entry = await logFood(userA.client, {
        food: bread,
        quantity: 100,
        unit: "g",
        localDate: day,
        ...londonTime(day, 10),
      });
      const deletion = await userA.client
        .from("foods")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", bread.id);
      expect(deletion.error).toBeNull();

      const refreshed = await updateLogEntry(userA.client, { entry, useCurrentFoodData: true });

      expect(refreshed).toMatchObject({ quantity: 100, nutrients: { kcal: 250 } });
    });
  });

  describe("changing the time of an entry", () => {
    it("should move an entry from 23:30 to 00:15 into the next day", async () => {
      const day = "2026-10-26";
      const nextDay = "2026-10-27";
      const entry = await logFood(userA.client, {
        food: oats,
        quantity: 50,
        unit: "g",
        localDate: day,
        ...londonTime(day, 23, 30),
      });
      expect((await getDiaryDay(userA.client, day)).entries.map(({ id }) => id)).toEqual([
        entry.id,
      ]);

      const moved = await updateLogEntry(userA.client, {
        entry,
        time: londonTime(nextDay, 0, 15),
      });

      expect(moved.local_date).toBe(nextDay);
      expect((await getDiaryDay(userA.client, day)).entries).toEqual([]);
      expect((await getDiaryDay(userA.client, day)).totals).toBeNull();
      expect((await getDiaryDay(userA.client, nextDay)).entries.map(({ id }) => id)).toEqual([
        entry.id,
      ]);
      expect(moved.nutrients).toEqual(entry.nutrients);
    });

    it("should change the time without touching the amount, and list the entry in its new hour", async () => {
      const day = "2026-10-28";
      const entry = await logFood(userA.client, {
        food: oats,
        quantity: 50,
        unit: "g",
        localDate: day,
        ...londonTime(day, 8),
      });

      await updateLogEntry(userA.client, { entry, time: londonTime(day, 19, 5) });

      const { entries } = await getDiaryDay(userA.client, day);
      expect(groupEntriesByHour(entries, TIME_ZONE)[19]?.entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ quantity: 50, snapshot: { quantity: 50 } });
    });
  });

  describe("deleting and restoring", () => {
    const day = "2026-10-29";

    it("should drop the entry from the day and its total, and bring both back on restore", async () => {
      const [keep, removable] = await Promise.all(
        [100, 50].map((quantity) =>
          logFood(userA.client, {
            food: oats,
            quantity,
            unit: "g",
            localDate: day,
            ...londonTime(day, 12),
          }),
        ),
      );
      if (keep === undefined || removable === undefined) {
        throw new Error("The two entries were not stored");
      }
      expect((await getDiaryDay(userA.client, day)).totals?.kcal).toBe(300);

      await softDeleteLogEntry(userA.client, removable.id);

      const afterDelete = await getDiaryDay(userA.client, day);
      expect(afterDelete.entries.map(({ id }) => id)).toEqual([keep.id]);
      expect(afterDelete.totals).toMatchObject({ entry_count: 1, kcal: 200 });

      await restoreLogEntry(userA.client, removable.id);

      const afterRestore = await getDiaryDay(userA.client, day);
      expect(afterRestore.entries.map(({ id }) => id).sort()).toEqual(
        [keep.id, removable.id].sort(),
      );
      expect(afterRestore.totals).toMatchObject({ entry_count: 2, kcal: 300 });
    });

    it("should not let another user delete, restore or update the entry", async () => {
      const entry = await logFood(userA.client, {
        food: oats,
        quantity: 50,
        unit: "g",
        localDate: day,
        ...londonTime(day, 14),
      });

      await expect(softDeleteLogEntry(userB.client, entry.id)).rejects.toThrow("was not found");
      await expect(restoreLogEntry(userB.client, entry.id)).rejects.toThrow("was not found");
      await expect(
        updateLogEntry(userB.client, { entry, amount: { quantity: 1, unit: "g" } }),
      ).rejects.toThrow("was not found");

      const { entries } = await getDiaryDay(userA.client, day);
      expect(entries.find(({ id }) => id === entry.id)).toMatchObject({ quantity: 50 });
    });

    it("should not update a deleted entry", async () => {
      const entry = await logFood(userA.client, {
        food: oats,
        quantity: 50,
        unit: "g",
        localDate: day,
        ...londonTime(day, 16),
      });
      await softDeleteLogEntry(userA.client, entry.id);

      await expect(
        updateLogEntry(userA.client, { entry, amount: { quantity: 1, unit: "g" } }),
      ).rejects.toThrow("was not found");
    });
  });

  describe("the recent foods after a delete", () => {
    it("should fall back to the earlier snapshot of a food when its newest entry is deleted", async () => {
      const day = "2026-10-30";
      const { food: yoghurt } = await createFood(
        userA.client,
        userA.id,
        customFoodInput("yoghurt", 100),
      );
      const earlier = await logFood(userA.client, {
        food: yoghurt,
        quantity: 40,
        unit: "g",
        localDate: day,
        ...londonTime(day, 8),
      });
      const newest = await logFood(userA.client, {
        food: yoghurt,
        quantity: 60,
        unit: "g",
        localDate: day,
        ...londonTime(day, 9),
      });
      const recentOf = async () =>
        (await listRecentFoods(userA.client)).find((food) => food.foodId === yoghurt.id);
      expect((await recentOf())?.entryId).toBe(newest.id);

      await softDeleteLogEntry(userA.client, newest.id);

      expect(await recentOf()).toMatchObject({
        entryId: earlier.id,
        snapshot: { quantity: 40, unit: "g" },
      });

      await softDeleteLogEntry(userA.client, earlier.id);

      expect(await recentOf()).toBeUndefined();
    });
  });
});
