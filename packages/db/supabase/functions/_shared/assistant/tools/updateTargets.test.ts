import { assert, assertEquals, assertObjectMatch, assertStringIncludes } from "@std/assert";

import { getMyTargets } from "../../repos.ts";
import { executeTool } from "../executor.ts";
import { toJsonSchema } from "../tool.ts";
import { undoAction } from "../undo.ts";
import {
  caloriesOnly,
  newTargets,
  programId,
  programRow,
  targetsContexts,
} from "./targetsFixtures.ts";
import { payloadOf } from "./testing.ts";
import { updateTargetsTool } from "./updateTargets.ts";
import { structuredOf } from "./writeFixtures.ts";
import { confirmWordsFor } from "../../../assistant/confirmWords.ts";

const askedWith = { ...newTargets, current_kcal: 2140 };
const askedCaloriesOnly = { ...caloriesOnly, current_kcal: 2140 };

const note = "Your macros will be adjusted proportionally: protein 118 g, carbs 229 g, fat 68 g.";
const adjustedRow = {
  name: "Macros adjusted proportionally",
  amountText: "P 118 g · C 229 g · F 68 g",
  time: null,
  kcalText: null,
  match: null,
  matchedFood: null,
  estimate: false,
};

const confirmationIdOf = (result: Awaited<ReturnType<typeof executeTool>>) => {
  assert(result.status === "needs_confirmation");
  return result.confirmationId;
};

const contexts = (options: Parameters<typeof targetsContexts>[1] = {}) =>
  targetsContexts([updateTargetsTool], options);

// Asks, then confirms, and gives back what the confirming call answered.
async function changeTargets(c: ReturnType<typeof contexts>, input: object = askedWith) {
  const confirmationId = confirmationIdOf(await executeTool(c.asking, "update_targets", input));
  return await executeTool(c.confirming, "update_targets", {
    ...input,
    confirmation_id: confirmationId,
  });
}

const profileOf = (c: ReturnType<typeof contexts>) => c.stub.tables["profiles"]?.[0] ?? {};
const programOf = (c: ReturnType<typeof contexts>) => c.stub.tables["programs"]?.[0] ?? {};

Deno.test(
  "setting the calories asks first and writes nothing until the user says yes",
  async () => {
    const c = contexts();

    const result = await executeTool(c.asking, "update_targets", askedWith);

    assertEquals(result.status, "needs_confirmation");
    assertEquals(profileOf(c)["target_kcal"], 1900);
    assertEquals(programOf(c)["ended_on"], null);
    assertEquals(c.store.actions.length, 0);
    assertEquals(c.store.turns[0]?.pending?.tool, "update_targets");
  },
);

Deno.test(
  "the spent confirmation saves the targets, ends the programme and builds the board's card",
  async () => {
    const c = contexts();

    const result = await changeTargets(c);

    assertEquals(result.status, "ok");
    assertEquals(payloadOf(result), { saved: true, kcal: 2000, programme_ended: true });
    assertObjectMatch(structuredOf(result), {
      card: {
        kind: "targets_changed",
        title: "Changed your calorie target to 2,000 kcal",
        sub: "Was 2,140 kcal from your programme",
        note: "Your programme has ended, so Ki-Lo stops adjusting your targets each week. Undo puts back 2,140 kcal and your programme.",
        undo: "available",
        undoneSub: "Put back 2,140 kcal and your programme",
      },
    });
    assertEquals(profileOf(c)["target_kcal"], 2000);
    assertEquals(profileOf(c)["target_protein_g"], 150);
    assert(programOf(c)["ended_on"] !== null);
    const [action] = c.store.actions;
    assertEquals(action?.tool, "update_targets");
    assertEquals(action?.targetTable, "programs");
    assertEquals(action?.targetId, programId);
    assertEquals(action?.targetUpdatedAt, profileOf(c)["targets_updated_at"]);
    assertEquals(c.store.actions.length, 1);
  },
);

Deno.test("a confirmation is for the numbers it was asked about", async () => {
  const c = contexts();
  const confirmationId = confirmationIdOf(await executeTool(c.asking, "update_targets", askedWith));

  const other = await executeTool(c.confirming, "update_targets", {
    ...askedWith,
    kcal: 2500,
    confirmation_id: confirmationId,
  });

  assertEquals(other.status, "error");
  assertEquals(profileOf(c)["target_kcal"], 1900);
  assertEquals(programOf(c)["ended_on"], null);
});

Deno.test(
  "with no programme the targets are saved, the card says Undo is off and the action names no programme",
  async () => {
    const c = contexts({ withProgram: false });

    const result = await changeTargets(c, { ...askedWith, current_kcal: 1900 });

    assertEquals(result.status, "ok");
    assertEquals(payloadOf(result), { saved: true, kcal: 2000, programme_ended: false });
    assertObjectMatch(structuredOf(result), {
      card: {
        kind: "targets_changed",
        sub: "Was 1,900 kcal",
        undo: "unavailable",
        undoneSub: null,
      },
    });
    assertEquals(profileOf(c)["target_kcal"], 2000);
    assertEquals(c.store.actions[0]?.targetId, "00000000-0000-4000-8000-0000000000a1");
    assertEquals(c.store.actions[0]?.targetUpdatedAt, null);
    const undone = await undoAction(c.confirming, c.store.actions[0]?.id ?? "");
    assertEquals(undone, { status: "error", code: "undo_unavailable" });
  },
);

Deno.test(
  "a current_kcal that is not the user's own is refused with no question and no write",
  async () => {
    const c = contexts();

    const result = await executeTool(c.asking, "update_targets", {
      ...askedWith,
      current_kcal: 1900,
    });

    assertEquals(result.status, "ok");
    assertEquals(payloadOf(result), {
      error: "invalid_input",
      fields: ["current_kcal"],
      current_kcal: 2140,
    });
    assertEquals(profileOf(c)["target_kcal"], 1900);
    assertEquals(c.store.actions.length, 0);
    assertEquals(c.store.turns[0]?.pending, null);
  },
);

Deno.test("a number out of range is refused with no question and no write", async () => {
  const c = contexts();

  const tooLow = await executeTool(c.asking, "update_targets", { ...askedWith, kcal: 500 });
  const negative = await executeTool(c.asking, "update_targets", {
    ...askedWith,
    macros: { ...newTargets.macros, fat_g: -5 },
  });

  assertEquals(tooLow.status, "error");
  assertEquals(negative.status, "error");
  assertEquals(profileOf(c)["target_kcal"], 1900);
  assertEquals(c.store.turns[0]?.pending, null);
});

Deno.test(
  "Undo reopens the programme and leaves its targets row in force, and a second Undo is already_undone",
  async () => {
    const c = contexts();
    const saved = await changeTargets(c);
    assert(saved.status === "ok" && saved.actionId !== null);

    const first = await undoAction(c.confirming, saved.actionId);
    const second = await undoAction(c.confirming, saved.actionId);

    assertEquals(first, { status: "undone", actionId: saved.actionId });
    assertEquals(second, { status: "error", code: "already_undone" });
    assertEquals(programOf(c)["ended_on"], null);
    assertEquals(programOf(c)["next_checkin_date"], "2026-11-06");
    assertEquals(c.stub.tables["targets"]?.[0]?.["calories_kcal"], 2140);
    assertEquals(c.stub.tables["targets"]?.[0]?.["effective_to"], null);
  },
);

Deno.test("Undo is unavailable once the person saved their targets again", async () => {
  const c = contexts();
  const saved = await changeTargets(c);
  assert(saved.status === "ok" && saved.actionId !== null);
  Object.assign(profileOf(c), {
    target_kcal: 2300,
    targets_updated_at: "2026-11-03T12:00:00+00:00",
  });

  const result = await undoAction(c.confirming, saved.actionId);

  assertEquals(result, { status: "error", code: "undo_unavailable" });
  assert(programOf(c)["ended_on"] !== null);
});

Deno.test(
  "Undo is unavailable once the programme was touched, or another one is active",
  async () => {
    const touched = contexts();
    const savedFirst = await changeTargets(touched);
    assert(savedFirst.status === "ok" && savedFirst.actionId !== null);
    Object.assign(programOf(touched), { updated_at: "2026-11-03T12:00:00+00:00" });

    const crowded = contexts();
    const savedSecond = await changeTargets(crowded);
    assert(savedSecond.status === "ok" && savedSecond.actionId !== null);
    crowded.stub.tables["programs"]?.push(
      programRow({
        id: "00000000-0000-4000-8000-0000000a0002",
        started_on: "2026-11-03",
        created_at: "2026-11-03T09:00:00+00:00",
      }),
    );

    assertEquals(await undoAction(touched.confirming, savedFirst.actionId), {
      status: "error",
      code: "undo_unavailable",
    });
    assertEquals(await undoAction(crowded.confirming, savedSecond.actionId), {
      status: "error",
      code: "undo_unavailable",
    });
    assert(programOf(touched)["ended_on"] !== null);
    assert(programOf(crowded)["ended_on"] !== null);
  },
);

Deno.test("another user's programme in an action cannot be reopened by this user", async () => {
  const c = contexts();
  c.stub.tables["programs"]?.push(
    programRow({
      id: "00000000-0000-4000-8000-0000000a0009",
      user_id: "00000000-0000-4000-8000-0000000000b2",
      ended_on: "2026-11-02",
    }),
  );
  c.store.actions.push({
    id: "action-theirs",
    userId: "00000000-0000-4000-8000-0000000000a1",
    conversationId: c.confirming.turn.conversationId,
    turnId: c.confirming.turn.id,
    turnSeq: 1,
    tool: "update_targets",
    targetTable: "programs",
    targetId: "00000000-0000-4000-8000-0000000a0009",
    targetIds: null,
    targetLocalDate: null,
    targetUpdatedAt: "2026-10-29T09:00:00+00:00",
    undoneAt: null,
  });

  const result = await undoAction(c.confirming, "action-theirs");

  assertEquals(result, { status: "error", code: "undo_unavailable" });
  assertEquals(c.stub.tables["programs"]?.[1]?.["ended_on"], "2026-11-02");
});

Deno.test("the buttons are the board's, with the number the person keeps", () => {
  assertEquals(confirmWordsFor("update_targets", askedWith), {
    confirmLabel: "Change target",
    cancelLabel: "Keep 2,140",
    tone: "primary",
  });
  assertEquals(
    confirmWordsFor("update_targets", { ...askedWith, current_kcal: null })?.cancelLabel,
    "Don't change",
  );
  assertEquals(confirmWordsFor("update_targets", { kcal: 2000 }), null);
});

Deno.test(
  "with day by day offsets the refusal names the week's figure and the retry with it asks",
  async () => {
    // Tuesday's figure is what get_day gives for Tuesday, and the week's is 2,140.
    const c = contexts({
      engineTargets: { dow_calories_kcal: [2000, 2200, 2140, 2140, 2140, 2140, 2140] },
    });

    const refused = await executeTool(c.asking, "update_targets", {
      ...askedWith,
      current_kcal: 2200,
    });
    const retried = await executeTool(c.asking, "update_targets", {
      ...askedWith,
      current_kcal: 2140,
    });

    assertEquals(refused.status, "ok");
    assertEquals(payloadOf(refused), {
      error: "invalid_input",
      fields: ["current_kcal"],
      current_kcal: 2140,
    });
    assertEquals(retried.status, "needs_confirmation");
    assertEquals(profileOf(c)["target_kcal"], 1900);
    assertEquals(c.store.actions.length, 0);
  },
);

Deno.test("the tool tells the model to call again with the number a refusal names", () => {
  const advice = "If the call is refused with current_kcal, call again with that number.";
  const properties = toJsonSchema(updateTargetsTool)["properties"];
  const field = JSON.stringify(
    typeof properties === "object" && properties !== null && "current_kcal" in properties
      ? properties.current_kcal
      : null,
  );

  assert(updateTargetsTool.description.includes(advice));
  assert(field.includes(advice));
});

Deno.test(
  "when the change time cannot be read the card turns Undo off, as log_entry's does",
  async () => {
    const c = contexts();
    const confirmationId = confirmationIdOf(
      await executeTool(c.asking, "update_targets", askedWith),
    );
    // The profile is read twice in the confirming call: the time zone before the write, the stamp after it.
    c.stub.failNextReadFrom("profiles", 1);

    const result = await executeTool(c.confirming, "update_targets", {
      ...askedWith,
      confirmation_id: confirmationId,
    });

    assert(result.status === "ok" && result.actionId !== null);
    assertEquals(profileOf(c)["target_kcal"], 2000);
    assertObjectMatch(structuredOf(result), {
      card: {
        sub: "Was 2,140 kcal from your programme",
        note: "Your programme has ended, so Ki-Lo stops adjusting your targets each week. Undo is off for this change.",
        undo: "unavailable",
        undoneSub: null,
      },
    });
    assertEquals(c.store.actions[0]?.targetId, programId);
    assertEquals(c.store.actions[0]?.targetUpdatedAt, null);
    assertEquals(await undoAction(c.confirming, result.actionId), {
      status: "error",
      code: "undo_unavailable",
    });
  },
);

Deno.test(
  "when the profile write fails the programme the call ended is reopened and no action is kept",
  async () => {
    const c = contexts();
    const confirmationId = confirmationIdOf(
      await executeTool(c.asking, "update_targets", askedWith),
    );
    c.stub.failNextWriteTo("profiles");

    const result = await executeTool(c.confirming, "update_targets", {
      ...askedWith,
      confirmation_id: confirmationId,
    });

    assertEquals(result.status === "error" && result.code, "tool_failed");
    assertEquals(programOf(c)["ended_on"], null);
    assertEquals(profileOf(c)["target_kcal"], 1900);
    assertEquals(c.store.actions.length, 0);
  },
);

Deno.test("when the reopen also fails the failure is reported by code only", async () => {
  const c = contexts();
  const confirmationId = confirmationIdOf(await executeTool(c.asking, "update_targets", askedWith));
  // The profile write fails, and then so does the update that would reopen the programme.
  c.stub.failNextWriteTo("profiles");
  c.stub.beforeNextWriteTo("profiles", () => c.stub.failNextWriteTo("programs"));

  const result = await executeTool(c.confirming, "update_targets", {
    ...askedWith,
    confirmation_id: confirmationId,
  });

  assertEquals(result.status === "error" && result.code, "tool_failed");
  assert(programOf(c)["ended_on"] !== null);
  assertEquals(c.store.actions.length, 0);
  // The executor reports the save failure, and the tool reports the failed reopen: each by code only.
  const messages = c.reported.map(({ caught }) => (caught instanceof Error ? caught.message : ""));
  assertEquals(messages, [
    "Could not reopen your program (XX000)",
    "Could not save your targets (XX000)",
  ]);
});

// ---- Only the calories given (KEY-824) ----

const targetsRowOf = (c: ReturnType<typeof contexts>) => c.stub.tables["targets"]?.[0] ?? {};

Deno.test(
  "calories only asks with the note, writes nothing, and the spent confirmation saves the scaled macros and ends the programme",
  async () => {
    const c = contexts();

    const asked = await executeTool(c.asking, "update_targets", askedCaloriesOnly);

    assert(asked.status === "needs_confirmation");
    assertEquals(asked.note, note);
    assertEquals(profileOf(c)["target_kcal"], 1900);
    assertEquals(programOf(c)["ended_on"], null);
    assertEquals(c.store.actions.length, 0);

    const result = await executeTool(c.confirming, "update_targets", {
      ...askedCaloriesOnly,
      confirmation_id: asked.confirmationId,
    });

    assertEquals(result.status, "ok");
    assertEquals(payloadOf(result), {
      saved: true,
      kcal: 2000,
      programme_ended: true,
      adjusted_macros: { protein_g: 118, carbs_g: 229, fat_g: 68 },
    });
    assertObjectMatch(structuredOf(result), {
      card: {
        kind: "targets_changed",
        title: "Changed your calorie target to 2,000 kcal",
        sub: "Was 2,140 kcal from your programme",
        rows: [adjustedRow],
        undo: "available",
      },
    });
    assertEquals(profileOf(c)["target_kcal"], 2000);
    assertEquals(profileOf(c)["target_protein_g"], 118);
    assertEquals(profileOf(c)["target_carbs_g"], 229);
    assertEquals(profileOf(c)["target_fat_g"], 68);
    assert(programOf(c)["ended_on"] !== null);
    assertEquals(c.store.actions.length, 1);
  },
);

Deno.test("all three macros given: no note, no row and today's result", async () => {
  const c = contexts();

  const asked = await executeTool(c.asking, "update_targets", askedWith);
  const result = await changeTargets(c);

  assert(asked.status === "needs_confirmation");
  assertEquals("note" in asked, false);
  assertEquals(payloadOf(result), { saved: true, kcal: 2000, programme_ended: true });
  assertEquals(structuredOf(result)["card"] !== undefined, true);
  assertObjectMatch(structuredOf(result), { card: { rows: [] } });
});

Deno.test(
  "a confirmation asked with macros null is refused for a call that sends macros, and the other way round",
  async () => {
    const forNull = contexts();
    const nullId = confirmationIdOf(
      await executeTool(forNull.asking, "update_targets", askedCaloriesOnly),
    );
    const forMacros = contexts();
    const macrosId = confirmationIdOf(
      await executeTool(forMacros.asking, "update_targets", askedWith),
    );

    const sendsMacros = await executeTool(forNull.confirming, "update_targets", {
      ...askedWith,
      confirmation_id: nullId,
    });
    const sendsNull = await executeTool(forMacros.confirming, "update_targets", {
      ...askedCaloriesOnly,
      confirmation_id: macrosId,
    });

    assertEquals(sendsMacros.status === "error" && sendsMacros.code, "confirmation_invalid");
    assertEquals(sendsNull.status === "error" && sendsNull.code, "confirmation_invalid");
    assertEquals(profileOf(forNull)["target_kcal"], 1900);
    assertEquals(profileOf(forMacros)["target_kcal"], 1900);
  },
);

Deno.test(
  "with no current calorie target the call is refused naming macros, with no question and no write",
  async () => {
    const c = contexts({ withProgram: false, profile: { target_kcal: null } });

    const result = await executeTool(c.asking, "update_targets", {
      ...caloriesOnly,
      current_kcal: null,
    });

    assertEquals(result.status, "ok");
    assertEquals(payloadOf(result), { error: "invalid_input", fields: ["macros"] });
    assertEquals(profileOf(c)["target_kcal"], null);
    assertEquals(c.store.actions.length, 0);
    assertEquals(c.store.turns[0]?.pending, null);
  },
);

Deno.test(
  "a scaled macro over 1,000 g is refused naming macros, with no question and no write",
  async () => {
    const c = contexts({ engineTargets: { protein_g: 900 } });

    const result = await executeTool(c.asking, "update_targets", {
      kcal: 3000,
      macros: null,
      current_kcal: 2140,
    });

    assertEquals(result.status, "ok");
    assertEquals(payloadOf(result), { error: "invalid_input", fields: ["macros"] });
    assertEquals(profileOf(c)["target_kcal"], 1900);
    assertEquals(programOf(c)["ended_on"], null);
    assertEquals(c.store.actions.length, 0);
    assertEquals(c.store.turns[0]?.pending, null);
  },
);

Deno.test(
  "with no current macros the calories are saved, the macros stay null and nothing mentions adjusting",
  async () => {
    const c = contexts({
      engineTargets: { protein_g: null, carbs_g: null, fat_g: null },
    });

    const asked = await executeTool(c.asking, "update_targets", askedCaloriesOnly);
    const result = await executeTool(c.confirming, "update_targets", {
      ...askedCaloriesOnly,
      confirmation_id: asked.status === "needs_confirmation" ? asked.confirmationId : "",
    });

    assert(asked.status === "needs_confirmation");
    assertEquals("note" in asked, false);
    assertEquals(payloadOf(result), { saved: true, kcal: 2000, programme_ended: true });
    assertObjectMatch(structuredOf(result), { card: { rows: [] } });
    assertEquals(profileOf(c)["target_kcal"], 2000);
    assertEquals(profileOf(c)["target_protein_g"], null);
    assertEquals(profileOf(c)["target_carbs_g"], null);
    assertEquals(profileOf(c)["target_fat_g"], null);
  },
);

Deno.test(
  "with some current macros null the others are scaled and the null ones stay null and out of the words",
  async () => {
    const c = contexts({ engineTargets: { carbs_g: null } });

    const asked = await executeTool(c.asking, "update_targets", askedCaloriesOnly);
    const result = await executeTool(c.confirming, "update_targets", {
      ...askedCaloriesOnly,
      confirmation_id: asked.status === "needs_confirmation" ? asked.confirmationId : "",
    });

    assert(asked.status === "needs_confirmation");
    assertEquals(
      asked.note,
      "Your macros will be adjusted proportionally: protein 118 g, fat 68 g.",
    );
    assertEquals(payloadOf(result), {
      saved: true,
      kcal: 2000,
      programme_ended: true,
      adjusted_macros: { protein_g: 118, carbs_g: null, fat_g: 68 },
    });
    assertObjectMatch(structuredOf(result), {
      card: { rows: [{ amountText: "P 118 g · F 68 g" }] },
    });
    assertEquals(profileOf(c)["target_carbs_g"], null);
  },
);

Deno.test(
  "a current_kcal that is not the user's own is refused with the real number before any scaling",
  async () => {
    // The scaled protein would be over 1,000 g, but the number the person was shown is checked first.
    const c = contexts({ engineTargets: { protein_g: 900 } });

    const result = await executeTool(c.asking, "update_targets", {
      kcal: 3000,
      macros: null,
      current_kcal: 1900,
    });

    assertEquals(payloadOf(result), {
      error: "invalid_input",
      fields: ["current_kcal"],
      current_kcal: 2140,
    });
    assertEquals(c.store.turns[0]?.pending, null);
  },
);

Deno.test(
  "with day by day offsets the scale reads the week's figure and the macros of the row, the programme's targets row is untouched and the saved targets are manual",
  async () => {
    const c = contexts({
      engineTargets: { dow_calories_kcal: [2000, 2200, 2140, 2140, 2140, 2140, 2140] },
    });

    const saved = await changeTargets(c, askedCaloriesOnly);

    assertEquals(saved.status, "ok");
    assertEquals(profileOf(c)["target_protein_g"], 118);
    assertEquals(targetsRowOf(c)["calories_kcal"], 2140);
    assertEquals(targetsRowOf(c)["protein_g"], 126);
    assertEquals(targetsRowOf(c)["dow_calories_kcal"], [2000, 2200, 2140, 2140, 2140, 2140, 2140]);
    assertEquals(targetsRowOf(c)["effective_to"], null);
    assertEquals(await getMyTargets(c.confirming.caller), {
      kcal: 2000,
      protein_g: 118,
      carbs_g: 229,
      fat_g: 68,
      source: "manual",
    });
  },
);

Deno.test(
  "a macro edited between the question and the yes: the saved figures and the card follow the edit",
  async () => {
    // Accepted (KEY-824): current_kcal protects the ratio and not the macros, and the card shows what was saved.
    const c = contexts({ withProgram: false });
    const input = { ...caloriesOnly, current_kcal: 1900 };
    const asked = await executeTool(c.asking, "update_targets", input);
    assert(asked.status === "needs_confirmation");
    assertEquals(
      asked.note,
      "Your macros will be adjusted proportionally: protein 126 g, carbs 211 g, fat 63 g.",
    );
    Object.assign(profileOf(c), { target_protein_g: 190 });

    const result = await executeTool(c.confirming, "update_targets", {
      ...input,
      confirmation_id: asked.confirmationId,
    });

    assertEquals(profileOf(c)["target_protein_g"], 200);
    assertObjectMatch(structuredOf(result), {
      card: { rows: [{ amountText: "P 200 g · C 211 g · F 63 g" }] },
    });
  },
);

Deno.test(
  "Undo after a calories only change reopens the programme and the row's own macros are in force again",
  async () => {
    const c = contexts();
    const saved = await changeTargets(c, askedCaloriesOnly);
    assert(saved.status === "ok" && saved.actionId !== null);
    assertEquals((await getMyTargets(c.confirming.caller)).source, "manual");

    const undone = await undoAction(c.confirming, saved.actionId);

    assertEquals(undone, { status: "undone", actionId: saved.actionId });
    assertEquals(programOf(c)["ended_on"], null);
    assertEquals(await getMyTargets(c.confirming.caller), {
      kcal: 2140,
      protein_g: 126,
      carbs_g: 245,
      fat_g: 73,
      dowCaloriesKcal: [2140, 2140, 2140, 2140, 2140, 2140, 2140],
      source: "engine",
    });
  },
);

Deno.test("with no programme a calories only change has no Undo", async () => {
  const c = contexts({ withProgram: false });

  const saved = await changeTargets(c, { ...caloriesOnly, current_kcal: 1900 });

  assert(saved.status === "ok" && saved.actionId !== null);
  assertEquals(profileOf(c)["target_protein_g"], 126);
  assertEquals(await undoAction(c.confirming, saved.actionId), {
    status: "error",
    code: "undo_unavailable",
  });
});

Deno.test("the buttons for a calories only change are the same", () => {
  assertEquals(confirmWordsFor("update_targets", askedCaloriesOnly)?.cancelLabel, "Keep 2,140");
});

Deno.test(
  "the tool tells the model what to do with macros null, with a partial set and with a refusal",
  () => {
    const text = updateTargetsTool.description;

    assert(text.includes("macros"));
    assert(text.includes("null"));
    assert(text.includes("ask_user"));
    assert(!text.includes("Ask for any of the four numbers"));
  },
);

Deno.test("macros is a required nullable object in the schema the model sees", () => {
  const properties = toJsonSchema(updateTargetsTool)["properties"];
  const macros = JSON.stringify(
    typeof properties === "object" && properties !== null && "macros" in properties
      ? properties.macros
      : null,
  );

  assert(macros.includes('"type":"null"'));
  assert(macros.includes("protein_g"));
  assert(macros.includes('"additionalProperties":false'));
  assertEquals(Object.keys(properties ?? {}), [
    "kcal",
    "macros",
    "current_kcal",
    "confirmation_id",
  ]);
});

Deno.test(
  "the question is the board's, and the label is its button, with the note after for a calories only change",
  async () => {
    const c = contexts();

    const asked = await executeTool(c.asking, "update_targets", askedCaloriesOnly);
    const need = await updateTargetsTool.needsConfirmation?.(askedCaloriesOnly, c.asking);

    assert(asked.status === "needs_confirmation");
    assertEquals(
      asked.question,
      "Change your calorie target from 2,140 to 2,000 kcal? This ends your programme and its weekly check-in. Today and later days use your own targets.",
    );
    assertEquals(asked.note, note);
    assertEquals(
      need !== false && need !== undefined ? need.confirmLabel : null,
      confirmWordsFor("update_targets", askedCaloriesOnly)?.confirmLabel,
    );
  },
);

Deno.test("the description tells the model when they say no, do not call again", () => {
  assertStringIncludes(updateTargetsTool.description, "When they say no, do not call again.");
});

Deno.test(
  "after Keep 2,140 the confirmation asks again, the targets are unchanged and the programme stays active",
  async () => {
    const c = contexts();
    const confirmationId = confirmationIdOf(
      await executeTool(c.asking, "update_targets", askedCaloriesOnly),
    );

    const result = await executeTool(
      { ...c.confirming, turn: { ...c.confirming.turn, personsWords: "Keep 2,140" } },
      "update_targets",
      { ...askedCaloriesOnly, confirmation_id: confirmationId },
    );

    assert(result.status === "needs_confirmation");
    assertEquals(result.asksAgain, true);
    assertEquals(result.note, note);
    assertEquals(profileOf(c)["target_kcal"], 1900);
    assertEquals(programOf(c)["ended_on"], null);
    assertEquals(c.store.actions.length, 0);
  },
);
