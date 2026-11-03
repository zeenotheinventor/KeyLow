import { describe, expect, it } from "vitest";

import { NOW, NOW_ISO } from "./sampleSnapshot";
import { isUndoWindowOpen } from "../../src/widgets";

const minutesBefore = (minutes: number): string =>
  new Date(NOW.getTime() - minutes * 60_000).toISOString();

describe("isUndoWindowOpen", () => {
  it("should be open at the moment of the write", () => {
    expect(isUndoWindowOpen(NOW_ISO, NOW)).toBe(true);
  });

  it("should be open just before the window ends", () => {
    expect(isUndoWindowOpen(minutesBefore(9.9), NOW)).toBe(true);
  });

  it("should be closed 10 minutes after the write", () => {
    expect(isUndoWindowOpen(minutesBefore(10), NOW)).toBe(false);
  });

  it("should not trust a record from the future", () => {
    expect(isUndoWindowOpen(minutesBefore(-1), NOW)).toBe(false);
  });
});
