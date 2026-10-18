import { describe, expect, it } from "vitest";

import { SNAPSHOT_VERSION } from "../../src/diary/versions";
import { MUSCLE_LIST_VERSION, SET_SNAPSHOT_VERSION } from "../../src/training";

describe("training versions", () => {
  it("should start the set snapshot shape at version 1", () => {
    expect(SET_SNAPSHOT_VERSION).toBe(1);
  });

  it("should start the muscle list at version 1", () => {
    expect(MUSCLE_LIST_VERSION).toBe(1);
  });

  it("should leave the food snapshot version where it was", () => {
    expect(SNAPSHOT_VERSION).toBe(1);
  });
});
