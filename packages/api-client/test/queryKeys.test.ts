import { describe, expect, it } from "vitest";

import { keys } from "../src/queryKeys";

describe("keys.profiles", () => {
  it("should expose the profiles root key", () => {
    expect(keys.profiles.all).toEqual(["profiles"]);
  });

  it("should build a detail key scoped to the profile id", () => {
    expect(keys.profiles.detail("user-1")).toEqual(["profiles", "user-1"]);
  });
});
