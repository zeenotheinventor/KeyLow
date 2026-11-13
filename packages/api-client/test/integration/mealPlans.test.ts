import { buildLogEntry, buildRecipeLogEntry } from "@keylow/core/diary";
import { buildRecipeIngredient } from "@keylow/core/recipes";
import { customFoodInputSchema } from "@keylow/core/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { createFood, updateFood } from "../../src/repos/foods";
import {
  setMealPlanRepeatLimit,
  getMealPlanRepeatLimit,
} from "../../src/repos/mealPlanRepeatLimit";
import {
  archiveMealPlan,
  confirmMealPlanDay,
  listMealPlans,
  replaceMealPlanDay,
  saveMealPlan,
} from "../../src/repos/mealPlans";
import { createRecipe } from "../../src/repos/recipeWrites";

import type { TestUser } from "./support/users";
import type { LogEntriesItem } from "../../src/repos/diaryWrites";
import type { SaveMealPlanInput } from "../../src/repos/mealPlans";
import type { RecipeDetail } from "../../src/repos/recipes";
import type { Food } from "@keylow/core/schemas";

const RUN_ID = crypto.randomUUID();

// Every food and recipe this suite writes is named with this prefix, and both users are new for the
// run, so the rows another session left on the shared stack cannot change a result.
const nameOf = (name: string) => `key1027-${RUN_ID}-${name}`;

const customFoodInput = (name: string, kcal: number) =>
  customFoodInputSchema.parse({
    name: nameOf(`food-${name}`),
    basis: "per_100g",
    kcal,
    protein_g: 10,
    fat_g: 5,
    carbs_g: 30,
    portions: [],
  });

const FIRST_DAY = "2026-12-14";
const SECOND_DAY = "2026-12-15";
const at = (day: string, time: string) => `${day}T${time}:00.000Z`;

describe("meal plans against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;
  let oats: Food;
  let stew: RecipeDetail;
  let planId: string;
  let firstDayId: string;
  let secondDayId: string;

  const planOf = (): SaveMealPlanInput => ({
    startDate: FIRST_DAY,
    source: "assistant",
    rules: { maxRepeats: 2, leftovers: true, slots: ["morning", "midday"] },
    days: [
      { localDate: FIRST_DAY, target: { kcal: 1800 } },
      { localDate: SECOND_DAY, target: { kcal: 1800 } },
    ],
    items: [
      {
        localDate: FIRST_DAY,
        position: 0,
        slotTime: "08:00",
        kind: "food",
        foodId: oats.id,
        grams: 50,
        portionId: null,
        nutrients: { kcal: 190 },
        snapshot: { name: oats.name },
      },
      {
        localDate: FIRST_DAY,
        position: 1,
        slotTime: "12:30",
        kind: "recipe",
        recipeId: stew.id,
        servings: 1,
        nutrients: { kcal: 212 },
        snapshot: { name: stew.name },
      },
      {
        localDate: SECOND_DAY,
        position: 0,
        slotTime: "12:30",
        kind: "recipe",
        recipeId: stew.id,
        servings: 1,
        nutrients: { kcal: 212 },
        snapshot: { name: stew.name },
        leftoverOf: { localDate: FIRST_DAY, position: 1 },
      },
    ],
  });

  const foodItem = (food: Food, grams: number): LogEntriesItem => ({
    kind: "food",
    input: {
      food,
      quantity: grams,
      unit: "g",
      loggedAt: at(FIRST_DAY, "08:00"),
      localDate: FIRST_DAY,
    },
  });

  const stewItem = (): LogEntriesItem => ({
    kind: "recipe",
    input: {
      recipe: stew,
      quantity: 1,
      unit: "serving",
      loggedAt: at(FIRST_DAY, "12:30"),
      localDate: FIRST_DAY,
    },
  });

  /** Every live row of the day as the diary table holds it, in the order the diary shows them. */
  const entriesOfDay = async (day: string) => {
    const { data, error } = await userA.client
      .from("food_log_entries")
      .select(
        "id, item_type, food_id, recipe_id, quantity, resolved_grams, logged_at, snapshot, nutrients, kcal",
      )
      .eq("local_date", day)
      .is("deleted_at", null)
      .order("logged_at")
      .order("id");
    expect(error).toBeNull();
    return data ?? [];
  };

  beforeAll(async () => {
    [userA, userB] = await Promise.all([createTestUser("key1027"), createTestUser("key1027")]);
    ({ food: oats } = await createFood(userA.client, userA.id, customFoodInput("oats", 380)));
    const { food: lentils } = await createFood(
      userA.client,
      userA.id,
      customFoodInput("lentils", 340),
    );
    stew = await createRecipe(userA.client, {
      name: nameOf("stew"),
      servings: 4,
      yieldGrams: 1100,
      ingredients: [buildRecipeIngredient(lentils, { quantity: 250, unit: "g" })],
      steps: ["Simmer."],
    });
  });

  afterAll(async () => {
    // The users' own rows (foods, recipes, plans, entries) go with them (on delete cascade).
    expect(await deleteCreatedTestUsers()).toHaveLength(2);
  });

  it("should save a plan with its days, its items and the link from a leftover to the item that cooked it", async () => {
    planId = await saveMealPlan(userA.client, planOf());

    const plans = await listMealPlans(userA.client);
    expect(plans).toHaveLength(1);
    const [plan] = plans;
    expect(plan).toMatchObject({
      id: planId,
      startDate: FIRST_DAY,
      dayCount: 2,
      source: "assistant",
      archivedAt: null,
      rules: { maxRepeats: 2, leftovers: true, slots: ["morning", "midday"] },
    });
    expect(plan?.days.map(({ localDate }) => localDate)).toEqual([FIRST_DAY, SECOND_DAY]);
    const [first, second] = plan?.days ?? [];
    firstDayId = first?.id ?? "";
    secondDayId = second?.id ?? "";
    expect(first?.items.map(({ kind, position }) => `${kind}:${position}`)).toEqual([
      "food:0",
      "recipe:1",
    ]);
    const cooking = first?.items[1];
    expect(second?.items[0]?.leftoverOf).toBe(cooking?.id);
    expect(second?.confirmedAt).toBeNull();
  });

  it("should write nothing when one item is refused, so a plan is all or nothing", async () => {
    const { food: foodOfUserB } = await createFood(
      userB.client,
      userB.id,
      customFoodInput("not-for-a", 100),
    );
    const input = planOf();
    input.items.push({
      localDate: SECOND_DAY,
      position: 5,
      slotTime: null,
      kind: "food",
      foodId: foodOfUserB.id,
      grams: 10,
      portionId: null,
      nutrients: {},
      snapshot: {},
    });

    const error = await saveMealPlan(userA.client, input).then(
      () => new Error("saved"),
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(Error);
    expect(error instanceof Error ? error.cause : null).toStrictEqual({ code: "42501" });
    expect(await listMealPlans(userA.client)).toHaveLength(1);
  });

  it("should replace the items of an unconfirmed day", async () => {
    await replaceMealPlanDay(userA.client, secondDayId, [
      {
        position: 0,
        slotTime: "09:00",
        kind: "food",
        foodId: oats.id,
        grams: 40,
        portionId: null,
        nutrients: { kcal: 152 },
        snapshot: { name: oats.name },
      },
    ]);

    const [plan] = await listMealPlans(userA.client);
    const second = plan?.days.find(({ id }) => id === secondDayId);
    expect(second?.items).toHaveLength(1);
    expect(second?.items[0]).toMatchObject({ kind: "food", grams: 40, leftoverOf: null });
  });

  it("should write the diary entries with fresh snapshots when a day is confirmed, and keep the plan's own frozen figures", async () => {
    // The oats are edited after the plan was made: the plan item keeps the name it was planned with,
    // and the confirmation logs the food as it is now.
    const editedName = nameOf("food-oats-edited");
    const edited = await updateFood(userA.client, oats.id, {
      ...customFoodInput("oats", 400),
      name: editedName,
    });

    const ids = await confirmMealPlanDay(userA.client, firstDayId, [
      foodItem(edited, 50),
      stewItem(),
    ]);

    expect(ids).toHaveLength(2);
    const entries = await entriesOfDay(FIRST_DAY);
    expect(entries.map(({ id }) => id)).toEqual(ids);
    const expectedFood = buildLogEntry({
      food: edited,
      quantity: 50,
      unit: "g",
      loggedAt: at(FIRST_DAY, "08:00"),
      localDate: FIRST_DAY,
    });
    const expectedRecipe = buildRecipeLogEntry({
      recipe: stew,
      quantity: 1,
      unit: "serving",
      loggedAt: at(FIRST_DAY, "12:30"),
      localDate: FIRST_DAY,
    });
    expect(entries).toMatchObject([
      {
        item_type: "food",
        food_id: oats.id,
        quantity: 50,
        resolved_grams: expectedFood.resolved_grams,
        snapshot: expectedFood.snapshot,
        nutrients: expectedFood.nutrients,
        kcal: 200,
      },
      {
        item_type: "recipe",
        recipe_id: stew.id,
        quantity: 1,
        resolved_grams: expectedRecipe.resolved_grams,
        snapshot: expectedRecipe.snapshot,
        nutrients: expectedRecipe.nutrients,
      },
    ]);
    expect(entries[0]?.snapshot).toMatchObject({ name: editedName });

    const [plan] = await listMealPlans(userA.client);
    const first = plan?.days.find(({ id }) => id === firstDayId);
    expect(first?.confirmedEntryIds).toEqual(ids);
    expect(first?.confirmedAt).not.toBeNull();
    expect(first?.items[0]?.snapshot).toMatchObject({ name: oats.name });
    expect(first?.items[0]?.nutrients).toStrictEqual({ kcal: 190 });
  });

  it("should refuse to confirm or replace a confirmed day, and write nothing more", async () => {
    const entriesBefore = await entriesOfDay(FIRST_DAY);

    const again = await confirmMealPlanDay(userA.client, firstDayId, [stewItem()]).catch(
      (error: unknown) => error,
    );
    const replace = await replaceMealPlanDay(userA.client, firstDayId, []).catch(
      (error: unknown) => error,
    );

    expect(again).toBeInstanceOf(Error);
    expect(again instanceof Error ? again.cause : null).toStrictEqual({ code: "22023" });
    expect(replace).toBeInstanceOf(Error);
    expect(replace instanceof Error ? replace.cause : null).toStrictEqual({ code: "22023" });
    expect(await entriesOfDay(FIRST_DAY)).toEqual(entriesBefore);
    const [plan] = await listMealPlans(userA.client);
    expect(plan?.days.find(({ id }) => id === firstDayId)?.items).toHaveLength(2);
  });

  it("should show another user none of the plan and let them change none of it", async () => {
    expect(await listMealPlans(userB.client)).toEqual([]);

    const confirm = await confirmMealPlanDay(userB.client, secondDayId, [stewItem()]).catch(
      (error: unknown) => error,
    );
    const archive = await archiveMealPlan(userB.client, planId).catch((error: unknown) => error);

    expect(confirm instanceof Error ? confirm.cause : null).toStrictEqual({ code: "22023" });
    expect(archive).toEqual(new Error("Could not remove your meal plan: no plan was changed"));
    const [plan] = await listMealPlans(userA.client);
    expect(plan?.archivedAt).toBeNull();
    expect(plan?.days.find(({ id }) => id === secondDayId)?.confirmedAt).toBeNull();
  });

  it("should archive a plan, which leaves it out of the live plans", async () => {
    await archiveMealPlan(userA.client, planId);

    expect(await listMealPlans(userA.client)).toEqual([]);
  });

  it("should keep the repeat limit the person chose, 0 for no limit, and go back to not chosen", async () => {
    expect(await getMealPlanRepeatLimit(userA.client)).toBeNull();

    await setMealPlanRepeatLimit(userA.client, userA.id, 0);
    expect(await getMealPlanRepeatLimit(userA.client)).toBe(0);

    await setMealPlanRepeatLimit(userA.client, userA.id, 7);
    expect(await getMealPlanRepeatLimit(userA.client)).toBe(7);
    expect(await getMealPlanRepeatLimit(userB.client)).toBeNull();

    await setMealPlanRepeatLimit(userA.client, userA.id, null);
    expect(await getMealPlanRepeatLimit(userA.client)).toBeNull();
  });

  it("should not let a person write another person's repeat limit", async () => {
    const error = await setMealPlanRepeatLimit(userB.client, userA.id, 4).catch(
      (thrown: unknown) => thrown,
    );

    expect(error).toEqual(new Error("Could not save your repeat limit: no profile was changed"));
    expect(await getMealPlanRepeatLimit(userA.client)).toBeNull();
  });
});
