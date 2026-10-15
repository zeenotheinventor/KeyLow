import { describe, expect, it } from "vitest";

import { DIARY_UNDO_ACTION } from "../../src/copy";

describe("the diary undo copy", () => {
  it("should name the toast action Undo, as the deleted and copied boards do", () => {
    expect(DIARY_UNDO_ACTION).toBe("Undo");
  });
});
