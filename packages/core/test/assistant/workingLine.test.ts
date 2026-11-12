import { describe, expect, it } from "vitest";

import { WORKING_LINE_ANNOUNCEMENT_GAP_MS } from "../../src/assistant";

describe("WORKING_LINE_ANNOUNCEMENT_GAP_MS", () => {
  it("should be 5 seconds, which both apps pace the screen reader by", () => {
    expect(WORKING_LINE_ANNOUNCEMENT_GAP_MS).toBe(5000);
  });
});
