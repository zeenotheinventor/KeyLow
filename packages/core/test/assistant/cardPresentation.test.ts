import { describe, expect, it } from "vitest";

import {
  deletedCard,
  dayCopiedCard,
  foodCreatedCard,
  loggedCard,
  recipeCreatedCard,
  recipeImportCard,
  recipeUnresolvedCard,
  targetsChangedCard,
  undoUnavailableCard,
} from "./cardFixtures";
import { describeAssistantCard, undoOutcomeOfResults } from "../../src/assistant";

import type { AssistantCard, AssistantCardKind } from "../../src/assistant";

describe("describeAssistantCard, the icon of each kind", () => {
  it.each([
    ["the logged card", loggedCard, "Check", "success"],
    ["the day copied card", dayCopiedCard, "Copy", "secondary"],
    ["the recipe created card", recipeCreatedCard, "ChefHat", "success"],
    ["the food created card", foodCreatedCard, "Apple", "success"],
    ["the targets changed card", targetsChangedCard, "Target", "secondary"],
    ["the deleted card", deletedCard, "Trash2", "secondary"],
  ] as const)("should give %s its board's icon and tone", (_name, card, icon, tone) => {
    expect(describeAssistantCard(card)).toMatchObject({ icon, iconTone: tone });
  });

  it("should give every kind of card an icon", () => {
    const kinds: AssistantCardKind[] = [
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
    ];

    expect(kinds.map((kind) => describeAssistantCard({ ...loggedCard, kind }).icon)).not.toContain(
      undefined,
    );
  });
});

describe("describeAssistantCard, a card with Undo", () => {
  it("should word the logged card exactly as it was sent, the amount and the time joined", () => {
    const look = describeAssistantCard(loggedCard);

    expect(look).toMatchObject({
      title: "Logged 2 eggs and toast at 08:10",
      subtitle: null,
      total: "232 kcal · P 15 g · C 17 g · F 10 g",
      note: null,
      link: null,
      undo: { state: "available", label: "Undo" },
    });
    expect(look.rows).toEqual([
      { name: "Egg, boiled", detail: "2 large eggs (100 g) · 08:10", value: "144 kcal" },
      { name: "Toast, white bread", detail: "1 slice (30 g) · 08:10", value: "88 kcal" },
    ]);
  });

  it("should word the day copied card with the day and its total as the sub and no rows", () => {
    expect(describeAssistantCard(dayCopiedCard)).toMatchObject({
      title: "Copied 8 entries from yesterday",
      subtitle: "Saturday 24 October to today · 1,940 kcal",
      rows: [],
    });
  });

  it("should word the food created card with its row, note and link", () => {
    const look = describeAssistantCard(foodCreatedCard);

    expect(look.rows).toEqual([
      { name: "Per bar", detail: "P 20 g · C 19 g · F 6 g", value: "210 kcal" },
    ]);
    expect(look).toMatchObject({
      title: "Added food My protein bar",
      subtitle: "Yours · 1 bar",
      note: "Not logged yet. Say when you had it, or log it from search.",
      link: { label: "Open in your foods" },
    });
  });

  it("should keep the link of a recipe card", () => {
    expect(describeAssistantCard(recipeCreatedCard).link).toEqual(recipeCreatedCard.link);
  });

  it("should word a matched import line with the food it matched and a tick", () => {
    const [first] = describeAssistantCard(recipeImportCard).rows;

    expect(first).toEqual({
      name: "800 g chicken thighs, skinless",
      detail: "Chicken, thigh, skinless, raw · UK CoFID",
      match: "matched",
      matchLabel: "Matched",
    });
  });

  it("should mark the Estimate on the line the import guessed and on no other", () => {
    const rows = describeAssistantCard(recipeImportCard).rows;

    expect(rows.flatMap((row) => (row.estimateLabel === undefined ? [] : [row.name]))).toEqual([
      "A splash of milk",
    ]);
    expect(rows.find((row) => row.name === "A splash of milk")?.estimateLabel).toBe("Estimate");
  });

  it("should mark no Estimate on a logged card", () => {
    expect(
      describeAssistantCard(loggedCard).rows.every((row) => row.estimateLabel === undefined),
    ).toBe(true);
  });

  it("should word an unresolved import line as not matched", () => {
    const wine = describeAssistantCard(recipeUnresolvedCard).rows.at(-1);

    expect(wine).toEqual({
      name: "A splash of white wine",
      detail: "Not counted. Choose a food in the recipe editor.",
      match: "unresolved",
      matchLabel: "Not matched",
    });
  });
});

describe("describeAssistantCard, an undone card", () => {
  const undone: AssistantCard = { ...loggedCard, undo: "undone" };

  it("should draw Undone with the undone line under it and nothing else of the card", () => {
    expect(describeAssistantCard(undone)).toEqual({
      icon: "RotateCcw",
      iconTone: "muted",
      title: "Undone",
      subtitle: "Removed 2 eggs and toast from 08:10",
      rows: [],
      total: null,
      note: null,
      link: null,
      undo: { state: "done", label: "Undone" },
    });
  });

  it("should drop the link to a recipe, which Undo archives", () => {
    expect(describeAssistantCard({ ...recipeCreatedCard, undo: "undone" }).link).toBeNull();
  });

  it("should drop the link that opens a recipe's add-ingredient search", () => {
    expect(describeAssistantCard({ ...recipeUnresolvedCard, undo: "undone" }).link).toBeNull();
  });

  it("should drop the link to a food, which Undo deletes", () => {
    expect(describeAssistantCard({ ...foodCreatedCard, undo: "undone" }).link).toBeNull();
  });

  it("should keep a link to a day of the diary, which Undo leaves", () => {
    const link = {
      label: "Open the day",
      target: { screen: "diary_day", localDate: "2026-10-25" },
    } as const;

    expect(describeAssistantCard({ ...dayCopiedCard, link, undo: "undone" }).link).toEqual(link);
  });

  it("should drop the link as soon as an Undo has come back undone", () => {
    expect(describeAssistantCard(recipeCreatedCard).link).toEqual(recipeCreatedCard.link);
    expect(describeAssistantCard(recipeCreatedCard, "undone").link).toBeNull();
  });

  it("should draw no line under Undone when the card has none", () => {
    expect(describeAssistantCard({ ...undone, undoneSub: null }).subtitle).toBeNull();
  });

  it("should take an undo that has just run as the card's state", () => {
    expect(describeAssistantCard(loggedCard, "undone")).toEqual(describeAssistantCard(undone));
  });
});

describe("describeAssistantCard, a card that cannot be undone", () => {
  it("should draw Can't undo with the card's own note", () => {
    const look = describeAssistantCard(undoUnavailableCard);

    expect(look).toMatchObject({
      title: "Logged 2 eggs and toast at 08:10",
      note: "You changed these entries in your diary since, so Undo is off. Edit or delete them in the diary.",
      undo: { state: "unavailable", label: "Can't undo" },
    });
    expect(look.rows).toHaveLength(2);
  });

  it("should word the diary entries note when a logged card has none, as the board does", () => {
    expect(describeAssistantCard({ ...loggedCard, undo: "unavailable" }).note).toBe(
      undoUnavailableCard.note,
    );
  });

  it("should word the same note for a copied day", () => {
    expect(describeAssistantCard({ ...dayCopiedCard, undo: "unavailable" }).note).toBe(
      undoUnavailableCard.note,
    );
  });

  it("should leave a card of another kind with only the note it was sent", () => {
    expect(
      describeAssistantCard({ ...foodCreatedCard, undo: "unavailable", note: null }).note,
    ).toBe(null);
  });

  it("should take an undo that has just been refused as the card's state", () => {
    expect(describeAssistantCard(loggedCard, "unavailable").undo).toEqual({
      state: "unavailable",
      label: "Can't undo",
    });
  });

  it("should not let a result that has just come back change a card read back as undone", () => {
    expect(describeAssistantCard({ ...loggedCard, undo: "undone" }, "unavailable").title).toBe(
      "Undone",
    );
  });
});

describe("undoOutcomeOfResults", () => {
  it.each([
    [["undone"], "undone"],
    [["already_undone"], "undone"],
    [["undone", "already_undone"], "undone"],
    [["undo_unavailable"], "unavailable"],
    [["not_found"], "unavailable"],
    [["undone", "undo_unavailable"], "unavailable"],
    [[], "unavailable"],
  ] as const)("should read %j as %s", (results, outcome) => {
    expect(undoOutcomeOfResults(results)).toBe(outcome);
  });
});
