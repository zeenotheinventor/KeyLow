import {
  buildLogEntry,
  buildQuickEntry,
  buildRecipeLogEntry,
  sumEntries,
} from "@keylow/core/diary";
import { buildRecipeIngredient } from "@keylow/core/recipes";
import { customFoodInputSchema, nutrientsSchema } from "@keylow/core/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { getDiaryDay, getDiaryWeek, getLogEntry, listRecentFoods } from "../../src/repos/diary";
import { copyDay, undoCopyDay } from "../../src/repos/diaryCopy";
import { dayTotalsSchema } from "../../src/repos/diarySchemas";
import { restoreLogEntry, softDeleteLogEntry, updateLogEntry } from "../../src/repos/diaryWrites";
import { createFood } from "../../src/repos/foods";
import { logRecipe } from "../../src/repos/recipeEntries";
import { createRecipe, setRecipeArchived, updateRecipe } from "../../src/repos/recipeWrites";

import type { TestUser } from "./support/users";
import type { LogEntry, RecipeLogEntry } from "../../src/repos/diarySchemas";
import type { RecipeDetail } from "../../src/repos/recipes";
import type { RecipeAmount } from "@keylow/core/diary";
import type { Food } from "@keylow/core/schemas";

const RUN_ID = crypto.randomUUID();

// Every row this suite writes is named with this prefix and belongs to a user made for the run, so the
// rows another session left on the shared stack cannot change a result. Every read below is of an entry
// by id or of a day of this user.
const NAME_PREFIX = `key300-${RUN_ID}`;
const nameOf = (name: string) => `${NAME_PREFIX}-${name}`;

const customFoodInput = (
  name: string,
  nutrition: {
    kcal: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
    fibre_g?: number;
  },
) =>
  customFoodInputSchema.parse({
    name: nameOf(`food-${name}`),
    basis: "per_100g",
    ...nutrition,
    portions: [],
  });

const SERVINGS = 4;
const YIELD_GRAMS = 1100;
const DAY = "2026-11-03";
const NEXT_DAY = "2026-11-04";

const at = (time: string, day = DAY) => `${day}T${time}:00.000Z`;

/** An entry the test knows is a recipe entry, narrowed by a check so a different kind fails the test loudly. */
function asRecipeEntry(entry: LogEntry | null): RecipeLogEntry {
  if (entry?.item_type !== "recipe") {
    throw new Error("The entry should be a recipe entry");
  }
  return entry;
}

describe("the diary reads, copies, edits and deletes a recipe entry against the local stack with real user JWTs", () => {
  let user: TestUser;
  let chicken: Food;
  let rice: Food;
  let oil: Food;

  /** The golden recipe in grams: 500 g chicken, 200 g rice and 20 g oil make 1,496.8 kcal. */
  const goldenSave = (name: string, chickenGrams = 500) => ({
    name: nameOf(name),
    servings: SERVINGS,
    yieldGrams: YIELD_GRAMS,
    ingredients: [
      buildRecipeIngredient(chicken, { quantity: chickenGrams, unit: "g" as const }),
      buildRecipeIngredient(rice, { quantity: 200, unit: "g" as const }),
      buildRecipeIngredient(oil, { quantity: 20, unit: "g" as const }),
    ],
    steps: ["Poach the chicken.", "Cook the rice.", "Serve."],
  });

  const saveGolden = (name: string) => createRecipe(user.client, goldenSave(name));

  const logGolden = (
    recipe: RecipeDetail,
    amount: RecipeAmount,
    time: string,
    day = DAY,
  ): Promise<RecipeLogEntry> =>
    logRecipe(user.client, { recipe, ...amount, loggedAt: at(time, day), localDate: day });

  /** The entry as the table holds it, every column, read straight from the table and not through the diary. */
  const rowOf = async (id: string) => {
    const { data, error } = await user.client
      .from("food_log_entries")
      .select("*")
      .eq("id", id)
      .single();
    expect(error).toBeNull();
    return data;
  };

  /** What makes an entry what it was when logged. */
  const frozenOf = (row: Awaited<ReturnType<typeof rowOf>>) => ({
    snapshot: row?.snapshot,
    nutrients: row?.nutrients,
    quantity: row?.quantity,
    unit: row?.unit,
    resolved_grams: row?.resolved_grams,
  });

  beforeAll(async () => {
    user = await createTestUser("key300");
    const make = async (
      name: string,
      nutrition: Parameters<typeof customFoodInput>[1],
    ): Promise<Food> =>
      (await createFood(user.client, user.id, customFoodInput(name, nutrition))).food;
    chicken = await make("chicken", { kcal: 120, protein_g: 22.5, fat_g: 2, carbs_g: 0 });
    rice = await make("rice", { kcal: 360, protein_g: 7, fat_g: 1, carbs_g: 78, fibre_g: 2 });
    oil = await make("oil", { kcal: 884, protein_g: 0, fat_g: 100, carbs_g: 0 });
  });

  afterAll(async () => {
    // Deleting the user takes its foods, recipes and entries with it.
    expect(await deleteCreatedTestUsers()).toHaveLength(1);
  });

  describe("a day with a food, a quick add and a recipe entry", () => {
    const readDay = "2026-11-10";
    let foodId: string;
    let quickId: string;
    let recipeEntryId: string;

    beforeAll(async () => {
      const stew = await saveGolden("Chicken and rice, day");
      // Saved out of timeline order on purpose, so the order read back is the database's.
      recipeEntryId = (await logGolden(stew, { quantity: 1, unit: "serving" }, "12:00", readDay))
        .id;
      const insertQuick = await user.client
        .from("food_log_entries")
        .insert(
          buildQuickEntry({
            localDate: readDay,
            loggedAt: at("15:00", readDay),
            kcal: 250,
            label: nameOf("quick"),
          }),
        )
        .select("id")
        .single();
      const insertFood = await user.client
        .from("food_log_entries")
        .insert(
          buildLogEntry({
            food: chicken,
            quantity: 150,
            unit: "g",
            localDate: readDay,
            loggedAt: at("08:00", readDay),
          }),
        )
        .select("id")
        .single();
      expect(insertQuick.error).toBeNull();
      expect(insertFood.error).toBeNull();
      quickId = insertQuick.data?.id ?? "";
      foodId = insertFood.data?.id ?? "";
    });

    it("should load all three in timeline order, each parsed as its own kind", async () => {
      const { entries, totals } = await getDiaryDay(user.client, readDay);

      expect(entries.map(({ id, item_type }) => [id, item_type])).toEqual([
        [foodId, "food"],
        [recipeEntryId, "recipe"],
        [quickId, "quick"],
      ]);
      expect(totals?.entry_count).toBe(3);
    });

    it("should return the recipe entry from getLogEntry, the same as the day does", async () => {
      const { entries } = await getDiaryDay(user.client, readDay);

      const entry = await getLogEntry(user.client, recipeEntryId);

      expect(asRecipeEntry(entry).recipe_id).toBe(asRecipeEntry(entry).snapshot.ref);
      expect(entry).toEqual(entries.find(({ id }) => id === recipeEntryId));
    });

    it("should count the recipe entry in the week strip, with the totals of the day", async () => {
      const { totals } = await getDiaryDay(user.client, readDay);
      const week = await getDiaryWeek(user.client, "2026-11-09");

      expect(week.find(({ localDate }) => localDate === readDay)?.totals).toEqual(totals);
    });

    it("should not list a recipe among the recent foods", async () => {
      const recent = await listRecentFoods(user.client);

      expect(recent.map(({ entryId }) => entryId)).toContain(foodId);
      expect(recent.map(({ entryId }) => entryId)).not.toContain(recipeEntryId);
    });
  });

  describe("editing the amount of a recipe entry", () => {
    it("should store 374.2 kcal for 1 serving, 561.3 for 1.5 servings and 408.2 for 300 g of the golden recipe", async () => {
      const stew = await saveGolden("Chicken and rice, amounts");
      const logged = await logGolden(stew, { quantity: 1, unit: "serving" }, "12:00");
      expect(logged.nutrients.kcal).toBeCloseTo(374.2, 1);

      for (const [amount, kcal] of [
        [{ quantity: 1.5, unit: "serving" }, 561.3],
        [{ quantity: 300, unit: "g" }, 408.2],
      ] as const) {
        const updated = asRecipeEntry(await updateLogEntry(user.client, { entry: logged, amount }));

        expect(updated.nutrients.kcal).toBeCloseTo(kcal, 1);
        const built = buildRecipeLogEntry({
          recipe: stew,
          ...amount,
          loggedAt: at("12:00"),
          localDate: DAY,
        });
        const row = await rowOf(logged.id);
        expect(row?.nutrients).toEqual(built.nutrients);
        expect(row?.snapshot).toEqual(built.snapshot);
        expect(row?.resolved_grams).toBe(built.resolved_grams);
        expect(row?.recipe_id).toBe(stew.id);
        expect(row?.item_type).toBe("recipe");
      }
    });

    it("should change the day when the time moves across midnight, and keep the new amount", async () => {
      const stew = await saveGolden("Chicken and rice, time");
      const logged = await logGolden(stew, { quantity: 1, unit: "serving" }, "23:30");

      const moved = await updateLogEntry(user.client, {
        entry: logged,
        amount: { quantity: 2, unit: "serving" },
        time: { loggedAt: at("00:15", NEXT_DAY), timeZone: "Europe/London" },
      });

      expect(moved.local_date).toBe(NEXT_DAY);
      expect(Date.parse(moved.logged_at)).toBe(Date.parse(at("00:15", NEXT_DAY)));
      expect(moved.quantity).toBe(2);
    });
  });

  describe("changing the recipe after the entry was logged", () => {
    it("should leave the entry's snapshot, nutrients and resolved grams byte for byte as they were, and an amount edit afterwards still comes from its own snapshot", async () => {
      const stew = await saveGolden("Chicken and rice, edited");
      const logged = await logGolden(stew, { quantity: 1, unit: "serving" }, "12:00");
      const before = await rowOf(logged.id);

      // The recipe loses most of its chicken and is then archived.
      const edited = await updateRecipe(user.client, {
        ...goldenSave("Chicken and rice, edited", 100),
        id: stew.id,
      });
      await setRecipeArchived(user.client, stew.id, true);

      expect(edited.computed.total.kcal).not.toBe(stew.computed.total.kcal);
      const after = await rowOf(logged.id);
      expect(JSON.stringify(frozenOf(after))).toBe(JSON.stringify(frozenOf(before)));
      expect(after).toEqual(before);

      const stored = asRecipeEntry(await getLogEntry(user.client, logged.id));
      const oneAndAHalf = asRecipeEntry(
        await updateLogEntry(user.client, {
          entry: stored,
          amount: { quantity: 1.5, unit: "serving" },
        }),
      );
      // 561.3 is the golden recipe as it was logged; the edited recipe would give a lower figure.
      expect(oneAndAHalf.nutrients.kcal).toBeCloseTo(561.3, 1);
      expect(oneAndAHalf.snapshot.total).toEqual(logged.snapshot.total);
      expect(oneAndAHalf.snapshot.name).toBe(logged.snapshot.name);
    });
  });

  describe("copying a day that holds a recipe entry", () => {
    it("should copy the recipe entry as a recipe entry, from its snapshot, after the recipe was edited and archived, and take back only the copy", async () => {
      const copyFrom = "2026-11-12";
      const copyTo = "2026-11-13";
      const stew = await saveGolden("Chicken and rice, copy");
      const original = await logGolden(stew, { quantity: 1.5, unit: "serving" }, "18:00", copyFrom);
      await updateRecipe(user.client, {
        ...goldenSave("Chicken and rice, copy", 100),
        id: stew.id,
      });
      await setRecipeArchived(user.client, stew.id, true);
      // Something already on the target day, which the Undo must leave alone.
      const existing = await user.client
        .from("food_log_entries")
        .insert(
          buildQuickEntry({
            localDate: copyTo,
            loggedAt: at("09:00", copyTo),
            kcal: 90,
            label: nameOf("copy-existing"),
          }),
        )
        .select("id")
        .single();
      expect(existing.error).toBeNull();

      const copied = await copyDay(user.client, {
        from: copyFrom,
        to: copyTo,
        timeZone: "Europe/London",
      });

      expect(copied).toMatchObject({ localDate: copyTo, count: 1 });
      const copy = await rowOf(copied.entryIds[0] ?? "");
      expect(copy).toMatchObject({
        item_type: "recipe",
        recipe_id: stew.id,
        local_date: copyTo,
        quantity: 1.5,
        unit: "serving",
        resolved_grams: original.resolved_grams,
        snapshot: original.snapshot,
        nutrients: original.nutrients,
      });
      expect(Date.parse(copy?.logged_at ?? "")).toBe(Date.parse(at("18:00", copyTo)));
      const onDay = await getDiaryDay(user.client, copyTo);
      expect(onDay.entries.map(({ item_type }) => item_type)).toEqual(["quick", "recipe"]);

      await undoCopyDay(user.client, copied);

      const afterUndo = await getDiaryDay(user.client, copyTo);
      expect(afterUndo.entries.map(({ id }) => id)).toEqual([existing.data?.id]);
      expect((await getDiaryDay(user.client, copyFrom)).entries.map(({ id }) => id)).toEqual([
        original.id,
      ]);
    });
  });

  describe("deleting a recipe entry and bringing it back", () => {
    it("should take it out of the day, keep the row, and restore it whole", async () => {
      const stew = await saveGolden("Chicken and rice, delete");
      const deleteDay = "2026-11-14";
      const logged = await logGolden(stew, { quantity: 1, unit: "serving" }, "12:00", deleteDay);
      const before = await rowOf(logged.id);

      await softDeleteLogEntry(user.client, logged.id);

      expect((await getDiaryDay(user.client, deleteDay)).entries).toEqual([]);
      expect(await getLogEntry(user.client, logged.id)).toBeNull();
      const deleted = await rowOf(logged.id);
      expect(deleted?.deleted_at).not.toBeNull();
      expect(frozenOf(deleted)).toEqual(frozenOf(before));

      await restoreLogEntry(user.client, logged.id);

      expect(await rowOf(logged.id)).toEqual(before);
      expect((await getDiaryDay(user.client, deleteDay)).entries).toEqual([logged]);
    });
  });

  describe("the totals of a day with a recipe entry", () => {
    const totalsDay = "2026-11-15";

    // The database adds the figures as exact decimals and core adds them as doubles, so the two agree to
    // the last digit only when every figure is exact in a double (halves and quarters, as in
    // dayTotals.test.ts). The recipe is 200 g of one food in four servings, so a serving is a quarter
    // of each figure, and 275 g of the 1,100 g it makes is a quarter as well.
    beforeAll(async () => {
      const { food: exactFood } = await createFood(
        user.client,
        user.id,
        customFoodInput("exact", {
          kcal: 400,
          protein_g: 12.5,
          fat_g: 7.25,
          carbs_g: 50,
          fibre_g: 3.5,
        }),
      );
      const stew = await createRecipe(user.client, {
        name: nameOf("Exact stew"),
        servings: SERVINGS,
        yieldGrams: YIELD_GRAMS,
        ingredients: [buildRecipeIngredient(exactFood, { quantity: 200, unit: "g" })],
        steps: ["Cook."],
      });
      const insertFood = await user.client.from("food_log_entries").insert(
        buildLogEntry({
          food: exactFood,
          quantity: 150,
          unit: "g",
          localDate: totalsDay,
          loggedAt: at("08:00", totalsDay),
        }),
      );
      const insertQuick = await user.client.from("food_log_entries").insert(
        buildQuickEntry({
          localDate: totalsDay,
          loggedAt: at("10:00", totalsDay),
          kcal: 250,
          label: nameOf("totals-quick"),
        }),
      );
      expect(insertFood.error).toBeNull();
      expect(insertQuick.error).toBeNull();
      await logGolden(stew, { quantity: 1, unit: "serving" }, "12:00", totalsDay);
      await logGolden(stew, { quantity: 275, unit: "g" }, "13:00", totalsDay);
      await logGolden(stew, { quantity: 0.5, unit: "serving" }, "14:00", totalsDay);
    });

    it("should total the day to the last digit as core's sumEntries does, the recipe entries included", async () => {
      const { data, error } = await user.client
        .from("food_log_entries")
        .select("nutrients, deleted_at")
        .eq("local_date", totalsDay);
      expect(error).toBeNull();
      const rows = (data ?? []).map((row) => ({
        nutrients: nutrientsSchema.parse(row.nutrients),
        deleted_at: row.deleted_at,
      }));
      const { totals } = await getDiaryDay(user.client, totalsDay);

      const { local_date, entry_count, ...figures } = dayTotalsSchema.parse(totals);

      expect(local_date).toBe(totalsDay);
      expect(entry_count).toBe(5);
      expect(figures).toEqual(sumEntries(rows));
    });
  });
});
