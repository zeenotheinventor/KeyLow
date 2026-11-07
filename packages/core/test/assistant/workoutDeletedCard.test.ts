import { describe, expect, it } from "vitest";

import {
  assistantCardSchema,
  buildWorkoutDeletedCard,
  confirmDeleteWorkoutButtons,
  confirmDeleteWorkoutQuestion,
  withActionIds,
} from "../../src/assistant";

const actionId = "00000000-0000-4000-8000-0000000000d1";

const legsOnThursday = { dayName: "Legs", localDate: "2026-10-08", setCount: 16 };

describe("buildWorkoutDeletedCard", () => {
  it("should build the board's card for a Legs workout of 16 sets", () => {
    expect(buildWorkoutDeletedCard(legsOnThursday)).toEqual({
      kind: "workout_deleted",
      title: "Deleted workout Legs",
      sub: "Thursday 8 October · 16 sets",
      rows: [],
      changeDetail: "Thu 8 Oct · 16 sets",
      totalText: null,
      note: null,
      link: null,
      undo: "available",
      undoneSub: "Legs on Thursday 8 October is back in your history",
    });
  });

  it("should word a workout with no routine day without a name", () => {
    const card = buildWorkoutDeletedCard({ ...legsOnThursday, dayName: null });

    expect(card.title).toBe("Deleted workout");
    expect(card.undoneSub).toBe("Your workout on Thursday 8 October is back in your history");
  });

  it("should say one set in the singular", () => {
    const card = buildWorkoutDeletedCard({ ...legsOnThursday, setCount: 1 });

    expect(card.sub).toBe("Thursday 8 October · 1 set");
    expect(card.changeDetail).toBe("Thu 8 Oct · 1 set");
  });

  it("should be a card the app accepts once it has its action id", () => {
    const card = withActionIds(buildWorkoutDeletedCard(legsOnThursday), [actionId]);

    expect(assistantCardSchema.parse(card)).toEqual(card);
  });
});

describe("confirmDeleteWorkoutQuestion", () => {
  it("should be the board's question for a workout with a routine day", () => {
    expect(confirmDeleteWorkoutQuestion(legsOnThursday)).toBe(
      "Delete your Legs workout from Thursday 8 October? It has 16 sets. They leave your history and your weekly numbers.",
    );
  });

  it("should leave the routine day out of a workout that has none", () => {
    expect(confirmDeleteWorkoutQuestion({ ...legsOnThursday, dayName: null })).toBe(
      "Delete your workout from Thursday 8 October? It has 16 sets. They leave your history and your weekly numbers.",
    );
  });

  it("should say it and not they for a single set", () => {
    expect(confirmDeleteWorkoutQuestion({ ...legsOnThursday, setCount: 1 })).toBe(
      "Delete your Legs workout from Thursday 8 October? It has 1 set. It leaves your history and your weekly numbers.",
    );
  });
});

describe("confirmDeleteWorkoutButtons", () => {
  it("should be Delete workout and Keep it", () => {
    expect(confirmDeleteWorkoutButtons()).toEqual({
      confirmLabel: "Delete workout",
      cancelLabel: "Keep it",
    });
  });
});
