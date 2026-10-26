import { buildRecipeIngredient } from "@keylow/core/recipes";
import { customFoodInputSchema } from "@keylow/core/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { logEntries } from "../../src/repos/diaryWrites";
import { createFood } from "../../src/repos/foods";
import { createRecipe } from "../../src/repos/recipeWrites";

import type { TestUser } from "./support/users";
import type { LogEntriesItem } from "../../src/repos/diaryWrites";
import type { RecipeDetail } from "../../src/repos/recipes";
import type { Food, FoodPortion } from "@keylow/core/schemas";

const RUN_ID = crypto.randomUUID();

// Every food and recipe this suite writes is named with this prefix, and both users are new for the
// run, so the rows another session left on the shared stack cannot change a result. Every read below
// is of one of these users' own days.
const nameOf = (name: string) => `key712-${RUN_ID}-${name}`;

const customFoodInput = (name: string, kcal: number, portions: unknown[] = []) =>
  customFoodInputSchema.parse({
    name: nameOf(`food-${name}`),
    basis: "per_100g",
    kcal,
    protein_g: 10,
    fat_g: 5,
    carbs_g: 30,
    portions,
  });

const at = (day: string, time: string) => `${day}T${time}:00.000Z`;

describe("logging a plate in one write against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;
  let oats: Food;
  let bowlOfOats: FoodPortion;
  let lentils: Food;
  let stew: RecipeDetail;
  let foodOfUserB: Food;

  const foodItem = (day: string, time: string, food: Food, quantity: number): LogEntriesItem => ({
    kind: "food",
    input: { food, quantity, unit: "g", loggedAt: at(day, time), localDate: day },
  });

  const stewItem = (day: string, time: string): LogEntriesItem => ({
    kind: "recipe",
    input: {
      recipe: stew,
      quantity: 1,
      unit: "serving",
      loggedAt: at(day, time),
      localDate: day,
    },
  });

  /** Every row of the day as the table holds it, in the order the diary shows them. */
  const rowsOfDay = async (day: string) => {
    const { data, error } = await userA.client
      .from("food_log_entries")
      .select("id, item_type, food_id, recipe_id, portion_id, quantity, logged_at, created_at")
      .eq("local_date", day)
      .order("logged_at")
      .order("created_at")
      .order("id");
    expect(error).toBeNull();
    return data ?? [];
  };

  beforeAll(async () => {
    [userA, userB] = await Promise.all([createTestUser("key712"), createTestUser("key712")]);

    const oatsWithPortion = await createFood(
      userA.client,
      userA.id,
      customFoodInput("oats", 380, [{ label: "1 bowl", grams: 40, isDefault: true }]),
    );
    oats = oatsWithPortion.food;
    const [portion] = oatsWithPortion.portions;
    if (portion === undefined) {
      throw new Error("The oats were made with a portion");
    }
    bowlOfOats = portion;
    ({ food: lentils } = await createFood(userA.client, userA.id, customFoodInput("lentils", 340)));
    ({ food: foodOfUserB } = await createFood(
      userB.client,
      userB.id,
      customFoodInput("not-for-a", 100),
    ));
    stew = await createRecipe(userA.client, {
      name: nameOf("stew"),
      servings: 4,
      yieldGrams: 1100,
      ingredients: [buildRecipeIngredient(lentils, { quantity: 250, unit: "g" })],
      steps: ["Simmer."],
    });
  });

  afterAll(async () => {
    // The users' own rows (foods, recipes, entries) go with them (on delete cascade).
    expect(await deleteCreatedTestUsers()).toHaveLength(2);
  });

  describe("a food, a recipe serving and the same food again", () => {
    const day = "2026-11-10";

    it("should store all of them, in the order given, from one write", async () => {
      const stored = await logEntries(userA.client, [
        foodItem(day, "12:00", oats, 50),
        stewItem(day, "12:00"),
        foodItem(day, "12:00", oats, 80),
      ]);

      expect(stored.map(({ item_type }) => item_type)).toEqual(["food", "recipe", "food"]);
      const rows = await rowsOfDay(day);
      expect(rows.map(({ id }) => id)).toEqual(stored.map(({ id }) => id));
      expect(rows).toMatchObject([
        { item_type: "food", food_id: oats.id, quantity: 50 },
        { item_type: "recipe", recipe_id: stew.id, quantity: 1 },
        { item_type: "food", food_id: oats.id, quantity: 80 },
      ]);
    });

    it("should give every row the same created_at and a time i milliseconds after the one given", async () => {
      const otherDay = "2026-11-11";

      await logEntries(userA.client, [
        foodItem(otherDay, "09:30", oats, 50),
        foodItem(otherDay, "09:30", lentils, 60),
        stewItem(otherDay, "09:30"),
      ]);

      const rows = await rowsOfDay(otherDay);
      expect(new Set(rows.map(({ created_at }) => created_at)).size).toBe(1);
      expect(rows.map(({ logged_at }) => new Date(logged_at).toISOString())).toEqual([
        `${otherDay}T09:30:00.000Z`,
        `${otherDay}T09:30:00.001Z`,
        `${otherDay}T09:30:00.002Z`,
      ]);
    });
  });

  describe("a plate with a row the database refuses", () => {
    const day = "2026-11-12";

    it("should store none of the rows, with the refusal named by its code", async () => {
      const failure = await logEntries(userA.client, [
        foodItem(day, "12:00", oats, 50),
        stewItem(day, "12:00"),
        foodItem(day, "12:00", foodOfUserB, 30),
      ]).catch((error: unknown) => error);

      expect(failure).toHaveProperty("message", "Could not log the entries (42501)");
      expect(await rowsOfDay(day)).toEqual([]);
    });

    it("should store none of them when the refused row is the first", async () => {
      const failure = await logEntries(userA.client, [
        foodItem(day, "12:00", foodOfUserB, 30),
        foodItem(day, "12:00", oats, 50),
      ]).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(Error);
      expect(await rowsOfDay(day)).toEqual([]);
    });

    it("should send nothing for a plate with an invalid row", async () => {
      const failure = await logEntries(userA.client, [
        foodItem(day, "12:00", oats, 50),
        foodItem(day, "12:00", lentils, -1),
      ]).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(RangeError);
      expect(await rowsOfDay(day)).toEqual([]);
    });
  });

  describe("a portion deleted since the picker was opened", () => {
    const day = "2026-11-13";

    it("should store the whole plate, with no portion on the row that lost it only", async () => {
      const { error } = await userA.client.from("food_portions").delete().eq("id", bowlOfOats.id);
      expect(error).toBeNull();

      const stored = await logEntries(userA.client, [
        foodItem(day, "08:00", lentils, 60),
        {
          kind: "food",
          input: {
            food: oats,
            quantity: 2,
            unit: "portion",
            portion: bowlOfOats,
            loggedAt: at(day, "08:00"),
            localDate: day,
          },
        },
      ]);

      expect(stored).toHaveLength(2);
      expect(await rowsOfDay(day)).toMatchObject([
        { food_id: lentils.id, portion_id: null },
        { food_id: oats.id, portion_id: null, quantity: 2 },
      ]);
    });
  });
});
