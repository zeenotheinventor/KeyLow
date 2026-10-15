import { buildLogEntry, buildQuickEntry } from "@keylow/core/diary";
import { customFoodInputSchema } from "@keylow/core/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import {
  getDiaryDay,
  getDiaryWeek,
  listCompleteDays,
  listRecentFoods,
} from "../../src/repos/diary";
import { createFood } from "../../src/repos/foods";

import type { TestUser } from "./support/users";
import type { Food } from "@keylow/core/schemas";

const RUN_ID = crypto.randomUUID();

const customFood = (name: string) =>
  customFoodInputSchema.parse({
    name: `key198-${name}-${RUN_ID}`,
    basis: "per_100g",
    kcal: 200,
    protein_g: 10,
    fat_g: 5,
    carbs_g: 30,
    portions: [],
  });

const MONDAY = "2026-10-12";
const WEDNESDAY = "2026-10-14";

describe("reading the diary against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;
  let oats: Food;
  let toast: Food;
  let deletedFood: Food;
  let entryAt: (food: Food, localDate: string, time: string, quantity?: number) => Promise<string>;

  beforeAll(async () => {
    [userA, userB] = await Promise.all([createTestUser("key198"), createTestUser("key198")]);

    ({ food: oats } = await createFood(userA.client, userA.id, customFood("oats")));
    ({ food: toast } = await createFood(userA.client, userA.id, customFood("toast")));
    ({ food: deletedFood } = await createFood(userA.client, userA.id, customFood("deleted")));

    entryAt = async (food, localDate, time, quantity = 100) => {
      const { data, error } = await userA.client
        .from("food_log_entries")
        .insert(
          buildLogEntry({
            food,
            quantity,
            unit: "g",
            localDate,
            loggedAt: `${localDate}T${time}:00+00:00`,
          }),
        )
        .select("id")
        .single();
      expect(error).toBeNull();
      return data?.id ?? "";
    };
  });

  afterAll(async () => {
    // The users' own rows (foods, entries, day logs) go with them (on delete cascade).
    const owners = await deleteCreatedTestUsers();
    expect(owners).toHaveLength(2);
  });

  describe("a day", () => {
    const day = "2026-10-20";
    const ids: Record<string, string> = {};

    beforeAll(async () => {
      // Inserted out of time order on purpose.
      ids.noon = await entryAt(oats, day, "12:00");
      ids.eight = await entryAt(oats, day, "08:00");
      ids.ten = await entryAt(toast, day, "10:00");
      // Five at the same instant, saved one after the other, so created_at is their only order.
      for (const name of ["a", "b", "c", "d", "e"]) {
        ids[`nine${name}`] = await entryAt(toast, day, "09:00");
      }
      ids.removed = await entryAt(oats, day, "09:30");
      const removal = await userA.client
        .from("food_log_entries")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", ids.removed);
      expect(removal.error).toBeNull();

      const quick = await userA.client
        .from("food_log_entries")
        .insert(
          buildQuickEntry({
            localDate: day,
            loggedAt: `${day}T07:00:00+00:00`,
            kcal: 300,
            label: "key198 quick",
          }),
        )
        .select("id")
        .single();
      expect(quick.error).toBeNull();
      ids.quick = quick.data?.id ?? "";

      const complete = await userA.client
        .from("day_logs")
        .insert({ local_date: day, is_complete: true, completed_at: new Date().toISOString() });
      expect(complete.error).toBeNull();
    });

    it("should list the entries in time order whatever order they were inserted in", async () => {
      const { entries } = await getDiaryDay(userA.client, day);

      const loggedTimes = entries.map((entry) => entry.logged_at.slice(11, 16));
      expect(loggedTimes).toEqual([
        "07:00",
        "08:00",
        "09:00",
        "09:00",
        "09:00",
        "09:00",
        "09:00",
        "10:00",
        "12:00",
      ]);
    });

    it("should list entries at the same time in the order they were saved", async () => {
      const { entries } = await getDiaryDay(userA.client, day);

      const sameTime = entries.filter((entry) => entry.logged_at.startsWith(`${day}T09:00`));
      expect(sameTime.map((entry) => entry.id)).toEqual(
        ["a", "b", "c", "d", "e"].map((name) => ids[`nine${name}`]),
      );
    });

    it("should leave out the entry the user deleted", async () => {
      const { entries } = await getDiaryDay(userA.client, day);

      expect(entries.map((entry) => entry.id)).not.toContain(ids.removed);
    });

    it("should parse food and quick entries through the core schemas", async () => {
      const { entries } = await getDiaryDay(userA.client, day);

      expect(entries[0]).toMatchObject({
        item_type: "quick",
        snapshot: { kind: "quick", label: "key198 quick" },
      });
      expect(entries[1]).toMatchObject({
        item_type: "food",
        food_id: oats.id,
        snapshot: { kind: "food", ref: oats.id, quantity: 100, unit: "g" },
      });
    });

    it("should return the day log and the totals of the live entries", async () => {
      const { dayLog, totals } = await getDiaryDay(userA.client, day);

      expect(dayLog).toMatchObject({ local_date: day, is_complete: true });
      // 300 quick + oats 08:00 and 12:00 (200 each) + toast at 09:00 x5 and 10:00 (200 each)
      expect(totals).toMatchObject({
        local_date: day,
        entry_count: 9,
        kcal: 300 + 2 * 200 + 6 * 200,
      });
    });

    it("should return nothing of user A's day to user B", async () => {
      expect(await getDiaryDay(userB.client, day)).toEqual({
        localDate: day,
        entries: [],
        dayLog: null,
        totals: null,
      });
    });
  });

  describe("a week", () => {
    beforeAll(async () => {
      await entryAt(oats, MONDAY, "08:00");
      await entryAt(oats, WEDNESDAY, "08:00");
      await entryAt(toast, WEDNESDAY, "09:00");
      const complete = await userA.client
        .from("day_logs")
        .insert({ local_date: WEDNESDAY, is_complete: true });
      expect(complete.error).toBeNull();
    });

    it("should read a week with one complete day and no day log rows for the others", async () => {
      const week = await getDiaryWeek(userA.client, MONDAY);

      expect(week.map((day) => day.localDate)).toEqual([
        "2026-10-12",
        "2026-10-13",
        "2026-10-14",
        "2026-10-15",
        "2026-10-16",
        "2026-10-17",
        "2026-10-18",
      ]);
      expect(week.map((day) => day.dayLog?.is_complete ?? false)).toEqual([
        false,
        false,
        true,
        false,
        false,
        false,
        false,
      ]);
      expect(week.map((day) => day.totals?.entry_count ?? 0)).toEqual([1, 0, 2, 0, 0, 0, 0]);
      expect(week[2]?.totals?.kcal).toBe(400);
    });

    it("should return a week of empty days to user B", async () => {
      const week = await getDiaryWeek(userB.client, MONDAY);

      expect(week).toHaveLength(7);
      expect(week.every((day) => day.dayLog === null && day.totals === null)).toBe(true);
    });
  });

  describe("the complete days of a month", () => {
    beforeAll(async () => {
      const rows = [
        { local_date: "2026-09-30", is_complete: true },
        { local_date: "2026-11-03", is_complete: true },
        { local_date: "2026-11-30", is_complete: true },
        { local_date: "2026-11-05", is_complete: false },
        { local_date: "2026-11-01", is_complete: true },
      ];
      const inserted = await userA.client.from("day_logs").insert(rows);
      expect(inserted.error).toBeNull();
    });

    it("should list only the complete days inside the month, in date order", async () => {
      expect(await listCompleteDays(userA.client, "2026-11")).toEqual([
        "2026-11-01",
        "2026-11-03",
        "2026-11-30",
      ]);
    });

    it("should not list a day that is complete in another month", async () => {
      expect(await listCompleteDays(userA.client, "2026-09")).toEqual(["2026-09-30"]);
    });

    it("should list nothing for user B", async () => {
      expect(await listCompleteDays(userB.client, "2026-11")).toEqual([]);
    });
  });

  describe("the recent foods", () => {
    const day = "2026-10-25";

    beforeAll(async () => {
      await entryAt(oats, day, "08:00", 40);
      await entryAt(oats, day, "09:00", 60);
      await entryAt(toast, day, "10:00", 80);
      await entryAt(deletedFood, day, "11:00");
      const softDelete = await userA.client
        .from("foods")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", deletedFood.id);
      expect(softDelete.error).toBeNull();
    });

    it("should list each food once, newest first, with the snapshot of its last entry", async () => {
      const recent = await listRecentFoods(userA.client);

      const ours = recent.filter((food) => [oats.id, toast.id].includes(food.foodId));
      expect(ours.map((food) => food.foodId)).toEqual([toast.id, oats.id]);
      expect(ours[1]?.snapshot).toMatchObject({ quantity: 60, unit: "g" });
    });

    it("should leave out a food that has been deleted", async () => {
      const recent = await listRecentFoods(userA.client);

      expect(recent.map((food) => food.foodId)).not.toContain(deletedFood.id);
    });

    it("should list nothing for user B", async () => {
      expect(await listRecentFoods(userB.client)).toEqual([]);
    });
  });
});
