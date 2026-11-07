import { describe, expect, it } from "vitest";

import { loggedCard } from "./cardFixtures";
import { routineCreatedCard, routineUpdatedCard } from "./trainingCardFixtures";
import {
  ASSISTANT_TOOLS_NEEDING_STORED_UNDO,
  ASSISTANT_WRITE_TOOL_CARD_KINDS,
  buildLoggedCard,
  buildRecipeArchivedCard,
  buildRecipeCreatedCard,
  buildRecipeUpdatedCard,
  cardEntryOfRow,
  describeAssistantChange,
  isAssistantWriteTool,
  mergeAssistantCards,
  withActionIds,
} from "../../src/assistant";
import { buildLogEntry } from "../../src/diary";
import { buildFood, buildFoodPortion } from "../../src/testing";

import type { AssistantChangeTarget, CardEntry } from "../../src/assistant";

const secondActionId = "00000000-0000-4000-8000-0000000000d3";
const ids: [string, string] = [
  "00000000-0000-4000-8000-0000000000d1",
  "00000000-0000-4000-8000-0000000000d2",
];

describe("describeAssistantChange", () => {
  it.each([
    ["log_entry", 1, "Logged 1 entry"],
    ["log_entry", 2, "Logged 2 entries"],
    ["update_entry", 1, "Updated 1 entry"],
    ["update_entry", 3, "Updated 3 entries"],
    ["delete_entry", 1, "Deleted 1 entry"],
    ["delete_entry", 3, "Deleted 3 entries"],
    ["copy_day", 1, "Copied a day"],
    ["set_day_complete", 1, "Changed whether a day is complete"],
    ["create_recipe", 1, "Added a recipe"],
    ["import_recipe_from_url", 1, "Added a recipe"],
    ["update_recipe", 1, "Updated a recipe"],
    ["archive_recipe", 1, "Archived a recipe"],
    ["create_custom_food", 1, "Added a food"],
    ["update_targets", 1, "Changed your targets"],
  ])("should word %s with %i action(s) as the plain title %s", (tool, actionCount, title) => {
    expect(describeAssistantChange({ tool, actionCount, targets: [] })).toEqual({
      title,
      detail: null,
    });
  });

  it("should word a copied day by the entries its rows still hold, and plainly once they are gone", () => {
    const rows: AssistantChangeTarget[] = ["a", "b", "c"].map((id) => ({
      id,
      row: { id, item_type: "quick" },
    }));
    const copied = (targets: AssistantChangeTarget[]) =>
      describeAssistantChange({ tool: "copy_day", actionCount: 1, targets });

    expect(copied(rows)).toEqual({ title: "Copied 3 entries", detail: null });
    expect(copied(rows.slice(0, 1))).toEqual({ title: "Copied 1 entry", detail: null });
    expect(copied([{ id: "a", row: null }])).toEqual({ title: "Copied a day", detail: null });
  });

  it("should word a tool it does not know as a plain change", () => {
    expect(describeAssistantChange({ tool: "tidy_diary", actionCount: 1, targets: [] })).toEqual({
      title: "Made a change",
      detail: null,
    });
  });

  it("should give the same plain title whether the target rows still exist or not", () => {
    const gone = [{ id: "a", row: null }];
    const present = [{ id: "a", row: { name: "Flat white" } }];

    expect(describeAssistantChange({ tool: "log_entry", actionCount: 1, targets: gone })).toEqual(
      describeAssistantChange({ tool: "log_entry", actionCount: 1, targets: present }),
    );
  });
});

describe("mergeAssistantCards", () => {
  const second = {
    ...loggedCard,
    actionIds: [secondActionId],
    rows: loggedCard.rows.slice(0, 1).map((row) => ({ ...row, name: "Coffee" })),
  };

  it("should answer a single card unchanged", () => {
    expect(mergeAssistantCards([loggedCard])).toEqual(loggedCard);
  });

  it("should join the action ids and append the rows, in call order", () => {
    const merged = mergeAssistantCards([loggedCard, second]);

    expect(merged.actionIds).toEqual([...loggedCard.actionIds, secondActionId]);
    expect(merged.rows.map((row) => row.name)).toEqual([
      "Egg, boiled",
      "Toast, white bread",
      "Coffee",
    ]);
  });

  it("should fall back to the plain title and drop the lines of a kind with no merger of its own", () => {
    const copied = { ...loggedCard, kind: "day_copied" as const };
    const merged = mergeAssistantCards([copied, { ...second, kind: "day_copied" as const }]);

    expect(merged).toMatchObject({
      kind: "day_copied",
      title: "Copied a day",
      sub: null,
      totalText: null,
      note: null,
      link: null,
      undoneSub: null,
    });
  });
});

describe("the log_entry words", () => {
  const stored = (id: string, insert: object, clockTime: string) => ({
    id,
    clock_time: clockTime,
    created_at: "2026-11-03T08:11:00+00:00",
    kcal: 1,
    ...insert,
  });
  const eggs = stored(
    "00000000-0000-4000-8000-0000000000c1",
    buildLogEntry({
      food: buildFood({
        name: "Egg, boiled",
        kcal: 144,
        protein_g: 12.6,
        carbs_g: 0.8,
        fat_g: 9.5,
      }),
      quantity: 2,
      unit: "portion",
      portion: buildFoodPortion({ label: "large egg", grams: 50 }),
      loggedAt: "2026-11-03T08:10:00.000Z",
      localDate: "2026-11-03",
    }),
    "08:10",
  );
  const toast = stored(
    "00000000-0000-4000-8000-0000000000c2",
    buildLogEntry({
      food: buildFood({
        name: "Toast, white bread",
        kcal: 293.3333,
        protein_g: 9.3333,
        carbs_g: 54.6667,
        fat_g: 3,
      }),
      quantity: 1,
      unit: "portion",
      portion: buildFoodPortion({ label: "slice", grams: 30 }),
      loggedAt: "2026-11-03T08:10:00.000Z",
      localDate: "2026-11-03",
    }),
    "08:10",
  );

  it("should word a change by the entries it wrote, as the changes board does", () => {
    expect(
      describeAssistantChange({
        tool: "log_entry",
        actionCount: 2,
        targets: [
          { id: eggs.id, row: eggs },
          { id: toast.id, row: toast },
        ],
      }),
    ).toEqual({ title: "Logged 2 eggs and toast at 08:10", detail: "2 entries" });
  });

  it("should give a single entry no detail, and fall back to the plain title for a row that is gone", () => {
    expect(
      describeAssistantChange({
        tool: "log_entry",
        actionCount: 1,
        targets: [{ id: toast.id, row: toast }],
      }),
    ).toEqual({ title: "Logged toast at 08:10", detail: null });
    expect(
      describeAssistantChange({
        tool: "log_entry",
        actionCount: 1,
        targets: [{ id: toast.id, row: null }],
      }),
    ).toEqual({ title: "Logged 1 entry", detail: null });
  });

  it("should merge the cards of two calls into the board's one card", () => {
    const merged = mergeAssistantCards([
      withActionIds(buildLoggedCard([mustEntry(eggs)]), [ids[0]]),
      withActionIds(buildLoggedCard([mustEntry(toast)]), [ids[1]]),
    ]);

    expect(merged).toMatchObject({
      kind: "logged",
      actionIds: ids,
      title: "Logged 2 eggs and toast at 08:10",
      undoneSub: "Removed 2 eggs and toast from 08:10",
    });
    expect(merged.rows.map((row) => row.name)).toEqual(["Egg, boiled", "Toast, white bread"]);
    // The eggs printed P 13 g (12.6 rounded), so the sum of the printed figures is P 16 g where the board
    // adds the unrounded entries and prints P 15 g. The other figures agree with the board.
    expect(merged.totalText).toBe("232 kcal · P 16 g · C 17 g · F 10 g");
  });
});

describe("the recipe words", () => {
  const rowOf = (id: string, name: string, servings: number): AssistantChangeTarget => ({
    id,
    row: { id, name, servings, is_archived: false },
  });
  const pastaBake = rowOf("a", "Pasta bake", 4);
  const changed = (tool: string, targets: AssistantChangeTarget[]) =>
    describeAssistantChange({ tool, actionCount: targets.length, targets });

  it("should word a created recipe with its servings under it, as the changes board does", () => {
    expect(changed("create_recipe", [pastaBake])).toEqual({
      title: "Added recipe Pasta bake",
      detail: "4 servings",
    });
    expect(changed("create_recipe", [rowOf("a", "Porridge", 1)])).toEqual({
      title: "Added recipe Porridge",
      detail: "1 serving",
    });
  });

  it("should word an imported recipe as a created one, because it makes the same row", () => {
    expect(changed("import_recipe_from_url", [pastaBake])).toEqual({
      title: "Added recipe Pasta bake",
      detail: "4 servings",
    });
  });

  it("should word an archived and an updated recipe by its name", () => {
    expect(changed("archive_recipe", [pastaBake])).toEqual({
      title: "Archived recipe Pasta bake",
      detail: null,
    });
    expect(changed("update_recipe", [pastaBake])).toEqual({
      title: "Updated recipe Pasta bake",
      detail: null,
    });
  });

  it("should count the recipes when one row groups several calls", () => {
    const two = [pastaBake, rowOf("b", "Chilli", 6)];

    expect(changed("create_recipe", two)).toEqual({ title: "Added 2 recipes", detail: null });
    expect(changed("archive_recipe", two)).toEqual({ title: "Archived 2 recipes", detail: null });
  });

  it("should word a recipe that is gone, or a row it cannot read, plainly", () => {
    expect(changed("create_recipe", [{ id: "a", row: null }])).toEqual({
      title: "Added a recipe",
      detail: null,
    });
    expect(changed("archive_recipe", [{ id: "a", row: { id: "a" } }])).toEqual({
      title: "Archived a recipe",
      detail: null,
    });
    expect(describeAssistantChange({ tool: "update_recipe", actionCount: 1, targets: [] })).toEqual(
      {
        title: "Updated a recipe",
        detail: null,
      },
    );
  });

  describe("when a turn makes several recipe cards", () => {
    const recipe = (id: string, name: string, actionId: string) => ({
      id,
      name,
      servings: 4,
      perServing: { kcal: 500, protein_g: 30, carbs_g: 50, fat_g: 10 },
      actionId,
    });
    const first = recipe("00000000-0000-4000-8000-0000000000e1", "Chilli", ids[0]);
    const second = recipe("00000000-0000-4000-8000-0000000000e2", "Pasta bake", ids[1]);

    it("should merge created recipes into one card that archives them all", () => {
      const merged = mergeAssistantCards([
        withActionIds(buildRecipeCreatedCard(first), [first.actionId]),
        withActionIds(buildRecipeCreatedCard(second), [second.actionId]),
      ]);

      expect(merged).toMatchObject({
        kind: "recipe_created",
        actionIds: ids,
        title: "Added 2 recipes",
        sub: null,
        link: null,
        undo: "available",
        undoneSub: "Archived 2 recipes",
      });
    });

    it("should merge archived recipes into one card that restores them all", () => {
      const merged = mergeAssistantCards([
        withActionIds(buildRecipeArchivedCard(first), [first.actionId]),
        withActionIds(buildRecipeArchivedCard(second), [second.actionId]),
      ]);

      expect(merged).toMatchObject({
        kind: "recipe_archived",
        title: "Archived 2 recipes",
        undoneSub: "Restored 2 recipes",
      });
    });

    it("should merge updated recipes into one card that still says Undo is off", () => {
      const merged = mergeAssistantCards([
        withActionIds(buildRecipeUpdatedCard(first), [first.actionId]),
        withActionIds(buildRecipeUpdatedCard(second), [second.actionId]),
      ]);

      expect(merged).toMatchObject({
        kind: "recipe_updated",
        title: "Updated 2 recipes",
        note: "Undo is off for changes. Edit it again in the recipe editor.",
        link: null,
        undo: "unavailable",
      });
    });
  });
});

function mustEntry(row: unknown): CardEntry {
  const entry = cardEntryOfRow(row, "UTC");
  if (entry === null) {
    throw new Error("The fixture row is not an entry");
  }
  return entry;
}

describe("the training tools", () => {
  it.each([
    ["edit_routine", "routine_updated", "Updated a routine"],
    ["set_active_routine", "routine_active", "Changed your active routine"],
    ["archive_routine", "routine_archived", "Archived a routine"],
    ["create_routine", "routine_created", "Built a routine"],
    ["update_training_goals", "goals_updated", "Updated your training goals"],
    ["save_custom_exercise", "exercise_created", "Added an exercise"],
    ["archive_custom_exercise", "exercise_archived", "Archived an exercise"],
    ["update_past_set", "set_updated", "Changed a set"],
    ["delete_workout", "workout_deleted", "Deleted a workout"],
  ] as const)(
    "should build a %s card of the kind %s, worded plainly as '%s'",
    (tool, kind, title) => {
      expect(isAssistantWriteTool(tool)).toBe(true);
      expect(ASSISTANT_WRITE_TOOL_CARD_KINDS[tool]).toBe(kind);
      expect(describeAssistantChange({ tool, actionCount: 1, targets: [] })).toEqual({
        title,
        detail: null,
      });
    },
  );

  it("should word a merged card of an exercise that was updated plainly", () => {
    const [first] = [routineUpdatedCard];
    const merged = mergeAssistantCards([
      { ...first, kind: "exercise_updated" },
      { ...first, kind: "exercise_updated", actionIds: [secondActionId] },
    ]);

    expect(merged.title).toBe("Updated an exercise");
  });

  it("should drop the days and the change detail of a card merged with another", () => {
    const merged = mergeAssistantCards([
      routineCreatedCard,
      { ...routineCreatedCard, actionIds: [secondActionId] },
    ]);

    expect(merged.days ?? null).toBeNull();
    expect(merged.changeDetail ?? null).toBeNull();
  });
});

describe("ASSISTANT_TOOLS_NEEDING_STORED_UNDO", () => {
  it("should name the training writes whose Undo reads the value their turn stored", () => {
    expect([...ASSISTANT_TOOLS_NEEDING_STORED_UNDO].sort()).toEqual([
      "create_routine",
      "edit_routine",
      "save_custom_exercise",
      "set_active_routine",
      "update_past_set",
    ]);
  });

  it("should name write tools only, so a renamed tool cannot slip out of the set unnoticed", () => {
    expect([...ASSISTANT_TOOLS_NEEDING_STORED_UNDO].every(isAssistantWriteTool)).toBe(true);
  });

  it("should leave out the writes that undo from the row alone", () => {
    for (const tool of [
      "archive_routine",
      "archive_custom_exercise",
      "update_training_goals",
      "delete_workout",
    ]) {
      expect(ASSISTANT_TOOLS_NEEDING_STORED_UNDO.has(tool)).toBe(false);
    }
  });
});
