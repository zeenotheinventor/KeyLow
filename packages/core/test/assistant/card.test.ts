import { describe, expect, it } from "vitest";

import { cardBoards, dayCopiedCard, loggedCard, recipeImportCard } from "./cardFixtures";
import { assistantCardLinkSchema, assistantCardSchema } from "../../src/assistant";
import { collectStrings } from "../copy/collectStrings";

const recipeId = "00000000-0000-4000-8000-0000000000e1";

describe.each(cardBoards)("assistantCardSchema, the $board card", ({ card, boardStrings }) => {
  it("should parse", () => {
    expect(assistantCardSchema.parse(card)).toEqual(card);
  });

  it("should carry every string the board shows", () => {
    const parsedStrings = collectStrings(assistantCardSchema.parse(card));

    expect(boardStrings.filter((text) => !parsedStrings.includes(text))).toEqual([]);
  });
});

describe("assistantCardSchema, the Estimate flag", () => {
  it("should carry estimate true on the recipe line whose amount the import guessed", () => {
    const rows = assistantCardSchema.parse(recipeImportCard).rows;

    expect(rows.filter((row) => row.estimate).map((row) => row.name)).toEqual(["A splash of milk"]);
  });

  it("should send estimate false on every row of a logged card", () => {
    expect(assistantCardSchema.parse(loggedCard).rows.every((row) => !row.estimate)).toBe(true);
  });

  it("should reject a row without the estimate flag", () => {
    const rows = loggedCard.rows.map(({ estimate: _estimate, ...row }) => row);

    expect(assistantCardSchema.safeParse({ ...loggedCard, rows }).success).toBe(false);
  });
});

// Written out in full, so removing a value from the schema's enum fails here and adding one fails the
// "lists exactly" tests.
const cardKinds = [
  "logged",
  "updated",
  "deleted",
  "day_copied",
  "day_completed",
  "recipe_created",
  "recipe_updated",
  "recipe_archived",
  "food_created",
  "targets_changed",
  "routine_updated",
  "routine_active",
  "routine_archived",
  "routine_created",
  "goals_updated",
  "exercise_created",
  "exercise_updated",
  "exercise_archived",
  "set_updated",
  "workout_deleted",
  "feature_requested",
  "plan_created",
  "plan_day_replanned",
];
const undoStates = ["available", "undone", "unavailable"];

describe("assistantCardSchema, every kind", () => {
  it("should list exactly the kinds the plan lists", () => {
    expect(assistantCardSchema.shape.kind.options).toEqual(cardKinds);
  });

  it.each(cardKinds)("should parse a %s card", (kind) => {
    expect(assistantCardSchema.parse({ ...loggedCard, kind }).kind).toBe(kind);
  });
});

describe("assistantCardSchema, every undo state", () => {
  it("should list exactly the undo states the plan lists", () => {
    expect(assistantCardSchema.shape.undo.options).toEqual(undoStates);
  });

  it.each(undoStates)("should parse a card whose undo is %s", (undo) => {
    expect(assistantCardSchema.parse({ ...loggedCard, undo }).undo).toBe(undo);
  });
});

describe("assistantCardSchema, the undone line", () => {
  it("should parse null for a card that can never be undone, such as an edit", () => {
    const edit = { ...loggedCard, kind: "updated", undo: "unavailable", undoneSub: null };

    expect(assistantCardSchema.parse(edit)).toEqual(edit);
  });

  it("should parse the line for a card that can be undone", () => {
    expect(assistantCardSchema.parse(dayCopiedCard).undoneSub).toBe(dayCopiedCard.undoneSub);
  });

  it("should reject an empty undone line, which would draw a blank under Undone", () => {
    expect(assistantCardSchema.safeParse({ ...loggedCard, undoneSub: "" }).success).toBe(false);
  });
});

describe("assistantCardSchema, a row's match", () => {
  const matchOf = (match: string | null) =>
    assistantCardSchema.safeParse({
      ...recipeImportCard,
      rows: recipeImportCard.rows.map((row) => ({ ...row, match })),
    });

  it("should list exactly matched and unresolved", () => {
    expect(assistantCardSchema.shape.rows.element.shape.match.unwrap().options).toEqual([
      "matched",
      "unresolved",
    ]);
  });

  it.each(["matched", "unresolved", null])("should parse the match %s", (match) => {
    expect(matchOf(match).success).toBe(true);
  });

  it("should reject a match the plan does not list", () => {
    expect(matchOf("estimated").success).toBe(false);
  });
});

describe("assistantCardSchema, what it rejects", () => {
  it("should reject an extra key on the card", () => {
    expect(assistantCardSchema.safeParse({ ...loggedCard, kcal: 232 }).success).toBe(false);
  });

  it("should reject an extra key on a row", () => {
    const rows = loggedCard.rows.map((row) => ({ ...row, grams: 100 }));

    expect(assistantCardSchema.safeParse({ ...loggedCard, rows }).success).toBe(false);
  });

  it("should reject a row time that is not HH:MM", () => {
    const rows = loggedCard.rows.map((row) => ({ ...row, time: "8:10 am" }));

    expect(assistantCardSchema.safeParse({ ...loggedCard, rows }).success).toBe(false);
  });

  it("should reject a card that groups no write", () => {
    expect(assistantCardSchema.safeParse({ ...loggedCard, actionIds: [] }).success).toBe(false);
  });

  it("should reject a kind the plan does not list", () => {
    expect(assistantCardSchema.safeParse({ ...loggedCard, kind: "photo_logged" }).success).toBe(
      false,
    );
  });

  it("should reject an undo state the plan does not list", () => {
    expect(assistantCardSchema.safeParse({ ...loggedCard, undo: "expired" }).success).toBe(false);
  });

  it("should reject a card without its undone line", () => {
    const cardWithoutUndoneSub = Object.fromEntries(
      Object.entries(loggedCard).filter(([key]) => key !== "undoneSub"),
    );

    expect(assistantCardSchema.safeParse(cardWithoutUndoneSub).success).toBe(false);
  });
});

describe("assistantCardLinkSchema", () => {
  it.each([
    { screen: "recipe_editor", recipeId },
    { screen: "recipe_add_ingredient", recipeId, query: "white wine" },
    { screen: "own_food", foodId: recipeId },
    { screen: "diary_day", localDate: "2026-10-24" },
  ])("should parse a link to $screen", (target) => {
    const link = { label: "Open", target };

    expect(assistantCardLinkSchema.parse(link)).toEqual(link);
  });

  it("should reject a screen the plan does not list", () => {
    expect(
      assistantCardLinkSchema.safeParse({ label: "Open", target: { screen: "settings" } }).success,
    ).toBe(false);
  });

  it("should reject an add-ingredient link without the line's food word", () => {
    expect(
      assistantCardLinkSchema.safeParse({
        label: "Choose a food for the wine",
        target: { screen: "recipe_add_ingredient", recipeId },
      }).success,
    ).toBe(false);
  });

  it("should reject a diary day that is not YYYY-MM-DD", () => {
    expect(
      assistantCardLinkSchema.safeParse({
        label: "Open",
        target: { screen: "diary_day", localDate: "24 October" },
      }).success,
    ).toBe(false);
  });

  it.each([
    { screen: "recipe_editor", recipeId },
    { screen: "recipe_add_ingredient", recipeId, query: "white wine" },
    { screen: "own_food", foodId: recipeId },
    { screen: "diary_day", localDate: "2026-10-24" },
  ])("should reject an extra key on a link to $screen", (target) => {
    expect(
      assistantCardLinkSchema.safeParse({ label: "Open", target: { ...target, userId: recipeId } })
        .success,
    ).toBe(false);
  });

  it("should reject an extra key on the link itself", () => {
    expect(
      assistantCardLinkSchema.safeParse({
        label: "Open",
        target: { screen: "diary_day", localDate: "2026-10-24" },
        opensInBrowser: true,
      }).success,
    ).toBe(false);
  });
});
