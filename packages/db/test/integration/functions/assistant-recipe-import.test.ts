import { buildRecipeIngredient } from "@keylow/core/recipes";
import { customFoodInputSchema } from "@keylow/core/schemas";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createFood } from "../../../../api-client/src/repos/foods";
import { createRecipe, updateRecipe } from "../../../../api-client/src/repos/recipeWrites";
import { anthropicMock } from "../support/anthropicMock";
import { callAssistant, eventsOf, newAssistantUser, turnBody } from "../support/assistantClient";
import { requireServedFunction } from "../support/functionsLane";
import { deleteCreatedTestUsers } from "../support/users";

import type { ScriptedReply } from "../support/anthropicMock";
import type { TestUser } from "../support/users";
import type { AssistantStreamEvent } from "@keylow/core";

/*
 * The served path of `import_recipe_from_url` (KEY-698), through the served `assistant` and `mcp` functions
 * with only the Messages API mocked. A page cannot be served to the function from here: the fetch refuses
 * every private address, and the mock server is on the host, so the saved recipe of a real page is covered by
 * the tool's own tests with a fake page. What this proves on the real tables and the real functions:
 *
 * - A link the person did not write is refused before anything is fetched, and nothing is saved.
 * - A link to a private address is refused by the fetch, announced with the reading_recipe status first, and
 *   leaves no recipe and no action.
 * - The save path the import uses (`save_recipe` with `source_url`) stores the link on the user's own recipe,
 *   shows it to nobody else, and a later save without the link keeps it.
 */

const marker = `kl698${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
const toolUseId = () => `toolu_${crypto.randomUUID().replaceAll("-", "")}`;
const writtenLink = `https://example.com/${marker}`;
const otherLink = `https://example.com/${marker}-other`;
const privateLink = `http://127.0.0.1/${marker}`;

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
const turnMarkers: string[] = [];

async function turn(text: string, replies: ScriptedReply[]) {
  const turnMarker = `${marker}${crypto.randomUUID().replaceAll("-", "").slice(0, 6)}`;
  turnMarkers.push(turnMarker);
  await anthropicMock.script(turnMarker, replies);
  const response = await callAssistant("turn", {
    user: alice,
    body: { ...turnBody(`${text} ${turnMarker}`), localDate: "2026-11-03" },
  });
  return { events: eventsOf(response), turnMarker };
}

const toolResultsOf = async (turnMarker: string): Promise<string> =>
  JSON.stringify((await anthropicMock.requests(turnMarker)).at(-1)?.["messages"]);

const recipesOf = async (user: TestUser) =>
  (await user.client.from("recipes").select("id,name,source_url,is_archived")).data ?? [];
const actionsOf = async (user: TestUser) =>
  (await user.client.from("assistant_actions").select("tool")).data ?? [];

let refused: { events: AssistantStreamEvent[]; turnMarker: string };
let blocked: { events: AssistantStreamEvent[]; turnMarker: string };

beforeAll(async () => {
  await requireServedFunction(inject("stack"), "assistant");
  await requireServedFunction(inject("stack"), "mcp");
  [alice, bob] = await Promise.all([
    newAssistantUser("assistant-recipe-import"),
    newAssistantUser("assistant-recipe-import"),
  ]);

  refused = await turn(`Add this recipe: ${writtenLink}`, [
    useTool("import_recipe_from_url", { url: otherLink, servings: null }),
    finish("I could not import that."),
  ]);
  blocked = await turn(`Add this recipe: ${privateLink}`, [
    useTool("import_recipe_from_url", { url: privateLink, servings: null }),
    finish("I could not read that page."),
  ]);
}, 180_000);

afterAll(async () => {
  await Promise.all(turnMarkers.map((turnMarker) => anthropicMock.forget(turnMarker)));
  await deleteCreatedTestUsers();
});

describe("a turn that imports a link the person did not write", () => {
  it("answers url_not_in_message, saves nothing and records no action", async () => {
    expect(await toolResultsOf(refused.turnMarker)).toContain("url_not_in_message");
    expect(refused.events.some((event) => event.type === "card")).toBe(false);
    expect(refused.events.at(-1)).toEqual({ type: "done", outcome: "complete" });
    expect(await recipesOf(alice)).toEqual([]);
    expect(await actionsOf(alice)).toEqual([]);
  });
});

describe("a turn that imports a link to a private address", () => {
  it("announces the read, is refused by the fetch, and leaves no recipe and no action", async () => {
    expect(blocked.events).toContainEqual({
      type: "status",
      code: "reading_recipe",
      host: "127.0.0.1",
    });
    const results = await toolResultsOf(blocked.turnMarker);
    expect(results).toContain("page_unreadable");
    expect(results).toContain("blocked_address");
    expect(blocked.events.some((event) => event.type === "card")).toBe(false);
    expect(await recipesOf(alice)).toEqual([]);
    expect(await actionsOf(alice)).toEqual([]);
  });
});

describe("the save the import uses", () => {
  it("stores the page's link on the user's own recipe, shows it to nobody else, and a save without it keeps it", async () => {
    const { food } = await createFood(
      alice.client,
      alice.id,
      customFoodInputSchema.parse({
        name: `${marker} lentils`,
        basis: "per_100g",
        kcal: 116,
        protein_g: 9,
        fat_g: 0.4,
        carbs_g: 20,
        portions: [],
      }),
    );
    const ingredients = [buildRecipeIngredient(food, { quantity: 200, unit: "g" })];

    const saved = await createRecipe(alice.client, {
      name: `${marker} soup`,
      servings: 2,
      yieldGrams: null,
      ingredients,
      steps: ["Simmer."],
      sourceUrl: writtenLink,
    });

    expect((await recipesOf(alice)).map((recipe) => [recipe.id, recipe.source_url])).toEqual([
      [saved.id, writtenLink],
    ]);
    expect(await recipesOf(bob)).toEqual([]);

    await updateRecipe(alice.client, {
      id: saved.id,
      name: `${marker} soup`,
      servings: 3,
      yieldGrams: null,
      ingredients,
      steps: ["Simmer."],
    });

    expect((await recipesOf(alice)).map((recipe) => recipe.source_url)).toEqual([writtenLink]);
  });
});
