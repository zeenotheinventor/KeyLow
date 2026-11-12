import { buildRecipeIngredient } from "@keylow/core/recipes";
import { customFoodInputSchema } from "@keylow/core/schemas";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { undoAssistantActions } from "../../../../api-client/src/repos/assistantConversations";
import { createFood } from "../../../../api-client/src/repos/foods";
import { createRecipe, setRecipeArchived } from "../../../../api-client/src/repos/recipeWrites";
import { anthropicMock } from "../support/anthropicMock";
import { callAssistant, eventsOf, newAssistantUser, turnBody } from "../support/assistantClient";
import { requireServedFunction } from "../support/functionsLane";
import { deleteCreatedTestUsers } from "../support/users";
import { withoutIdsAndDates } from "../support/withoutIdsAndDates";

import type { ScriptedReply } from "../support/anthropicMock";
import type { TestUser } from "../support/users";
import type { AssistantStreamEvent } from "@keylow/core";

/*
 * The served path of the recipe write tools (KEY-694): `create_recipe` and `archive_recipe` through the
 * served `assistant` and `mcp` functions, with only the Messages API mocked. Two users, each with foods the
 * test writes: Alice makes a recipe and asks to archive it, and also asks to archive Bob's, which she cannot
 * see. Bob's recipe is written with his own JWT and must stay as he left it.
 *
 * Every name carries a run marker, so a read of another user's rows would show. The foods are the board's
 * Chicken and rice, so the card must read 550 kcal, P 37 g, C 79 g and F 8.6 g a serving. The names are
 * invented.
 */

const marker = `kl694${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
const toolUseId = () => `toolu_${crypto.randomUUID().replaceAll("-", "")}`;
const sourceUrl = `https://example.com/${marker}`;

type Foods = { chickenId: string; riceId: string; oilId: string; tablespoonId: string };

async function createFoods(user: TestUser): Promise<Foods> {
  const made = async (name: string, nutrients: object, portions: object[] = []) => {
    const { food, portions: saved } = await createFood(
      user.client,
      user.id,
      customFoodInputSchema.parse({
        name: `${marker} ${name}`,
        basis: "per_100g",
        ...nutrients,
        portions,
      }),
    );
    return { food, portions: saved };
  };
  const chicken = await made("chicken", { kcal: 106, protein_g: 22.6, fat_g: 1, carbs_g: 0 });
  const rice = await made("rice", { kcal: 357, protein_g: 8.8, fat_g: 0.6, carbs_g: 78.9 });
  const oil = await made("oil", { kcal: 900, protein_g: 0, fat_g: 100, carbs_g: 0 }, [
    { label: "tbsp", grams: 13.5, isDefault: true },
  ]);
  return {
    chickenId: chicken.food.id,
    riceId: rice.food.id,
    oilId: oil.food.id,
    tablespoonId: oil.portions[0]?.id ?? "",
  };
}

async function turn(user: TestUser, text: string, replies: ScriptedReply[]) {
  const turnMarker = `${marker}${crypto.randomUUID().replaceAll("-", "").slice(0, 6)}`;
  await anthropicMock.script(turnMarker, replies);
  const response = await callAssistant("turn", {
    user,
    body: { ...turnBody(`${text} ${turnMarker}`), localDate: "2026-11-03" },
  });
  return { events: eventsOf(response), turnMarker };
}

const useTool = (name: string, input: unknown): ScriptedReply => ({
  blocks: [{ type: "tool_use", id: toolUseId(), name, input }],
  stopReason: "tool_use",
});
const finish = (text: string): ScriptedReply => ({
  blocks: [{ type: "text", text }],
  stopReason: "end_turn",
});

let alice: TestUser;
let bob: TestUser;
let aliceFoods: Foods;
let bobsRecipeId = "";
let createEvents: AssistantStreamEvent[];
let bobEvents: AssistantStreamEvent[];
let askEvents: AssistantStreamEvent[];
const turnMarkers: string[] = [];
const recipeName = `${marker} Chicken and rice`;

beforeAll(async () => {
  await requireServedFunction(inject("stack"), "assistant");
  await requireServedFunction(inject("stack"), "mcp");
  [alice, bob] = await Promise.all([
    newAssistantUser("assistant-recipe-tools"),
    newAssistantUser("assistant-recipe-tools"),
  ]);
  aliceFoods = await createFoods(alice);
  const { food } = await createFood(
    bob.client,
    bob.id,
    customFoodInputSchema.parse({
      name: `${marker} bob lentils`,
      basis: "per_100g",
      kcal: 116,
      protein_g: 9,
      fat_g: 0.4,
      carbs_g: 20,
      portions: [],
    }),
  );
  const bobsRecipe = await createRecipe(bob.client, {
    name: `${marker} Bob's dal`,
    servings: 2,
    yieldGrams: null,
    ingredients: [buildRecipeIngredient(food, { quantity: 200, unit: "g" })],
    steps: [],
  });
  bobsRecipeId = bobsRecipe.id;

  const created = await turn(alice, "Make a recipe called Chicken and rice", [
    useTool("create_recipe", {
      name: recipeName,
      servings: 4,
      ingredients: [
        { food_id: aliceFoods.chickenId, unit: "g", amount: 500, portion_id: null },
        { food_id: aliceFoods.riceId, unit: "g", amount: 400, portion_id: null },
        {
          food_id: aliceFoods.oilId,
          unit: "portion",
          amount: 2,
          portion_id: aliceFoods.tablespoonId,
        },
      ],
      steps: ["Cook the rice.", "Fry the chicken."],
      source_url: sourceUrl,
    }),
    finish("Saved."),
  ]);
  createEvents = created.events;
  turnMarkers.push(created.turnMarker);

  const bobs = await turn(alice, "Archive Bob's dal", [
    useTool("archive_recipe", { id: bobsRecipeId }),
    finish("I could not find that recipe."),
  ]);
  bobEvents = bobs.events;
  turnMarkers.push(bobs.turnMarker);
}, 180_000);

afterAll(async () => {
  await Promise.all(turnMarkers.map((turnMarker) => anthropicMock.forget(turnMarker)));
  await deleteCreatedTestUsers();
});

const recipesOf = async (user: TestUser) =>
  (await user.client.from("recipes").select("id,name,is_archived,source_url,servings")).data ?? [];

describe("a turn that calls create_recipe", () => {
  it("streams the recipe-created card with the board's numbers and a link into the recipe editor", async () => {
    const card = createEvents.find((event) => event.type === "card");
    const [recipe] = await recipesOf(alice);

    expect(card?.type === "card" && card.card).toMatchObject({
      kind: "recipe_created",
      title: `Added recipe ${recipeName}, 4 servings`,
      sub: "Per serving 550 kcal · P 37 g · C 79 g · F 8.6 g",
      link: {
        label: "Open in recipe editor",
        target: { screen: "recipe_editor", recipeId: recipe?.id },
      },
      undo: "available",
      undoneSub: `Archived ${recipeName}`,
    });
    expect(createEvents.at(-1)).toEqual({ type: "done", outcome: "complete" });
  });

  it("saves the recipe as Alice's, with her link, and shows it to nobody else", async () => {
    const mine = await recipesOf(alice);
    const theirs = await recipesOf(bob);

    expect(mine).toEqual([
      expect.objectContaining({
        name: recipeName,
        servings: 4,
        is_archived: false,
        source_url: sourceUrl,
      }),
    ]);
    expect(theirs.map((recipe) => recipe.name)).toEqual([`${marker} Bob's dal`]);
  });

  it("records one action that holds the recipe's id and no words or numbers", async () => {
    const [recipe] = await recipesOf(alice);
    const { data, error } = await alice.client
      .from("assistant_actions")
      .select("*")
      .eq("tool", "create_recipe");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]).toMatchObject({
      target_table: "recipes",
      target_id: recipe?.id,
      target_ids: null,
      target_local_date: null,
      target_updated_at: null,
      turn_seq: 1,
    });
    const written = withoutIdsAndDates(data);
    for (const word of [marker, "Chicken", "kcal", "550", sourceUrl]) {
      expect(written).not.toContain(word);
    }
    expect((await bob.client.from("assistant_actions").select("id")).data).toEqual([]);
  });
});

describe("a turn that asks to archive another user's recipe", () => {
  it("does not ask, archives nothing and leaves no action", async () => {
    expect(bobEvents.some((event) => event.type === "confirm")).toBe(false);
    expect(bobEvents.at(-1)).toEqual({ type: "done", outcome: "complete" });
    expect((await recipesOf(bob)).map((recipe) => recipe.is_archived)).toEqual([false]);
    const actions = await alice.client
      .from("assistant_actions")
      .select("tool")
      .eq("tool", "archive_recipe");
    expect(actions.data).toEqual([]);
  });
});

describe("a turn that asks to archive the user's own recipe", () => {
  beforeAll(async () => {
    const [recipe] = await recipesOf(alice);
    const asked = await turn(alice, "Archive the chicken and rice recipe", [
      {
        blocks: [
          { type: "text", text: `Archive ${recipeName}? It leaves your recipe list.` },
          { type: "tool_use", id: toolUseId(), name: "archive_recipe", input: { id: recipe?.id } },
        ],
        stopReason: "tool_use",
      },
    ]);
    askEvents = asked.events;
    turnMarkers.push(asked.turnMarker);
  }, 60_000);

  it("ends asking, with the board's buttons, and archives nothing", async () => {
    const confirm = askEvents.find((event) => event.type === "confirm");

    expect(confirm).toMatchObject({
      type: "confirm",
      confirmLabel: "Archive recipe",
      cancelLabel: "Keep it",
      tone: "primary",
    });
    expect(askEvents.at(-1)).toEqual({ type: "done", outcome: "confirm" });
    expect((await recipesOf(alice)).map((recipe) => recipe.is_archived)).toEqual([false]);
  });
});

describe("Undo of a created recipe", () => {
  it("archives it, answers already_undone the second time, and cannot archive Bob's recipe", async () => {
    const card = createEvents.find((event) => event.type === "card");
    const actionId = card?.type === "card" ? (card.card.actionIds[0] ?? "") : "";

    const first = await undoAssistantActions(alice.client, [actionId]);
    const second = await undoAssistantActions(alice.client, [actionId]);

    expect(first).toEqual([{ actionId, result: "undone" }]);
    expect(second).toEqual([{ actionId, result: "already_undone" }]);
    expect((await recipesOf(alice)).map((recipe) => recipe.is_archived)).toEqual([true]);
    expect((await recipesOf(bob)).map((recipe) => recipe.is_archived)).toEqual([false]);
  });

  it("is refused for a user's own archive of someone else's recipe at the database", async () => {
    await expect(setRecipeArchived(alice.client, bobsRecipeId, true)).rejects.toMatchObject({
      cause: { code: "PGRST116" },
    });
    expect((await recipesOf(bob)).map((recipe) => recipe.is_archived)).toEqual([false]);
  });
});
