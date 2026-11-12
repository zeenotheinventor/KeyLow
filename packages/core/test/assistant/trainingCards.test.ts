import { describe, expect, it } from "vitest";

import {
  cardOfKind,
  routineCreatedCard,
  routineId,
  routineUpdatedCard,
  sessionId,
  storedRoutineCard,
  setUpdatedCard,
  trainingCardKinds,
} from "./trainingCardFixtures";
import {
  assistantCardSchema,
  assistantStreamEventSchema,
  describeAssistantCard,
  parseAssistantEvent,
  undoOutcomeOfResults,
} from "../../src/assistant";
import { ASSISTANT_CARD_WORDS } from "../../src/copy";

import type { AssistantCardKind } from "../../src/assistant";

describe("assistantCardSchema, the training kinds", () => {
  it.each(trainingCardKinds)("should parse a %s card with days and changeDetail", (kind) => {
    const card = { ...routineCreatedCard, kind, changeDetail: "4 changes" };

    expect(assistantCardSchema.parse(card)).toEqual(card);
  });

  it.each(trainingCardKinds)(
    "should parse a %s card with neither, as every stored card has",
    (kind) => {
      const card = { ...storedRoutineCard, kind };

      expect(assistantCardSchema.parse(card)).toEqual(card);
    },
  );

  it("should parse days and changeDetail as null", () => {
    const card = { ...routineCreatedCard, days: null, changeDetail: null };

    expect(assistantCardSchema.parse(card)).toEqual(card);
  });

  it("should still reject a kind it does not list", () => {
    expect(
      assistantCardSchema.safeParse({ ...routineCreatedCard, kind: "plan_created" }).success,
    ).toBe(false);
  });

  it("should still reject a key it does not list", () => {
    expect(assistantCardSchema.safeParse({ ...routineCreatedCard, sets: 45 }).success).toBe(false);
  });

  it("should reject a key a day does not list", () => {
    const days = [{ name: "Monday", summary: "5 exercises", exercises: [], minutes: 50 }];

    expect(assistantCardSchema.safeParse({ ...routineCreatedCard, days }).success).toBe(false);
  });

  it("should reject a key an exercise of a day does not list", () => {
    const days = [
      {
        name: "Monday",
        summary: "5 exercises",
        exercises: [{ name: "Squat", detail: "3 sets", sets: 3 }],
      },
    ];

    expect(assistantCardSchema.safeParse({ ...routineCreatedCard, days }).success).toBe(false);
  });

  it("should parse a link to the routine editor and a link to a session", () => {
    expect(assistantCardSchema.parse(routineCreatedCard).link?.target).toEqual({
      screen: "routine_editor",
      routineId,
    });
    expect(assistantCardSchema.parse(setUpdatedCard).link?.target).toEqual({
      screen: "session_detail",
      sessionId,
    });
  });

  it("should reject a routine editor link without the routine", () => {
    const link = { label: "Open in routine editor", target: { screen: "routine_editor" } };

    expect(assistantCardSchema.safeParse({ ...routineCreatedCard, link }).success).toBe(false);
  });
});

describe("the link and ask_again events", () => {
  const link = { label: "Open in routine editor", target: { screen: "routine_editor", routineId } };

  it("should parse a link on its own", () => {
    expect(assistantStreamEventSchema.parse({ type: "link", link })).toEqual({
      type: "link",
      link,
    });
  });

  it("should parse Ask again", () => {
    expect(assistantStreamEventSchema.parse({ type: "ask_again" })).toEqual({ type: "ask_again" });
  });

  it("should reject a link event without its link", () => {
    expect(assistantStreamEventSchema.safeParse({ type: "link" }).success).toBe(false);
  });

  it("should reject a key on Ask again", () => {
    expect(
      assistantStreamEventSchema.safeParse({ type: "ask_again", label: "Again" }).success,
    ).toBe(false);
  });

  it("should read both off the stream", () => {
    expect(parseAssistantEvent(JSON.stringify({ type: "link", link }))).toEqual({
      ok: true,
      event: { type: "link", link },
    });
    expect(parseAssistantEvent(JSON.stringify({ type: "ask_again" }))).toEqual({
      ok: true,
      event: { type: "ask_again" },
    });
  });
});

describe("describeAssistantCard, the training kinds", () => {
  it.each([
    ["routine_updated", "Check", "success"],
    ["routine_active", "Check", "success"],
    ["routine_created", "Check", "success"],
    ["exercise_created", "Check", "success"],
    ["exercise_updated", "Check", "success"],
    ["set_updated", "Check", "success"],
    ["routine_archived", "Archive", "secondary"],
    ["exercise_archived", "Archive", "secondary"],
    ["goals_updated", "Target", "secondary"],
    ["workout_deleted", "Trash2", "secondary"],
  ] as const)("should draw a %s card with the %s icon in the %s tone", (kind, icon, iconTone) => {
    expect(describeAssistantCard(cardOfKind(kind))).toMatchObject({ icon, iconTone });
  });

  it("should hand on the days of the card as sent", () => {
    expect(describeAssistantCard(routineCreatedCard).days).toEqual(routineCreatedCard.days);
  });

  it("should draw no days when the card has none", () => {
    expect(describeAssistantCard(routineUpdatedCard).days).toEqual([]);
  });

  it("should draw no days on an undone card", () => {
    expect(describeAssistantCard(routineCreatedCard, "undone").days).toEqual([]);
  });

  it("should draw a row's detail and value as the board does for a changed set", () => {
    expect(describeAssistantCard(setUpdatedCard).rows).toEqual([
      { name: "Barbell squat, set 2", detail: "Was 100 kg × 6", value: "100 kg × 8" },
    ]);
  });
});

type Reason = "changed" | "active" | "logged" | "used";

describe("describeAssistantCard, why Undo is off", () => {
  const notes: [AssistantCardKind, Reason | undefined, string][] = [
    [
      "routine_updated",
      "changed",
      "You changed this routine in the app since, so Undo is off. Edit it in the routine editor.",
    ],
    [
      "routine_created",
      "changed",
      "You changed this routine in the app since, so Undo is off. Edit it in the routine editor.",
    ],
    [
      "routine_created",
      "active",
      "It is your active routine now, so Undo is off. Undo making it active first.",
    ],
    [
      "routine_created",
      "logged",
      "You logged a workout from this routine, so Undo is off. To remove it, archive it in Routines.",
    ],
    [
      "routine_updated",
      "logged",
      "You logged a workout from a day this added, so Undo is off. Edit it in the routine editor.",
    ],
    [
      "routine_active",
      undefined,
      "Another routine is active now, so Undo is off. Change it in Routines.",
    ],
    [
      "routine_active",
      "active",
      "Another routine is active now, so Undo is off. Change it in Routines.",
    ],
    ["routine_archived", undefined, "You restored this routine in the app since, so Undo is off."],
    [
      "goals_updated",
      undefined,
      "You changed your goals in the app since, so Undo is off. Change them on the Goal screen.",
    ],
    ["exercise_created", "changed", "This exercise has changed since, so Undo is off."],
    ["exercise_updated", "changed", "This exercise has changed since, so Undo is off."],
    ["exercise_created", "used", "You have used this exercise since, so Undo is off."],
    [
      "exercise_archived",
      undefined,
      "This exercise is already back in your exercises, so Undo is off.",
    ],
    [
      "set_updated",
      undefined,
      "You changed this set in the app since, so Undo is off. Edit it in History.",
    ],
    ["workout_deleted", undefined, "This workout is already back in your history, so Undo is off."],
  ];

  it.each(notes)("should word a %s card refused for %s", (kind, reason, note) => {
    const outcome = undoOutcomeOfResults([{ result: "undo_unavailable", reason }]);

    const look = describeAssistantCard(cardOfKind(kind), outcome);

    expect(look.note).toBe(note);
    expect(look.undo).toEqual({ state: "unavailable", label: "Can't undo" });
  });

  it("should replace the note the card came with", () => {
    const card = { ...routineUpdatedCard, note: "A note from the server" };

    const look = describeAssistantCard(
      card,
      undoOutcomeOfResults([{ result: "undo_unavailable", reason: "changed" }]),
    );

    expect(look.note).toContain("You changed this routine in the app since");
  });

  it("should keep the card's own note when no reason has a line for it", () => {
    const card = { ...cardOfKind("exercise_updated"), note: "A note from the server" };

    const look = describeAssistantCard(
      card,
      undoOutcomeOfResults([{ result: "undo_unavailable", reason: "used" }]),
    );

    expect(look.note).toBe("A note from the server");
  });

  it("should keep a press with no reason as the plain Can't undo", () => {
    const look = describeAssistantCard(
      routineUpdatedCard,
      undoOutcomeOfResults(["undo_unavailable"]),
    );

    expect(look.undo.label).toBe("Can't undo");
  });
});

describe("undoOutcomeOfResults, keeping the reason", () => {
  it("should read codes alone as it always has", () => {
    expect(undoOutcomeOfResults(["undone", "already_undone"])).toBe("undone");
    expect(undoOutcomeOfResults(["undo_unavailable"])).toBe("unavailable");
  });

  it("should read an answer without a reason as unavailable", () => {
    expect(undoOutcomeOfResults([{ result: "undo_unavailable" }])).toBe("unavailable");
  });

  it("should keep the reason of the first answer that was not undone, when none was", () => {
    expect(
      undoOutcomeOfResults([
        { result: "undo_unavailable", reason: "logged" },
        { result: "undo_unavailable", reason: "changed" },
      ]),
    ).toEqual({ state: "unavailable", reason: "logged" });
  });

  it("should read undone answers as undone whatever else they carry", () => {
    expect(undoOutcomeOfResults([{ result: "undone" }, { result: "already_undone" }])).toBe(
      "undone",
    );
  });
});

describe("describeAssistantCard, Can't undo yet", () => {
  const waitNote =
    "Your workout is in progress, so Undo waits until it ends. Finish it, then press Undo.";
  const waiting = { state: "unavailable", label: "Can't undo yet" };

  it("should word the label as assistant-card · undo-unavailable-training does", () => {
    expect(ASSISTANT_CARD_WORDS.waitUndoLabel).toBe("Can't undo yet");
  });

  it.each(trainingCardKinds)(
    "should hold Undo back on an available %s card during a workout",
    (kind) => {
      const look = describeAssistantCard(cardOfKind(kind), null, { workoutInProgress: true });

      expect(look.undo).toEqual(waiting);
      expect(look.note).toBe(waitNote);
    },
  );

  it("should replace the card's own note while it waits", () => {
    const card = { ...routineUpdatedCard, note: "A note from the server" };

    expect(describeAssistantCard(card, null, { workoutInProgress: true }).note).toBe(waitNote);
  });

  it("should offer Undo again once the workout has ended", () => {
    const look = describeAssistantCard(routineUpdatedCard, null, { workoutInProgress: false });

    expect(look.undo).toEqual({ state: "available", label: "Undo" });
    expect(look.note).toBeNull();
  });

  it("should leave a diary card alone during a workout", () => {
    const look = describeAssistantCard({ ...routineUpdatedCard, kind: "logged" }, null, {
      workoutInProgress: true,
    });

    expect(look.undo.state).toBe("available");
  });

  it("should leave a card that is already undone alone during a workout", () => {
    const look = describeAssistantCard({ ...routineUpdatedCard, undo: "undone" }, null, {
      workoutInProgress: true,
    });

    expect(look.title).toBe("Undone");
  });

  it("should leave a card that is already unavailable with its own reason during a workout", () => {
    const look = describeAssistantCard(
      { ...routineUpdatedCard, undo: "unavailable", note: "Its own note" },
      null,
      { workoutInProgress: true },
    );

    expect(look.undo.label).toBe("Can't undo");
    expect(look.note).toBe("Its own note");
  });

  describe("a press that raced a workout starting", () => {
    const raced = undoOutcomeOfResults([
      { result: "undo_unavailable", reason: "workout_in_progress" },
    ]);

    it("should draw Can't undo yet while the workout is on", () => {
      const look = describeAssistantCard(routineUpdatedCard, raced, { workoutInProgress: true });

      expect(look.undo).toEqual(waiting);
      expect(look.note).toBe(waitNote);
    });

    it("should clear when the workout ends, and Undo comes back", () => {
      const look = describeAssistantCard(routineUpdatedCard, raced, { workoutInProgress: false });

      expect(look.undo).toEqual({ state: "available", label: "Undo" });
      expect(look.note).toBeNull();
    });
  });
});
