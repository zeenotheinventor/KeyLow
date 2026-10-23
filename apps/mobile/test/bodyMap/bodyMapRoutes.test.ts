import { bodyMapPath, muscleListPath } from "../../lib/bodyMapRoutes";

describe("the body map routes", () => {
  describe("muscleListPath", () => {
    it("should lead to the muscle list under the body map", () => {
      expect(muscleListPath()).toBe(`${bodyMapPath()}/muscles`);
    });

    it("should carry the day chosen on the map", () => {
      expect(muscleListPath("2026-10-14")).toBe("/body-map/muscles?at=2026-10-14");
    });
  });
});
