import { describe, expect, it } from "vitest";

import {
  ASSISTANT_CARD_KINDS_WITHOUT_UNDO,
  ASSISTANT_TOOLS_WITHOUT_UNDO,
  hasTargetChanged,
  undoStateOfActions,
} from "../../src/assistant";

import type { AssistantActionState } from "../../src/assistant";

const action = (overrides: Partial<AssistantActionState> = {}): AssistantActionState => ({
  id: "a1",
  hasTarget: true,
  undoneAt: null,
  targetUpdatedAt: "2026-10-27T08:11:00Z",
  targets: [{ found: true, updatedAt: "2026-10-27T08:11:00Z" }],
  ...overrides,
});

describe("hasTargetChanged", () => {
  it("should compare change times as instants, whatever way each side prints them", () => {
    const sameInstant = action({
      targets: [{ found: true, updatedAt: "2026-10-27T08:11:00.000+00:00" }],
    });

    expect(hasTargetChanged(sameInstant)).toBe(false);
  });

  it("should be changed when the target's time differs", () => {
    const edited = action({ targets: [{ found: true, updatedAt: "2026-10-27T09:00:00Z" }] });

    expect(hasTargetChanged(edited)).toBe(true);
  });

  it("should be changed when a target has no change time any more but the write left one", () => {
    expect(hasTargetChanged(action({ targets: [{ found: true, updatedAt: null }] }))).toBe(true);
  });

  it("should count only a missing target when the write recorded no change time", () => {
    const stamped = [{ found: true, updatedAt: "2026-10-27T09:00:00Z" }];

    expect(hasTargetChanged(action({ targetUpdatedAt: null, targets: stamped }))).toBe(false);
    expect(
      hasTargetChanged(
        action({ targetUpdatedAt: null, targets: [{ found: false, updatedAt: null }] }),
      ),
    ).toBe(true);
  });

  it("should say nothing changed when no change time is read for the table", () => {
    expect(hasTargetChanged(action({ targets: null }))).toBe(false);
  });
});

describe("undoStateOfActions", () => {
  it("should be unavailable for an action that never landed", () => {
    const reserved = action({ hasTarget: false, targets: null });

    expect(undoStateOfActions(["a1"], new Map([["a1", reserved]]))).toBe("unavailable");
  });
});

describe("the tools that can never be undone", () => {
  it("should be the two edits, and the kinds of their cards", () => {
    expect([...ASSISTANT_TOOLS_WITHOUT_UNDO]).toEqual(["update_entry", "update_recipe"]);
    expect([...ASSISTANT_CARD_KINDS_WITHOUT_UNDO]).toEqual(["updated", "recipe_updated"]);
  });
});
