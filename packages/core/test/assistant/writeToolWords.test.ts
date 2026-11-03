import { describe, expect, it } from "vitest";

import { loggedCard } from "./cardFixtures";
import {
  buildLoggedCard,
  cardEntryOfRow,
  describeAssistantChange,
  mergeAssistantCards,
  withActionIds,
} from "../../src/assistant";
import { buildLogEntry } from "../../src/diary";
import { buildFood, buildFoodPortion } from "../../src/testing";

import type { AssistantChangeTarget, CardEntry } from "../../src/assistant";

const secondActionId = "00000000-0000-4000-8000-0000000000d3";

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
    const ids: [string, string] = [
      "00000000-0000-4000-8000-0000000000d1",
      "00000000-0000-4000-8000-0000000000d2",
    ];
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

function mustEntry(row: unknown): CardEntry {
  const entry = cardEntryOfRow(row, "UTC");
  if (entry === null) {
    throw new Error("The fixture row is not an entry");
  }
  return entry;
}
