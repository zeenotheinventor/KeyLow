/** The scheme of the screen the body is drawn on. The package reads no tokens, so it names the two itself. */
export type BodyLightingScheme = "light" | "dark";

/** A soft ambient fill and one key light, with the intensities three.js takes. */
export type BodyLighting = {
  ambientIntensity: number;
  keyIntensity: number;
  /** In metres, from the middle of the body: above, to the right and in front of it. */
  keyPosition: [x: number, y: number, z: number];
};

// The same direction in both, so the muscles keep their relief. The light body is lit less, because its
// colours are pale, and the same light would clip them to white.
const KEY_POSITION: BodyLighting["keyPosition"] = [2, 4, 5];

/** The lights of the body scene. The renderers read these numbers, so a browser and the phone light the body alike. */
export const BODY_LIGHTING: Record<BodyLightingScheme, BodyLighting> = {
  dark: { ambientIntensity: 2.0, keyIntensity: 2.0, keyPosition: KEY_POSITION },
  light: { ambientIntensity: 1.2, keyIntensity: 1.2, keyPosition: KEY_POSITION },
};
