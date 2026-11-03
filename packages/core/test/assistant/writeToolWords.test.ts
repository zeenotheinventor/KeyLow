import { describe, expect, it } from "vitest";

import { loggedCard } from "./cardFixtures";
import { describeAssistantChange, mergeAssistantCards } from "../../src/assistant";

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
    ["set_day_complete", 1, "Marked a day complete"],
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

  it("should fall back to the plain title and drop the lines that described only one call", () => {
    const merged = mergeAssistantCards([loggedCard, second]);

    expect(merged).toMatchObject({
      kind: "logged",
      title: "Logged 3 entries",
      sub: null,
      totalText: null,
      note: null,
      link: null,
      undoneSub: null,
    });
  });
});
