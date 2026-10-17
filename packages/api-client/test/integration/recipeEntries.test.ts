import {
  buildLogEntry,
  buildQuickEntry,
  buildRecipeLogEntry,
  sumEntries,
} from "@keylow/core/diary";
import { SPOON_PORTIONS } from "@keylow/core/nutrition";
import { buildRecipeIngredient, computeRecipe } from "@keylow/core/recipes";
import { customFoodInputSchema, nutrientsSchema } from "@keylow/core/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { dayTotalsSchema } from "../../src/repos/diarySchemas";
import { restoreLogEntry, softDeleteLogEntry } from "../../src/repos/diaryWrites";
import { createFood } from "../../src/repos/foods";
import { logRecipe } from "../../src/repos/recipeEntries";
import { createRecipe, setRecipeArchived, updateRecipe } from "../../src/repos/recipeWrites";

import type { TestUser } from "./support/users";
import type { LogRecipeInput } from "../../src/repos/recipeEntries";
import type { RecipeDetail } from "../../src/repos/recipes";
import type { RecipeIngredient } from "@keylow/core/recipes";
import type { Food, FoodPortion } from "@keylow/core/schemas";

const RUN_ID = crypto.randomUUID();

// Every row this suite writes is named with this prefix, and the users are new for the run, so the
// rows another session left on the shared stack cannot change a result. Every read below is of an
// entry by id, a recipe by id, or a day of these users.
const NAME_PREFIX = `key291-${RUN_ID}`;

const nameOf = (name: string) => `${NAME_PREFIX}-${name}`;

type CustomFood = { food: Food; portions: FoodPortion[] };

const customFoodInput = (
  name: string,
  extra: { kcal?: number; density_g_per_ml?: number; portions?: unknown[] } = {},
) =>
  customFoodInputSchema.parse({
    name: nameOf(`food-${name}`),
    basis: "per_100g",
    kcal: extra.kcal ?? 300,
    protein_g: 10,
    fat_g: 10,
    carbs_g: 40,
    density_g_per_ml: extra.density_g_per_ml,
    portions: extra.portions ?? [],
  });

const tablespoon = SPOON_PORTIONS.find((portion) => portion.label === "1 tbsp");
if (tablespoon === undefined) {
  throw new Error("The spoon portions must include a tablespoon");
}

const onlyPortionOf = ({ portions }: CustomFood): FoodPortion => {
  const [portion] = portions;
  if (portion === undefined) {
    throw new Error("The food was made with a portion");
  }
  return portion;
};

const EXACT_FULL_FOOD = {
  kcal: 400,
  protein_g: 12.5,
  fat_g: 7.25,
  carbs_g: 50,
  fibre_g: 3.5,
  sat_fat_g: 2.5,
  sugars_g: 8.25,
  salt_g: 0.5,
};
const EXACT_PLAIN_FOOD = { kcal: 150.5, protein_g: 3, fat_g: 1.5, carbs_g: 30 };

const SERVINGS = 4;
const YIELD_GRAMS = 1100;
const DAY = "2026-11-03";

/** The instant of an entry on `DAY`, so the entries of a test sort in the order it logs them. */
const at = (time: string, day = DAY) => `${day}T${time}:00.000Z`;

describe("logging a recipe serving against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;
  let lentils: CustomFood;
  let rice: CustomFood;
  let flour: CustomFood;
  let eggs: CustomFood;
  let oil: CustomFood;
  let spinach: CustomFood;

  /** The six ingredients: three foods in grams, one in a natural portion, one in a spoon, one more in grams. */
  const sixIngredients = (lentilsGrams = 250): RecipeIngredient[] => [
    buildRecipeIngredient(lentils.food, { quantity: lentilsGrams, unit: "g" }),
    buildRecipeIngredient(rice.food, { quantity: 125.5, unit: "g" }),
    buildRecipeIngredient(flour.food, { quantity: 80, unit: "g" }),
    buildRecipeIngredient(eggs.food, {
      quantity: 3,
      unit: "portion",
      portion: onlyPortionOf(eggs),
    }),
    buildRecipeIngredient(oil.food, { quantity: 1.5, unit: "portion", portion: tablespoon }),
    buildRecipeIngredient(spinach.food, { quantity: 60, unit: "g" }),
  ];

  const stewSave = (name: string, lentilsGrams = 250) => ({
    name: nameOf(name),
    servings: SERVINGS,
    yieldGrams: YIELD_GRAMS,
    ingredients: sixIngredients(lentilsGrams),
    steps: ["Fry the onion.", "Add the lentils.", "Simmer for an hour.", "Serve."],
  });

  /** A recipe saved by KEY-289's write path, the way the app saves one. */
  const saveStew = (name: string) => createRecipe(userA.client, stewSave(name));

  const logOf = (
    recipe: RecipeDetail,
    amount: Pick<LogRecipeInput, "quantity" | "unit">,
    time: string,
    day = DAY,
  ): LogRecipeInput => ({ recipe, ...amount, loggedAt: at(time, day), localDate: day });

  /** The entry as the table holds it, every column, read straight from the table and not through the diary. */
  const rowOf = async (id: string) => {
    const { data, error } = await userA.client
      .from("food_log_entries")
      .select("*")
      .eq("id", id)
      .single();
    expect(error).toBeNull();
    return data;
  };

  /** The five columns that make an entry what it was when logged. */
  const frozenOf = (row: Awaited<ReturnType<typeof rowOf>>) => ({
    snapshot: row?.snapshot,
    nutrients: row?.nutrients,
    quantity: row?.quantity,
    unit: row?.unit,
    resolved_grams: row?.resolved_grams,
  });

  beforeAll(async () => {
    [userA, userB] = await Promise.all([createTestUser("key291"), createTestUser("key291")]);

    const make = (name: string, extra?: Parameters<typeof customFoodInput>[1]) =>
      createFood(userA.client, userA.id, customFoodInput(name, extra));
    lentils = await make("lentils", { kcal: 340 });
    rice = await make("rice", { kcal: 360 });
    flour = await make("flour", { kcal: 364 });
    eggs = await make("eggs", {
      kcal: 143,
      portions: [{ label: "1 egg", grams: 50, isDefault: true }],
    });
    oil = await make("oil", { kcal: 884, density_g_per_ml: 0.92 });
    spinach = await make("spinach", { kcal: 23 });
  });

  afterAll(async () => {
    // Deleting the users takes their foods, recipes and entries with them. The service role has no
    // grant on the recipe tables, so what is left is checked from outside, in the runbook.
    expect(await deleteCreatedTestUsers()).toHaveLength(2);
  });

  describe("a recipe of six ingredients logged by serving", () => {
    it("should store the nutrients core's computeRecipe gives per serving, exactly", async () => {
      const stew = await saveStew("Lentil stew");

      const logged = await logRecipe(
        userA.client,
        logOf(stew, { quantity: 1, unit: "serving" }, "12:00"),
      );

      const row = await rowOf(logged.id);
      const perServing = computeRecipe({
        servings: SERVINGS,
        yieldGrams: YIELD_GRAMS,
        ingredients: sixIngredients(),
      }).perServing;
      expect(row?.nutrients).toEqual(perServing);
      expect(perServing.kcal).toBeGreaterThan(0);
      expect(logged.nutrients).toEqual(perServing);
    });

    it("should store a recipe entry that names the recipe and no food, with the amount resolved to grams", async () => {
      const stew = await saveStew("Lentil stew, columns");

      const logged = await logRecipe(
        userA.client,
        logOf(stew, { quantity: 1, unit: "serving" }, "12:00"),
      );

      expect(await rowOf(logged.id)).toMatchObject({
        item_type: "recipe",
        recipe_id: stew.id,
        food_id: null,
        portion_id: null,
        quantity: 1,
        unit: "serving",
        resolved_grams: YIELD_GRAMS / SERVINGS,
        local_date: DAY,
        deleted_at: null,
        snapshot: { kind: "recipe", ref: stew.id, name: stew.name, servings: SERVINGS },
      });
    });
  });

  describe("an amount other than one serving", () => {
    it("should store what buildRecipeLogEntry gives for 275 g of cooked weight", async () => {
      const stew = await saveStew("Lentil stew, grams");
      const input = logOf(stew, { quantity: 275, unit: "g" }, "13:00");

      const logged = await logRecipe(userA.client, input);

      const row = await rowOf(logged.id);
      const expected = buildRecipeLogEntry(input);
      expect(row).toMatchObject({
        quantity: 275,
        unit: "g",
        resolved_grams: 275,
        nutrients: expected.nutrients,
        snapshot: expected.snapshot,
      });
    });

    it("should store what buildRecipeLogEntry gives for 1.5 servings", async () => {
      const stew = await saveStew("Lentil stew, one and a half");
      const input = logOf(stew, { quantity: 1.5, unit: "serving" }, "13:30");

      const logged = await logRecipe(userA.client, input);

      const row = await rowOf(logged.id);
      const expected = buildRecipeLogEntry(input);
      expect(row?.nutrients).toEqual(expected.nutrients);
      expect(row?.resolved_grams).toBe((1.5 * YIELD_GRAMS) / SERVINGS);
      // The same sum, written out here and not by the builder: the total, times the servings, over the recipe's servings.
      expect(row?.nutrients).toMatchObject({
        kcal: ((stew.computed.total.kcal ?? Number.NaN) * 1.5) / SERVINGS,
      });
    });
  });

  describe("changing the recipe after the entry was logged", () => {
    it("should leave the snapshot, nutrients and amount of the entry byte for byte as they were", async () => {
      const stew = await saveStew("Lentil stew, edited");
      const logged = await logRecipe(
        userA.client,
        logOf(stew, { quantity: 1.5, unit: "serving" }, "14:00"),
      );
      const before = await rowOf(logged.id);

      const edited = await updateRecipe(userA.client, {
        ...stewSave("Lentil stew, edited", 600),
        id: stew.id,
      });

      expect(edited.computed.total.kcal).not.toBe(stew.computed.total.kcal);
      expect(edited.computed).toEqual(
        computeRecipe({
          servings: SERVINGS,
          yieldGrams: YIELD_GRAMS,
          ingredients: sixIngredients(600),
        }),
      );
      const after = await rowOf(logged.id);
      expect(frozenOf(after)).toEqual(frozenOf(before));
      expect(JSON.stringify(frozenOf(after))).toBe(JSON.stringify(frozenOf(before)));
      expect(after).toEqual(before);
    });

    it("should leave the entry readable and unchanged when the recipe is archived", async () => {
      const stew = await saveStew("Lentil stew, archived");
      const logged = await logRecipe(
        userA.client,
        logOf(stew, { quantity: 275, unit: "g" }, "14:30"),
      );
      const before = await rowOf(logged.id);

      const archived = await setRecipeArchived(userA.client, stew.id, true);

      expect(archived.is_archived).toBe(true);
      expect(await rowOf(logged.id)).toEqual(before);
    });
  });

  describe("a day with a recipe entry in it", () => {
    const totalsDay = "2026-11-04";

    /** Every row of the day, soft deleted ones too, as core's `sumEntries` takes them. */
    const rowsOfDay = async () => {
      const { data, error } = await userA.client
        .from("food_log_entries")
        .select("nutrients, deleted_at")
        .eq("local_date", totalsDay);
      expect(error).toBeNull();
      return (data ?? []).map((row) => ({
        nutrients: nutrientsSchema.parse(row.nutrients),
        deleted_at: row.deleted_at,
      }));
    };

    const totalsOfDay = async () => {
      const { data, error } = await userA.client
        .from("day_totals")
        .select("*")
        .eq("local_date", totalsDay)
        .single();
      expect(error).toBeNull();
      const { local_date, entry_count, ...totals } = dayTotalsSchema.parse(data);
      return { local_date, entry_count, totals };
    };

    let byGrams: string;

    beforeAll(async () => {
      // The database adds the figures as exact decimals and core adds them as doubles, so the two agree
      // to the last digit only when every figure is exact in a double (halves and quarters, as in
      // dayTotals.test.ts). This recipe is made of such figures: 1,101 kcal in all, and a serving is a
      // quarter, a quarter of 1.5 servings is an eighth, and 275 g of 1,100 g is a quarter.
      const [fullFood, plainFood] = await Promise.all([
        createFood(
          userA.client,
          userA.id,
          customFoodInputSchema.parse({
            name: nameOf("food-exact-full"),
            basis: "per_100g",
            ...EXACT_FULL_FOOD,
            portions: [],
          }),
        ),
        createFood(
          userA.client,
          userA.id,
          customFoodInputSchema.parse({
            name: nameOf("food-exact-plain"),
            basis: "per_100g",
            ...EXACT_PLAIN_FOOD,
            portions: [],
          }),
        ),
      ]);
      const stew = await createRecipe(userA.client, {
        name: nameOf("Exact stew"),
        servings: SERVINGS,
        yieldGrams: YIELD_GRAMS,
        ingredients: [
          buildRecipeIngredient(fullFood.food, { quantity: 200, unit: "g" }),
          buildRecipeIngredient(plainFood.food, { quantity: 200, unit: "g" }),
        ],
        steps: ["Cook."],
      });
      const insertFood = await userA.client.from("food_log_entries").insert(
        buildLogEntry({
          food: lentils.food,
          quantity: 150,
          unit: "g",
          localDate: totalsDay,
          loggedAt: at("08:00", totalsDay),
        }),
      );
      const insertQuick = await userA.client.from("food_log_entries").insert(
        buildQuickEntry({
          localDate: totalsDay,
          loggedAt: at("10:00", totalsDay),
          kcal: 250,
          label: nameOf("quick"),
        }),
      );
      expect(insertFood.error).toBeNull();
      expect(insertQuick.error).toBeNull();
      await logRecipe(
        userA.client,
        logOf(stew, { quantity: 1.5, unit: "serving" }, "12:00", totalsDay),
      );
      byGrams = (
        await logRecipe(userA.client, logOf(stew, { quantity: 275, unit: "g" }, "13:00", totalsDay))
      ).id;
    });

    it("should total the day to the last digit as core's sumEntries does, the recipe entries included", async () => {
      const { local_date, entry_count, totals } = await totalsOfDay();

      expect(local_date).toBe(totalsDay);
      expect(entry_count).toBe(4);
      expect(totals).toEqual(sumEntries(await rowsOfDay()));
    });

    describe("the soft delete that an Undo uses", () => {
      it("should remove the recipe entry from the day, keep its row, and bring it back on restore", async () => {
        const before = await rowOf(byGrams);

        await softDeleteLogEntry(userA.client, byGrams);

        const deleted = await rowOf(byGrams);
        expect(deleted?.deleted_at).not.toBeNull();
        expect(frozenOf(deleted)).toEqual(frozenOf(before));
        const whileDeleted = await totalsOfDay();
        expect(whileDeleted.entry_count).toBe(3);
        expect(whileDeleted.totals).toEqual(sumEntries(await rowsOfDay()));

        await restoreLogEntry(userA.client, byGrams);

        expect(await rowOf(byGrams)).toEqual(before);
        const restored = await totalsOfDay();
        expect(restored.entry_count).toBe(4);
        expect(restored.totals).toEqual(sumEntries(await rowsOfDay()));
      });
    });
  });

  describe("a recipe the user cannot log", () => {
    const entriesOfRecipe = async (recipeId: string) => {
      const { data, error } = await userA.client
        .from("food_log_entries")
        .select("id")
        .eq("recipe_id", recipeId);
      expect(error).toBeNull();
      return data ?? [];
    };

    it("should refuse another user's recipe with the code 42501 and store nothing", async () => {
      const stew = await saveStew("Lentil stew, not for B");

      const failure = await logRecipe(
        userB.client,
        logOf(stew, { quantity: 1, unit: "serving" }, "12:00"),
      ).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(Error);
      expect(failure).toHaveProperty("message", "Could not log the recipe (42501)");
      expect(failure).toHaveProperty("cause", { code: "42501" });
      expect(await entriesOfRecipe(stew.id)).toEqual([]);
    });

    it("should refuse a recipe id the database has never seen with the same code", async () => {
      const stew = await saveStew("Lentil stew, never stored");

      const failure = await logRecipe(
        userA.client,
        logOf({ ...stew, id: crypto.randomUUID() }, { quantity: 1, unit: "serving" }, "12:00"),
      ).catch((error: unknown) => error);

      expect(failure).toHaveProperty("message", "Could not log the recipe (42501)");
      expect(await entriesOfRecipe(stew.id)).toEqual([]);
    });

    it("should write nothing for an amount that is not valid", async () => {
      const stew = await saveStew("Lentil stew, bad amount");

      const failure = await logRecipe(
        userA.client,
        logOf(stew, { quantity: -1, unit: "serving" }, "12:00"),
      ).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(RangeError);
      expect(await entriesOfRecipe(stew.id)).toEqual([]);
    });
  });
});
