import { assert, assertEquals, assertObjectMatch } from "@std/assert";

import { executeTool } from "../executor.ts";
import { undoAction } from "../undo.ts";
import { programId, newTargets, programRow, targetsContexts } from "./targetsFixtures.ts";
import { payloadOf } from "./testing.ts";
import { updateTargetsTool } from "./updateTargets.ts";
import { structuredOf } from "./writeFixtures.ts";
import { confirmWordsFor } from "../../../assistant/confirmWords.ts";

const askedWith = { ...newTargets, current_kcal: 2140 };

const confirmationIdOf = (result: Awaited<ReturnType<typeof executeTool>>) => {
  assert(result.status === "needs_confirmation");
  return result.confirmationId;
};

const contexts = (options: Parameters<typeof targetsContexts>[1] = {}) =>
  targetsContexts([updateTargetsTool], options);

// Asks, then confirms, and gives back what the confirming call answered.
async function changeTargets(c: ReturnType<typeof contexts>, input = askedWith) {
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
  const negative = await executeTool(c.asking, "update_targets", { ...askedWith, fat_g: -5 });

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
