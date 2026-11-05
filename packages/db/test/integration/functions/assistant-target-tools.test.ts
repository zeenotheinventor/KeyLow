import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { undoAssistantActions } from "../../../../api-client/src/repos/assistantConversations";
import { getMyProgramSummary } from "../../../../api-client/src/repos/program";
import { getMyTargets } from "../../../../api-client/src/repos/targets";
import { anthropicMock } from "../support/anthropicMock";
import { callAssistant, eventsOf, newAssistantUser, turnBody } from "../support/assistantClient";
import { requireServedFunction } from "../support/functionsLane";
import { adminClient } from "../support/stack";
import { deleteCreatedTestUsers } from "../support/users";

import type { ScriptedReply } from "../support/anthropicMock";
import type { TestUser } from "../support/users";
import type { AssistantStreamEvent } from "@keylow/core";

/*
 * The served path of the food and targets write tools (KEY-697): `create_custom_food` and `update_targets`
 * through the served `assistant` and `mcp` functions, with only the Messages API mocked. Alice has a
 * programme with a current targets row of 2,140 kcal, written the way `run-checkin` writes it. Bob has
 * nothing, and must see none of Alice's rows and cannot undo her actions. All the data is invented.
 *
 * Every name carries a run marker, so a read of another user's rows would show.
 */

const marker = `kl697${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
const toolUseId = () => `toolu_${crypto.randomUUID().replaceAll("-", "")}`;
const NEXT_CHECKIN_DATE = "2026-11-06";

const useTool = (name: string, input: unknown, text?: string): ScriptedReply => ({
  blocks: [
    ...(text === undefined ? [] : [{ type: "text" as const, text }]),
    { type: "tool_use", id: toolUseId(), name, input },
  ],
  stopReason: "tool_use",
});
const finish = (text: string): ScriptedReply => ({
  blocks: [{ type: "text", text }],
  stopReason: "end_turn",
});

const turnMarkers: string[] = [];

async function turn(
  user: TestUser,
  text: string,
  replies: ScriptedReply[],
  conversationId: string | null = null,
) {
  const turnMarker = `${marker}${crypto.randomUUID().replaceAll("-", "").slice(0, 6)}`;
  turnMarkers.push(turnMarker);
  await anthropicMock.script(turnMarker, replies);
  const response = await callAssistant("turn", {
    user,
    body: { ...turnBody(`${text} ${turnMarker}`), conversationId, localDate: "2026-11-03" },
  });
  const events = eventsOf(response);
  const first = events[0];
  return {
    events,
    turnMarker,
    turnId: first?.type === "turn" ? first.turnId : "",
    conversationId: first?.type === "turn" ? first.conversationId : "",
  };
}

const cardOf = (events: AssistantStreamEvent[]) => {
  const event = events.find((candidate) => candidate.type === "card");
  return event?.type === "card" ? event.card : undefined;
};

async function giveProgram(user: TestUser): Promise<string> {
  const { data, error } = await user.client
    .from("programs")
    .insert({
      goal: "lose",
      rate_pct_per_week: 0.5,
      protein_g_per_kg: 1.6,
      fat_fraction_of_remaining: 0.3,
      split_preset: "balanced",
      started_on: "2026-10-22",
      next_checkin_date: NEXT_CHECKIN_DATE,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  const programId = data?.id ?? "";
  const written = await adminClient().rpc("record_targets", {
    p_user_id: user.id,
    p_targets: {
      program_id: programId,
      effective_from: "2026-10-22",
      calories_kcal: 2140,
      protein_g: 126,
      fat_g: 73,
      carbs_g: 245,
      dow_calories_kcal: Array.from({ length: 7 }, () => 2140),
      basis: {
        source: "start",
        tdeeKcal: 2640,
        trendWeightKg: 78.65,
        bmrKcal: 1755,
        goal: "lose",
        ratePctPerWeek: 0.5,
        effectiveRatePctPerWeek: 0.49,
        proteinGPerKg: 1.6,
        fatFraction: 0.3,
        dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
        clamps: [],
      },
      engine_version: "keylow-engine-v1",
      params: {},
    },
    p_start_snapshot: {
      program_id: programId,
      as_of_date: "2026-10-22",
      mu_kcal: 2400,
      var_kcal2: 90000,
      measurement: null,
      trend_weight_kg: null,
      engine_version: "keylow-engine-v1",
      params: {},
    },
    p_next_checkin_date: NEXT_CHECKIN_DATE,
    p_checkin_weekday: 4,
  });
  expect(written.error).toBeNull();
  return programId;
}

const foodName = `${marker} protein bar`;
const proteinBar = {
  name: foodName,
  brand: null,
  per: "per_portion",
  portion_label: "1 bar",
  portion_grams: 60,
  kcal: 210,
  protein_g: 20,
  carbs_g: 19,
  fat_g: 6,
};
// "Set my calories to 2,000": only the calories, so the macros are scaled from the programme's 126, 245 and 73 g
// (KEY-824), to 118, 229 and 68 g.
const newTargets = { kcal: 2000, macros: null, current_kcal: 2140 };
const macrosNote =
  "Your macros will be adjusted proportionally: protein 118 g, carbs 229 g, fat 68 g.";

let alice: TestUser;
let bob: TestUser;
let programId = "";
let foodEvents: AssistantStreamEvent[];
let askEvents: AssistantStreamEvent[];
let changeEvents: AssistantStreamEvent[];
// What the person's targets and programme were when the asking turn had ended.
let askedTargets: Awaited<ReturnType<typeof getMyTargets>>;
let askedProgramId: string | undefined;

beforeAll(async () => {
  await requireServedFunction(inject("stack"), "assistant");
  await requireServedFunction(inject("stack"), "mcp");
  [alice, bob] = await Promise.all([
    newAssistantUser("assistant-target-tools"),
    newAssistantUser("assistant-target-tools"),
  ]);
  programId = await giveProgram(alice);

  foodEvents = (
    await turn(alice, "My protein bar, 210 kcal per bar", [
      useTool("create_custom_food", proteinBar),
      finish("Saved."),
    ])
  ).events;

  const asked = await turn(alice, "Set my calories to 2,000", [
    useTool("update_targets", newTargets, "Change your calorie target from 2,140 to 2,000 kcal?"),
  ]);
  askEvents = asked.events;
  askedTargets = await getMyTargets(alice.client);
  askedProgramId = (await getMyProgramSummary(alice.client)).program?.id;
  // The next turn repeats this one in its history, and the mock would find this marker first.
  await anthropicMock.forget(asked.turnMarker);
  const { data: askedTurn } = await adminClient()
    .from("assistant_turns")
    .select("pending_confirmation")
    .eq("id", asked.turnId)
    .single();
  const pending = askedTurn?.pending_confirmation;
  const confirmationId =
    typeof pending === "object" &&
    pending !== null &&
    "id" in pending &&
    typeof pending.id === "string"
      ? pending.id
      : "";
  changeEvents = (
    await turn(
      alice,
      "Change target",
      [
        useTool("update_targets", { ...newTargets, confirmation_id: confirmationId }),
        finish("Done."),
      ],
      asked.conversationId,
    )
  ).events;
}, 240_000);

afterAll(async () => {
  await Promise.all(turnMarkers.map((turnMarker) => anthropicMock.forget(turnMarker)));
  await deleteCreatedTestUsers();
});

const foodsOf = async (user: TestUser) =>
  (
    await user.client
      .from("foods")
      .select("id,name,source,owner_id,deleted_at")
      .eq("source", "user")
  ).data ?? [];

describe("a turn that calls create_custom_food", () => {
  it("streams the food-created card with the board's words and a link to the food", async () => {
    const [food] = (await foodsOf(alice)).filter((candidate) => candidate.name === foodName);

    expect(cardOf(foodEvents)).toMatchObject({
      kind: "food_created",
      title: `Added food ${foodName}`,
      sub: "Yours · 1 bar",
      rows: [{ name: "Per bar", amountText: "P 20 g · C 19 g · F 6 g", kcalText: "210 kcal" }],
      note: "Not logged yet. Say when you had it, or log it from search.",
      link: { label: "Open in your foods", target: { screen: "own_food", foodId: food?.id } },
      undo: "available",
    });
  });

  it("saves Alice's own food, shows it to nobody else and logs nothing", async () => {
    expect((await foodsOf(alice)).filter((food) => food.name === foodName)).toHaveLength(1);
    expect((await foodsOf(bob)).filter((food) => food.name === foodName)).toEqual([]);
    expect((await alice.client.from("food_log_entries").select("id")).data).toEqual([]);
  });

  it("records one action that holds the food's id and no words or numbers", async () => {
    const [food] = await foodsOf(alice);
    const { data, error } = await alice.client
      .from("assistant_actions")
      .select("*")
      .eq("tool", "create_custom_food");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]).toMatchObject({
      target_table: "foods",
      target_id: food?.id,
      target_ids: null,
      target_local_date: null,
      target_updated_at: null,
    });
    const written = JSON.stringify(data);
    for (const word of [marker, "protein", "210", "bar"]) {
      expect(written).not.toContain(word);
    }
  });
});

describe("a turn that asks to change the targets", () => {
  it("ends asking, with the board's buttons and the question followed by the line about the macros, and changes nothing", () => {
    expect(askEvents.find((event) => event.type === "confirm")).toMatchObject({
      type: "confirm",
      question: `Change your calorie target from 2,140 to 2,000 kcal?\n\n${macrosNote}`,
      confirmLabel: "Change target",
      cancelLabel: "Keep 2,140",
      tone: "primary",
    });
    expect(askEvents.at(-1)).toEqual({ type: "done", outcome: "confirm" });
    expect(askedTargets).toMatchObject({ source: "engine", kcal: 2140 });
    expect(askedProgramId).toBe(programId);
  });
});

describe("the turn that follows a yes", () => {
  it("streams the board's targets-changed card", () => {
    expect(cardOf(changeEvents)).toMatchObject({
      kind: "targets_changed",
      title: "Changed your calorie target to 2,000 kcal",
      sub: "Was 2,140 kcal from your programme",
      rows: [
        {
          name: "Macros adjusted proportionally",
          amountText: "P 118 g · C 229 g · F 68 g",
          kcalText: null,
        },
      ],
      undo: "available",
      undoneSub: "Put back 2,140 kcal and your programme",
    });
  });

  it("saves the targets with the scaled macros and ends the programme", async () => {
    expect(await getMyTargets(alice.client)).toMatchObject({
      source: "manual",
      kcal: 2000,
      protein_g: 118,
      carbs_g: 229,
      fat_g: 68,
    });
    expect((await getMyProgramSummary(alice.client)).program).toBeNull();
  });

  it("records one action that names the programme and holds no number", async () => {
    const { data } = await alice.client
      .from("assistant_actions")
      .select("*")
      .eq("tool", "update_targets");

    expect(data).toHaveLength(1);
    expect(data?.[0]).toMatchObject({
      target_table: "programs",
      target_id: programId,
      target_ids: null,
      target_local_date: null,
    });
    expect(data?.[0]?.target_updated_at).not.toBeNull();
    const written = JSON.stringify(data);
    for (const word of [
      "2000",
      "2140",
      "2,000",
      "2,140",
      "kcal",
      "118 g",
      "229 g",
      "68 g",
      "adjusted",
    ]) {
      expect(written).not.toContain(word);
    }
    expect((await bob.client.from("assistant_actions").select("id")).data).toEqual([]);
  });
});

describe("Undo", () => {
  it("removes the created food from Alice's foods, once", async () => {
    const actionId = cardOf(foodEvents)?.actionIds[0] ?? "";

    const first = await undoAssistantActions(alice.client, [actionId]);
    const second = await undoAssistantActions(alice.client, [actionId]);

    expect(first).toEqual([{ actionId, result: "undone" }]);
    expect(second).toEqual([{ actionId, result: "already_undone" }]);
    const [food] = (await foodsOf(alice)).filter((candidate) => candidate.name === foodName);
    expect(food?.deleted_at).not.toBeNull();
  });

  it("is not available to Bob for Alice's targets change", async () => {
    const actionId = cardOf(changeEvents)?.actionIds[0] ?? "";

    const result = await undoAssistantActions(bob.client, [actionId]);

    expect(result).toEqual([{ actionId, result: "not_found" }]);
    expect((await getMyProgramSummary(alice.client)).program).toBeNull();
  });

  it("puts the programme back with the same next check-in and the engine's 2,140 kcal and macros in force", async () => {
    const actionId = cardOf(changeEvents)?.actionIds[0] ?? "";

    const result = await undoAssistantActions(alice.client, [actionId]);

    expect(result).toEqual([{ actionId, result: "undone" }]);
    const summary = await getMyProgramSummary(alice.client);
    expect(summary.program).toMatchObject({ id: programId, nextCheckinDate: NEXT_CHECKIN_DATE });
    expect(await getMyTargets(alice.client)).toMatchObject({
      source: "engine",
      kcal: 2140,
      protein_g: 126,
      carbs_g: 245,
      fat_g: 73,
    });
  });
});
