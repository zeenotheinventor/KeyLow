/** The scheme of the screen the body is drawn on. The package reads no tokens, so it names the two itself. */
export type BodyLightingScheme = "light" | "dark";

/** A soft ambient fill and one key light, with the intensities three.js takes. */
export type BodyLighting = {
  ambientIntensity: number;
  keyIntensity: number;
  /** In metres, from the middle of the body: above, to the right and in front of it. */
  keyPosition: [x: number, y: number, z: number];
};

// The same direction in both, so the muscles keep their relief. A surface that faces the eye is lit to about 1.2 times
// its colour in dark and 1.06 in light (the light is (ambient + key x cosine) / pi, and a muscle's own glow adds 0.12), which
// puts what the screen shows within about 5 % of the token for the same value on `BodyFigure`. Light was 1.2 each in the
// rested body, which a pale grey could carry, but it showed every coloured muscle at 0.85 of its token, so Ready green and
// Rested grey both read darker than in 2D. At 1.7 the palest colour (Rested, 0.85 of white) stays below white.
const KEY_POSITION: BodyLighting["keyPosition"] = [2, 4, 5];

/** The lights of the body scene. The renderers read these numbers, so a browser and the phone light the body alike. */
export const BODY_LIGHTING: Record<BodyLightingScheme, BodyLighting> = {
  dark: { ambientIntensity: 2.0, keyIntensity: 2.0, keyPosition: KEY_POSITION },
  light: { ambientIntensity: 1.7, keyIntensity: 1.7, keyPosition: KEY_POSITION },
};
