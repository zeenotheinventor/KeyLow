import { describe, expect, it } from "vitest";

import { BODY_LIGHTING } from "../src/bodyLighting";
import { MUSCLE_RELIEF } from "../src/bodyMaterials";

import type { BodyLightingScheme } from "../src/bodyLighting";

// How many times its own colour a surface that faces the eye shows: the ambient light and the key light's cosine, over
// pi as three.js's diffuse term has it, and the light the muscle gives out itself.
function faceOnBrightness(scheme: BodyLightingScheme) {
  const { ambientIntensity, keyIntensity, keyPosition } = BODY_LIGHTING[scheme];
  const keyCosine = keyPosition[2] / Math.hypot(...keyPosition);
  return (ambientIntensity + keyIntensity * keyCosine) / Math.PI + MUSCLE_RELIEF;
}

describe("BODY_LIGHTING", () => {
  it.each<BodyLightingScheme>(["dark", "light"])(
    "should show a surface that faces the eye at about its own colour, in the %s theme, so a token shows as the token",
    (scheme) => {
      expect(faceOnBrightness(scheme)).toBeGreaterThanOrEqual(1);
      expect(faceOnBrightness(scheme)).toBeLessThanOrEqual(1.25);
    },
  );

  it("should light the light body no brighter than the dark one, so its pale colours do not clip to white", () => {
    expect(faceOnBrightness("light")).toBeLessThanOrEqual(faceOnBrightness("dark"));
  });

  it("should light both themes from the same direction, so the relief is the same", () => {
    expect(BODY_LIGHTING.light.keyPosition).toEqual(BODY_LIGHTING.dark.keyPosition);
  });
});
