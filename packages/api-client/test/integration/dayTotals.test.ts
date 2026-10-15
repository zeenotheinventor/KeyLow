import { buildLogEntry, buildQuickEntry, sumEntries } from "@keylow/core/diary";
import { customFoodInputSchema, nutrientsSchema } from "@keylow/core/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { getDiaryDay } from "../../src/repos/diary";
import { createFood } from "../../src/repos/foods";

import type { TestUser } from "./support/users";
import type { Food } from "@keylow/core/schemas";

const RUN_ID = crypto.randomUUID();

// Every figure is a sum of halves and quarters at a quantity of 50, 100 or 200 g, so the numbers
// are exact in floating point and the two sums can be compared to the last digit.
const FULL_FOOD = {
  kcal: 400,
  protein_g: 12.5,
  fat_g: 7.25,
  carbs_g: 50,
  fibre_g: 3.5,
  sat_fat_g: 2.5,
  sugars_g: 8.25,
  salt_g: 0.5,
};
const PLAIN_FOOD = { kcal: 150.5, protein_g: 3, fat_g: 1.5, carbs_g: 30 };

const customFood = (name: string, nutrients: Record<string, number>) =>
  customFoodInputSchema.parse({
    name: `key200-${name}-${RUN_ID}`,
    basis: "per_100g",
    ...nutrients,
    portions: [],
  });

describe("day_totals against the sum core computes", () => {
  let user: TestUser;
  let full: Food;
  let plain: Food;

  const log = async (food: Food, localDate: string, time: string, quantity: number) => {
    const { error } = await user.client.from("food_log_entries").insert(
      buildLogEntry({
        food,
        quantity,
        unit: "g",
        localDate,
        loggedAt: `${localDate}T${time}:00+00:00`,
      }),
    );
    expect(error).toBeNull();
  };

  const logQuick = async (localDate: string, time: string, kcal: number) => {
    const { error } = await user.client.from("food_log_entries").insert(
      buildQuickEntry({
        localDate,
        loggedAt: `${localDate}T${time}:00+00:00`,
        kcal,
        label: "key200 quick",
      }),
    );
    expect(error).toBeNull();
  };

  const softDeleteEverythingAt = async (localDate: string, time: string) => {
    const { error } = await user.client
      .from("food_log_entries")
      .update({ deleted_at: new Date().toISOString() })
      .eq("local_date", localDate)
      .eq("logged_at", `${localDate}T${time}:00+00:00`);
    expect(error).toBeNull();
  };

  /** Every row of the day, soft deleted ones too, as core's `sumEntries` takes them. */
  const rowsOf = async (localDate: string) => {
    const { data, error } = await user.client
      .from("food_log_entries")
      .select("nutrients, deleted_at")
      .eq("local_date", localDate);
    expect(error).toBeNull();
    return (data ?? []).map((row) => ({
      nutrients: nutrientsSchema.parse(row.nutrients),
      deleted_at: row.deleted_at,
    }));
  };

  beforeAll(async () => {
    user = await createTestUser("key200");
    ({ food: full } = await createFood(user.client, user.id, customFood("full", FULL_FOOD)));
    ({ food: plain } = await createFood(user.client, user.id, customFood("plain", PLAIN_FOOD)));
  });

  afterAll(async () => {
    // The user's own rows (foods, entries, day logs) go with them (on delete cascade).
    expect(await deleteCreatedTestUsers()).toHaveLength(1);
  });

  describe("a day with a soft deleted entry and an entry with null optional nutrients", () => {
    const day = "2026-10-21";

    beforeAll(async () => {
      await log(full, day, "08:05", 100);
      await log(full, day, "12:40", 200);
      await log(plain, day, "13:00", 50);
      await logQuick(day, "15:20", 300);
      // The deleted row is a big one, so leaving it in the view's sum could not go unseen.
      await log(full, day, "19:30", 300);
      await softDeleteEverythingAt(day, "19:30");
    });

    it("should equal sumEntries of the same rows for every nutrient", async () => {
      const rows = await rowsOf(day);
      const { totals } = await getDiaryDay(user.client, day);

      const { local_date, entry_count, ...summed } = totals ?? {};
      expect(local_date).toBe(day);
      expect(entry_count).toBe(4);
      expect(summed).toEqual(sumEntries(rows));
    });

    it("should leave the soft deleted entry out of the total", async () => {
      const { totals } = await getDiaryDay(user.client, day);

      // 3 x 100 g of the full food would add 1,200 kcal if the deleted 300 g were in.
      expect(totals?.kcal).toBe(400 + 800 + 75.25 + 300);
    });

    it("should total an optional nutrient from the entries that give it", async () => {
      const { totals } = await getDiaryDay(user.client, day);

      // Only the full food has saturates: 2.5 g per 100 g, over 100 g and 200 g.
      expect(totals?.sat_fat_g).toBe(7.5);
      expect(totals?.fibre_g).toBe(10.5);
    });
  });

  describe("a day where no entry gives an optional nutrient", () => {
    const day = "2026-10-22";

    beforeAll(async () => {
      await log(plain, day, "08:05", 100);
      await logQuick(day, "10:00", 200);
    });

    it("should total it as null, not 0, in both sums", async () => {
      const rows = await rowsOf(day);
      const { totals } = await getDiaryDay(user.client, day);

      expect(totals?.sat_fat_g).toBeNull();
      expect(sumEntries(rows).sat_fat_g).toBeNull();
      const { local_date, entry_count, ...summed } = totals ?? {};
      expect(local_date).toBe(day);
      expect(entry_count).toBe(2);
      expect(summed).toEqual(sumEntries(rows));
    });
  });
});
