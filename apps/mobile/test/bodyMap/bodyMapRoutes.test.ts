import { bodyMapPath, bodyMapScaleOf, muscleListPath } from "../../lib/bodyMapRoutes";

describe("the body map routes", () => {
  describe("bodyMapPath", () => {
    it("should lead to the body map with nothing else in the address", () => {
      expect(bodyMapPath()).toBe("/body-map");
    });

    it("should name the Train home as the origin", () => {
      expect(bodyMapPath("train")).toBe("/body-map?from=train");
    });

    it("should ask for Volume", () => {
      expect(bodyMapPath("dashboard", "volume")).toBe("/body-map?scale=volume");
    });

    it("should leave Heat out, because Heat is where the map opens", () => {
      expect(bodyMapPath("dashboard", "heat")).toBe("/body-map");
    });

    it("should carry the origin and Volume together", () => {
      expect(bodyMapPath("train", "volume")).toBe("/body-map?from=train&scale=volume");
    });
  });

  describe("bodyMapScaleOf", () => {
    it("should open on Volume when the address asks for it", () => {
      expect(bodyMapScaleOf("volume")).toBe("volume");
    });

    it.each([undefined, "", "heat", "gap", "Volume"])(
      "should open on Heat for %s, as a cold link does",
      (scale) => {
        expect(bodyMapScaleOf(scale)).toBe("heat");
      },
    );
  });

  describe("muscleListPath", () => {
    it("should lead to the muscle list under the body map", () => {
      expect(muscleListPath()).toBe(`${bodyMapPath()}/muscles`);
    });

    it("should carry the day chosen on the map", () => {
      expect(muscleListPath("2026-10-14")).toBe("/body-map/muscles?at=2026-10-14");
    });
  });
});
