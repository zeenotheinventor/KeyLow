import { describe, expect, it } from "vitest";

import { NUTRITION_ENGINE_VERSION, SNAPSHOT_VERSION } from "../../src/diary/versions";

describe("snapshot versions", () => {
  it("should start the snapshot shape at version 1", () => {
    expect(SNAPSHOT_VERSION).toBe(1);
  });

  it("should start the nutrition engine at version 1", () => {
    expect(NUTRITION_ENGINE_VERSION).toBe(1);
  });
});
