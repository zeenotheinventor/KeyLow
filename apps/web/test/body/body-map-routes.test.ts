import { describe, expect, it } from "vitest";

import { bodyMapPath, muscleListPath } from "@/lib/bodyMapRoutes";

describe("the body map routes", () => {
  it("should name the body map page", () => {
    expect(bodyMapPath()).toBe("/body-map");
  });

  it("should open the muscle list with no address parameter for today", () => {
    expect(muscleListPath()).toBe("/body-map/muscles");
  });

  it("should carry only the day, when there is one", () => {
    expect(muscleListPath("2026-10-14")).toBe("/body-map/muscles?at=2026-10-14");
  });
});
