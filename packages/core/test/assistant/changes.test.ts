import { describe, expect, it } from "vitest";

import { assistantChangesFromActions } from "../../src/assistant";

import type {
  AssistantChangeAction,
  AssistantChangeInput,
  AssistantChangeTarget,
} from "../../src/assistant";

// The five actions of `assistant-settings · changes`, in the order the cards were made. "Now" is
// Tuesday 27 October 2026, 14:00 in London (GMT, so the same hour in UTC).
const now = new Date("2026-10-27T14:00:00Z");
const timeZone = "Europe/London";

const turn = (number: number) => `00000000-0000-4000-8000-00000000000${number}`;

let counter = 0;
const action = (overrides: Partial<AssistantChangeAction>): AssistantChangeAction => {
  counter += 1;
  return {
    id: `00000000-0000-4000-8000-0000000001${String(counter).padStart(2, "0")}`,
    turnId: turn(1),
    tool: "log_entry",
    turnSeq: 1,
    createdAt: "2026-10-27T08:11:00Z",
    hasTarget: true,
    undoneAt: null,
    targetUpdatedAt: null,
    targets: null,
    targetIds: [],
    ...overrides,
  };
};

const eggs = action({ turnId: turn(1), tool: "log_entry", createdAt: "2026-10-27T08:11:00Z" });
const toast = action({ turnId: turn(1), tool: "log_entry", createdAt: "2026-10-27T08:11:01Z" });
const recipe = action({
  turnId: turn(2),
  tool: "create_recipe",
  createdAt: "2026-10-27T09:42:00Z",
});
const copied = action({
  turnId: turn(3),
  tool: "copy_day",
  createdAt: "2026-10-27T12:30:00Z",
  undoneAt: "2026-10-27T12:31:00Z",
});
const archived = action({
  turnId: turn(4),
  tool: "archive_recipe",
  createdAt: "2026-10-26T19:05:00Z",
});
const flatWhite = action({
  turnId: turn(5),
  tool: "log_entry",
  createdAt: "2026-10-26T07:31:00Z",
  targetUpdatedAt: "2026-10-26T07:31:00Z",
  targets: [{ found: true, updatedAt: "2026-10-26T10:00:00Z" }],
});

const boardActions = [eggs, toast, recipe, copied, archived, flatWhite];

describe("assistantChangesFromActions, the changes board", () => {
  const changes = assistantChangesFromActions(boardActions, { now, timeZone, targets: [] });

  it("should group by day, newest first, as Today then Yesterday", () => {
    expect(changes.days.map((day) => [day.label, day.rows.length])).toEqual([
      ["Today", 3],
      ["Yesterday", 2],
    ]);
  });

  it("should give one row per turn and tool, newest first, with the action ids oldest first", () => {
    expect(changes.days[0]?.rows.map((row) => row.actionIds)).toEqual([
      [copied.id],
      [recipe.id],
      [eggs.id, toast.id],
    ]);
  });

  it("should give the row's state as undo, undone or cant_undo", () => {
    expect(changes.days.flatMap((day) => day.rows.map((row) => row.state))).toEqual([
      "undone",
      "undo",
      "undo",
      "undo",
      "cant_undo",
    ]);
  });

  it("should count the rows", () => {
    expect(changes.count).toBe(5);
  });

  it("should word a row by its plain title when no target rows are given, with the time under it", () => {
    expect(changes.days[0]?.rows[2]).toMatchObject({
      title: "Logged 2 entries",
      sub: "08:11",
    });
  });

  it("should say the target changed on a row that cannot be undone because of it", () => {
    expect(changes.days[1]?.rows[1]).toMatchObject({
      title: "Logged 1 entry",
      sub: "07:31 · changed in your diary since",
      state: "cant_undo",
    });
  });

  it("should give each row a key that is its first action id", () => {
    expect(changes.days[0]?.rows.map((row) => row.key)).toEqual([copied.id, recipe.id, eggs.id]);
  });
});

describe("assistantChangesFromActions, the days", () => {
  it("should write a day before yesterday as the diary writes it", () => {
    const older = action({ turnId: turn(6), createdAt: "2026-10-23T10:00:00Z" });

    const changes = assistantChangesFromActions([older], { now, timeZone, targets: [] });

    expect(changes.days.map((day) => day.label)).toEqual(["Fri 23 Oct"]);
  });

  it("should read the day and the time in the person's time zone", () => {
    const lateEvening = action({ turnId: turn(6), createdAt: "2026-10-26T23:30:00Z" });

    const changes = assistantChangesFromActions([lateEvening], {
      now: new Date("2026-10-27T01:00:00Z"),
      timeZone: "Pacific/Auckland",
      targets: [],
    });

    expect(changes.days[0]).toMatchObject({
      label: "Today",
      rows: [{ sub: "12:30" }],
    });
  });

  it("should be empty with a count of 0 when there are no actions", () => {
    expect(assistantChangesFromActions([], { now, timeZone, targets: [] })).toEqual({
      days: [],
      count: 0,
    });
  });
});

describe("assistantChangesFromActions, the state of a row", () => {
  const stateOf = (change: AssistantChangeAction) =>
    assistantChangesFromActions([change], { now, timeZone, targets: [] }).days[0]?.rows[0]?.state;

  it("should be undo while the targets are as the write left them", () => {
    const untouched = action({
      targetUpdatedAt: "2026-10-27T08:11:00Z",
      targets: [{ found: true, updatedAt: "2026-10-27T08:11:00Z" }],
    });

    expect(stateOf(untouched)).toBe("undo");
  });

  it("should be cant_undo when a target is gone", () => {
    expect(stateOf(action({ targets: [{ found: false, updatedAt: null }] }))).toBe("cant_undo");
  });

  it.each(["update_entry", "update_recipe"])(
    "should be cant_undo for %s, which has no Undo",
    (tool) => {
      expect(stateOf(action({ tool }))).toBe("cant_undo");
    },
  );

  it("should stay undone when the target changed after the undo", () => {
    const undone = action({
      undoneAt: "2026-10-27T09:00:00Z",
      targets: [{ found: false, updatedAt: null }],
    });

    expect(stateOf(undone)).toBe("undone");
  });

  it("should be undo while one action of a row is still undoable", () => {
    const first = action({ turnId: turn(7), undoneAt: "2026-10-27T09:00:00Z" });
    const second = action({ turnId: turn(7), createdAt: "2026-10-27T08:11:01Z" });

    const changes = assistantChangesFromActions([first, second], { now, timeZone, targets: [] });

    expect(changes.days[0]?.rows).toMatchObject([{ state: "undo" }]);
  });
});

describe("assistantChangesFromActions, the grouping", () => {
  it("should keep two runs of one tool apart when another tool's write came between them", () => {
    const first = action({ turnId: turn(8), tool: "log_entry", createdAt: "2026-10-27T08:00:00Z" });
    const between = action({
      turnId: turn(8),
      tool: "delete_entry",
      createdAt: "2026-10-27T08:00:01Z",
    });
    const last = action({ turnId: turn(8), tool: "log_entry", createdAt: "2026-10-27T08:00:02Z" });

    const changes = assistantChangesFromActions([first, between, last], {
      now,
      timeZone,
      targets: [],
    });

    expect(changes.days[0]?.rows.map((row) => row.actionIds)).toEqual([
      [last.id],
      [between.id],
      [first.id],
    ]);
  });

  it("should group the actions of a deleted conversation by tool when they were made seconds apart", () => {
    const first = action({ turnId: null, createdAt: "2026-10-27T08:00:00Z" });
    const second = action({ turnId: null, createdAt: "2026-10-27T08:00:20Z" });
    const later = action({ turnId: null, createdAt: "2026-10-27T08:05:00Z" });

    const changes = assistantChangesFromActions([first, second, later], {
      now,
      timeZone,
      targets: [],
    });

    expect(changes.days[0]?.rows.map((row) => row.actionIds)).toEqual([
      [later.id],
      [first.id, second.id],
    ]);
  });
});

describe("assistantChangesFromActions, the target rows", () => {
  it("should hand the tool's words the group's actions and only the target rows its actions name", () => {
    const entry = action({ tool: "log_entry", targetIds: ["entry-1", "entry-2"] });
    const targets: AssistantChangeTarget[] = [
      { id: "entry-1", row: { name: "Egg" } },
      { id: "entry-3", row: { name: "Other" } },
    ];
    const asked: AssistantChangeInput[] = [];

    assistantChangesFromActions([entry], {
      now,
      timeZone,
      targets,
      describeChange: (input) => {
        asked.push(input);
        return { title: "Logged an egg", detail: "1 entry" };
      },
    });

    expect(asked).toEqual([{ tool: "log_entry", actionCount: 1, targets: [targets[0]] }]);
  });

  it("should use the title and detail the tool's words give", () => {
    const changes = assistantChangesFromActions([action({})], {
      now,
      timeZone,
      targets: [],
      describeChange: () => ({ title: "Logged an egg", detail: "1 entry" }),
    });

    expect(changes.days[0]?.rows[0]).toMatchObject({
      title: "Logged an egg",
      sub: "08:11 · 1 entry",
    });
  });
});

describe("assistantChangesFromActions, the size of a card", () => {
  const seconds = (count: number) =>
    new Date(Date.parse("2026-10-27T08:00:00Z") + count * 1000).toISOString();

  it("should anchor the window to the card's newest write and not to the one before it", () => {
    const writes = [0, 40, 80].map((offset) =>
      action({ turnId: null, createdAt: seconds(offset) }),
    );

    const changes = assistantChangesFromActions(writes, { now, timeZone, targets: [] });

    expect(changes.days[0]?.rows.map((row) => row.actionIds.length)).toEqual([2, 1]);
  });

  it("should end a card at 10 writes, so a chain of 11 makes two", () => {
    const writes = Array.from({ length: 11 }, (_, index) =>
      action({ turnId: null, createdAt: seconds(index) }),
    );

    const changes = assistantChangesFromActions(writes, { now, timeZone, targets: [] });

    expect(changes.days[0]?.rows.map((row) => row.actionIds.length)).toEqual([10, 1]);
  });
});

describe("assistantChangesFromActions, the order and the days", () => {
  it("should order writes made in the same instant by their slot in the turn", () => {
    const first = action({ turnSeq: 1, createdAt: "2026-10-27T08:00:00Z" });
    const second = action({ turnSeq: 2, createdAt: "2026-10-27T08:00:00Z" });

    const changes = assistantChangesFromActions([second, first], { now, timeZone, targets: [] });

    expect(changes.days[0]?.rows[0]?.actionIds).toEqual([first.id, second.id]);
  });

  it("should label a write dated after now as Today", () => {
    const ahead = action({ createdAt: "2026-10-27T14:00:30Z" });
    const nextDay = action({ turnId: turn(9), createdAt: "2026-10-28T09:00:00Z" });

    const changes = assistantChangesFromActions([ahead, nextDay], { now, timeZone, targets: [] });

    expect(changes.days.map((day) => [day.label, day.rows.length])).toEqual([["Today", 2]]);
  });

  it("should show an action that never landed as cant_undo", () => {
    const reserved = action({ hasTarget: false, targets: null });

    const changes = assistantChangesFromActions([reserved], { now, timeZone, targets: [] });

    expect(changes.days[0]?.rows[0]).toMatchObject({ state: "cant_undo", sub: "08:11" });
  });
});
