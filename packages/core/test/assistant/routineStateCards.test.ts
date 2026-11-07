import { describe, expect, it } from "vitest";

import {
  assistantCardSchema,
  buildRoutineActiveCard,
  buildRoutineArchivedCard,
  buildRoutineClearedCard,
  confirmArchiveRoutineButtons,
  confirmArchiveRoutineQuestion,
  withActionIds,
} from "../../src/assistant";

const routineId = "00000000-0000-4000-8000-0000000000e1";
const actionIds: [string, ...string[]] = ["00000000-0000-4000-8000-0000000000d1"];

describe("buildRoutineActiveCard", () => {
  it("should build the board's card for Push Pull Legs replacing Upper Lower", () => {
    const draft = buildRoutineActiveCard({
      routineId,
      name: "Push Pull Legs",
      previousName: "Upper Lower",
    });

    expect(assistantCardSchema.parse(withActionIds(draft, actionIds))).toEqual({
      actionIds,
      kind: "routine_active",
      title: "Push Pull Legs is your active routine",
      sub: "Was Upper Lower · your week plans from it today",
      rows: [],
      changeDetail: "was Upper Lower",
      totalText: null,
      note: null,
      link: { label: "Open in routine editor", target: { screen: "routine_editor", routineId } },
      undo: "available",
      undoneSub: "Upper Lower is your active routine again",
    });
  });

  it("should leave out what was before when no routine was active, and Undo clears", () => {
    const draft = buildRoutineActiveCard({
      routineId,
      name: "Push Pull Legs",
      previousName: null,
    });

    expect(assistantCardSchema.parse(withActionIds(draft, actionIds))).toMatchObject({
      title: "Push Pull Legs is your active routine",
      sub: "Your week plans from it today",
      link: { label: "Open in routine editor" },
      undo: "available",
      undoneSub: "No routine is active",
    });
    expect(draft.changeDetail ?? null).toBeNull();
  });
});

describe("buildRoutineClearedCard", () => {
  it("should say no routine is active, name the one that was, and carry no link", () => {
    const draft = buildRoutineClearedCard({ previousName: "Upper Lower" });

    expect(assistantCardSchema.parse(withActionIds(draft, actionIds))).toEqual({
      actionIds,
      kind: "routine_active",
      title: "No routine is active",
      sub: "Was Upper Lower",
      rows: [],
      changeDetail: "was Upper Lower",
      totalText: null,
      note: null,
      link: null,
      undo: "available",
      undoneSub: "Upper Lower is your active routine again",
    });
  });
});

describe("buildRoutineArchivedCard", () => {
  it("should build the board's card for Upper Lower, with no link", () => {
    const draft = buildRoutineArchivedCard({ name: "Upper Lower" });

    expect(assistantCardSchema.parse(withActionIds(draft, actionIds))).toEqual({
      actionIds,
      kind: "routine_archived",
      title: "Archived routine Upper Lower",
      sub: "Sessions you logged with it stay in your history",
      rows: [],
      totalText: null,
      note: null,
      link: null,
      undo: "available",
      undoneSub: "Upper Lower is back in your routines",
    });
  });
});

describe("the archive routine confirmation", () => {
  it("should give the board's two buttons", () => {
    expect(confirmArchiveRoutineButtons()).toEqual({
      confirmLabel: "Archive routine",
      cancelLabel: "Keep it",
    });
  });

  it("should ask the board's question", () => {
    expect(confirmArchiveRoutineQuestion("Upper Lower")).toBe(
      "Archive Upper Lower? It leaves your routine list. Sessions you logged with it stay in your history.",
    );
  });
});
