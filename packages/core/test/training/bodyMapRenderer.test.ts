import { describe, expect, it } from "vitest";

import { bodyMapRendererFor } from "../../src/training";

import type { BodyArtworkFigure, BodyMapRenderer } from "../../src/training";

const preferences: BodyMapRenderer[] = ["2d", "3d"];
const figures: BodyArtworkFigure[] = ["male", "female"];
const canTry3dValues = [true, false];

describe("bodyMapRendererFor", () => {
  it("should draw 3D for the male figure when 3D is chosen and can be tried", () => {
    expect(bodyMapRendererFor({ preference: "3d", figure: "male", canTry3d: true })).toBe("3d");
  });

  it("should draw 2D when the preference is 2D", () => {
    expect(bodyMapRendererFor({ preference: "2d", figure: "male", canTry3d: true })).toBe("2d");
  });

  it("should draw 2D for the female figure, which has no 3D body yet", () => {
    expect(bodyMapRendererFor({ preference: "3d", figure: "female", canTry3d: true })).toBe("2d");
  });

  it("should draw 2D when 3D cannot be tried", () => {
    expect(bodyMapRendererFor({ preference: "3d", figure: "male", canTry3d: false })).toBe("2d");
  });

  describe("over every combination", () => {
    const combinations = preferences.flatMap((preference) =>
      figures.flatMap((figure) =>
        canTry3dValues.map((canTry3d) => ({ preference, figure, canTry3d })),
      ),
    );

    it("should draw 3D only for a 3D preference, the male figure and a 3D that can be tried", () => {
      const drawnIn3d = combinations.filter((input) => bodyMapRendererFor(input) === "3d");

      expect(drawnIn3d).toEqual([{ preference: "3d", figure: "male", canTry3d: true }]);
    });
  });
});
