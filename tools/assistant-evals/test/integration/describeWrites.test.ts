import { getFood, getMyTargets, logFood, searchFoods, updateMyTargets } from "@keylow/api-client";
import { afterAll, describe, expect, inject, it } from "vitest";

import { adminClient } from "../../../../packages/db/test/integration/support/stack";
import { scratchDayOf } from "../../cases/writes.ts";
import { ASK_TARGETS, writeAskExtras } from "../../fixtures/askExtras.ts";
import {
  FOOD_ROUTES,
  FOOD_ROUTE_WORDS,
  SEEDED_FOODS,
  seededFood,
} from "../../fixtures/describeExtras.ts";
import { createCaseEnvironment } from "../../src/caseEnvironment.ts";
import { createFixtureUser } from "../../src/fixtureUser.ts";
import { createUndoTurn } from "../../src/undoTurn.ts";

import type { FixtureUser } from "../../src/fixtureUser.ts";

// These need the local stack with its seeds, and the Undo test needs the `assistant` function served as well.
// Every user is new for the run, named under key700-<run id> at keylow.test, and afterAll removes them.
const RUN_ID = crypto.randomUUID().slice(0, 8);

const created: FixtureUser[] = [];
const newUser = async (label: string) => {
  const user = await createFixtureUser(inject("stack"), {
    namePrefix: `key700-${RUN_ID}-${label}`,
  });
  created.push(user);
  return user;
};

afterAll(async () => {
  await Promise.all(created.map((user) => user.remove()));
});

describe("the seeded foods the describe and write sets expect", () => {
  it.each(SEEDED_FOODS.map(({ code }) => code))(
    "should be in the local database with the name and the portions of the fixture for %s",
    async (code) => {
      const client = adminClient();
      const { data: foods, error } = await client
        .from("foods")
        .select("id,name")
        .eq("source", "cofid")
        .eq("source_ref", code);
      expect(error).toBeNull();
      expect(foods).toHaveLength(1);

      const { data: portions } = await client
        .from("food_portions")
        .select("label,grams,is_default,position")
        .eq("food_id", foods?.[0]?.id ?? "")
        .is("owner_id", null)
        .order("position");

      const held = seededFood(code);
      expect(foods?.[0]?.name).toBe(held.name);
      expect(
        portions?.map(({ label, grams, is_default }) => ({
          label,
          grams: Number(grams),
          isDefault: is_default,
        })),
      ).toEqual(held.portions);
    },
  );
});

describe("the plain food search, which is all the assistant resolves foods with", () => {
  it.each(Object.entries(FOOD_ROUTES))(
    "should find one of the foods of the %s route in its first five results",
    async (route, codes) => {
      const user = await newUser("search");
      const words = FOOD_ROUTE_WORDS[route as keyof typeof FOOD_ROUTES];

      const hits = await searchFoods(user.client, words, 5);
      const { data } = await adminClient()
        .from("foods")
        .select("source_ref")
        .in(
          "id",
          hits.map(({ id }) => id),
        );
      const found = (data ?? []).map(({ source_ref }) => source_ref);

      expect(
        found.some((code) => codes.some((expected) => expected === code)),
        `"${words}" found ${found.join(", ")}`,
      ).toBe(true);
    },
  );
});

describe("the targets the write set puts back", () => {
  it("should change the targets, and then write the ask targets back", async () => {
    const user = await newUser("targets");
    await writeAskExtras(user);
    await updateMyTargets(user.client, user.id, {
      kcal: 2000,
      protein_g: 138,
      carbs_g: 231,
      fat_g: 77,
    });
    expect((await getMyTargets(user.client)).kcal).toBe(2000);

    await writeAskExtras(user);

    expect(await getMyTargets(user.client)).toMatchObject({
      kcal: ASK_TARGETS.kcal,
      protein_g: ASK_TARGETS.protein_g,
      carbs_g: ASK_TARGETS.carbs_g,
      fat_g: ASK_TARGETS.fat_g,
    });
  });
});

describe("Undo for a turn of the eval user", () => {
  it("should undo a real write once, then answer that it was already undone", async () => {
    const user = await newUser("undo");
    const admin = adminClient();
    const environment = createCaseEnvironment({
      client: admin,
      userId: user.id,
      undoTurn: createUndoTurn({ client: user.client }),
      restoreTargets: () => writeAskExtras(user),
    });
    // The write is the app's own repo call. The turn and its action row are what the function would have stored.
    const { data: banana } = await admin
      .from("foods")
      .select("id")
      .eq("source", "cofid")
      .eq("source_ref", FOOD_ROUTES.banana[0])
      .single();
    const food = await getFood(user.client, banana?.id ?? "");
    const day = scratchDayOf(user.anchorDate, 1);
    if (food === null) {
      throw new Error("The banana is not seeded");
    }
    const entry = await logFood(user.client, {
      food,
      quantity: 100,
      unit: "g",
      loggedAt: `${day}T09:00:00Z`,
      localDate: day,
    });
    const conversationId = await environment.seedConversation([
      { user: "Log a banana.", assistant: "Logged." },
    ]);
    const { data: turn } = await admin
      .from("assistant_turns")
      .select("id")
      .eq("conversation_id", conversationId)
      .single();
    const { data: stamped } = await admin
      .from("food_log_entries")
      .select("updated_at")
      .eq("id", entry.id)
      .single();
    const { error } = await admin.from("assistant_actions").insert({
      user_id: user.id,
      conversation_id: conversationId,
      turn_id: turn?.id ?? "",
      turn_seq: 1,
      tool: "log_entry",
      target_table: "food_log_entries",
      target_id: entry.id,
      target_updated_at: stamped?.updated_at ?? null,
    });
    expect(error).toBeNull();

    const first = await environment.undoTurn(turn?.id ?? "");
    const second = await environment.undoTurn(turn?.id ?? "");

    expect(first).toEqual(["undone"]);
    expect(second).toEqual(["already_undone"]);
    const { count } = await admin
      .from("food_log_entries")
      .select("*", { count: "exact", head: true })
      .eq("id", entry.id)
      .is("deleted_at", null);
    expect(count).toBe(0);
  });
});
