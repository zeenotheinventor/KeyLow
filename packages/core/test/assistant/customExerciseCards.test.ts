import { describe, expect, it } from "vitest";

import {
  assistantCardSchema,
  buildExerciseArchivedCard,
  buildExerciseCreatedCard,
  buildExerciseUpdatedCard,
  confirmArchiveExerciseButtons,
  confirmArchiveExerciseQuestion,
  withActionIds,
} from "../../src/assistant";

const actionIds: [string, ...string[]] = ["00000000-0000-4000-8000-0000000000d1"];

const cableCrunch = {
  name: "Cable crunch",
  equipment: "cable",
  muscles: [{ muscle_id: "abs", role: "primary" }],
} as const;

const kneelingCableCrunch = {
  name: "Kneeling cable crunch",
  equipment: "cable",
  muscles: [
    { muscle_id: "abs", role: "primary" },
    { muscle_id: "obliques", role: "secondary" },
  ],
} as const;

describe("buildExerciseCreatedCard", () => {
  it("should build the board's card for Cable crunch", () => {
    const draft = buildExerciseCreatedCard(cableCrunch);

    expect(assistantCardSchema.parse(withActionIds(draft, actionIds))).toEqual({
      actionIds,
      kind: "exercise_created",
      title: "Added exercise Cable crunch",
      sub: "Custom · Cable · Abs",
      rows: [],
      totalText: null,
      note: "Not in a routine yet. Say which day, or add it in the routine editor.",
      link: null,
      undo: "available",
      undoneSub: "Archived Cable crunch",
    });
  });

  it("should list the primary muscles, then the secondary and the assisting ones, in the order of the muscle list", () => {
    const draft = buildExerciseCreatedCard({
      name: "Romanian deadlift",
      equipment: "barbell",
      muscles: [
        { muscle_id: "calves", role: "stabiliser" },
        { muscle_id: "glute_max", role: "secondary" },
        { muscle_id: "hamstrings", role: "primary" },
        { muscle_id: "lower_back", role: "secondary" },
      ],
    });

    expect(draft.sub).toBe("Custom · Barbell · Hamstrings, lower back, glutes, calves");
  });

  it("should carry no link, because no screen opens a custom exercise", () => {
    expect(buildExerciseCreatedCard(cableCrunch).link).toBeNull();
  });
});

describe("buildExerciseUpdatedCard", () => {
  it("should build the board's card for a rename that adds obliques", () => {
    const draft = buildExerciseUpdatedCard({ before: cableCrunch, after: kneelingCableCrunch });

    expect(assistantCardSchema.parse(withActionIds(draft, actionIds))).toEqual({
      actionIds,
      kind: "exercise_updated",
      title: "Updated exercise Kneeling cable crunch",
      sub: null,
      rows: [
        {
          name: "Name",
          amountText: "Was Cable crunch",
          time: null,
          kcalText: null,
          match: null,
          matchedFood: null,
          estimate: false,
        },
        {
          name: "Muscles",
          amountText: "Abs, obliques · was Abs",
          time: null,
          kcalText: null,
          match: null,
          matchedFood: null,
          estimate: false,
        },
      ],
      totalText: null,
      note: "Sets you already logged keep what they were.",
      link: null,
      undo: "available",
      undoneSub: "Put back Cable crunch, on the cable, for abs",
    });
  });

  it("should draw a row for each field that changed and none for one that did not", () => {
    const draft = buildExerciseUpdatedCard({
      before: cableCrunch,
      after: { ...cableCrunch, equipment: "machine" },
    });

    expect(draft.rows.map((row) => [row.name, row.amountText])).toEqual([
      ["Equipment", "Machine · was Cable"],
    ]);
  });

  it("should draw the muscles row when only a role changed", () => {
    const draft = buildExerciseUpdatedCard({
      before: kneelingCableCrunch,
      after: {
        ...kneelingCableCrunch,
        muscles: [
          { muscle_id: "abs", role: "primary" },
          { muscle_id: "obliques", role: "primary" },
        ],
      },
    });

    expect(draft.rows.map((row) => row.name)).toEqual(["Muscles"]);
  });

  it("should put the previous equipment and muscles in the line shown once undone", () => {
    const draft = buildExerciseUpdatedCard({
      before: { ...kneelingCableCrunch, equipment: "dumbbell" },
      after: cableCrunch,
    });

    expect(draft.undoneSub).toBe(
      "Put back Kneeling cable crunch, with dumbbells, for abs, obliques",
    );
  });
});

describe("buildExerciseArchivedCard", () => {
  it("should build the board's card for Cable crunch", () => {
    const draft = buildExerciseArchivedCard({ name: "Cable crunch" });

    expect(assistantCardSchema.parse(withActionIds(draft, actionIds))).toEqual({
      actionIds,
      kind: "exercise_archived",
      title: "Archived exercise Cable crunch",
      sub: "Sets you logged with it stay in your history",
      rows: [],
      totalText: null,
      note: null,
      link: null,
      undo: "available",
      undoneSub: "Cable crunch is back in your exercises",
    });
  });
});

describe("the archive confirmation", () => {
  it("should word the question as the ticket gives it", () => {
    expect(confirmArchiveExerciseQuestion("Cable crunch")).toBe(
      "Archive Cable crunch? It leaves your exercise list. Sets you logged with it stay in your history.",
    );
  });

  it("should have the buttons the board draws", () => {
    expect(confirmArchiveExerciseButtons()).toEqual({
      confirmLabel: "Archive exercise",
      cancelLabel: "Keep it",
    });
  });
});
