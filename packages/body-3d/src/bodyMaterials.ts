import { Color, FrontSide, MeshBasicMaterial, MeshStandardMaterial } from "three";

import { withNeckFade, withSkinFresnel } from "./bodyShaders";

/** The five colours of the body, as strings three.js reads. The package never reads the design tokens, the caller passes them. */
export type BodyColours = {
  /** The 22 muscles that have an id. */
  muscle: string;
  /** The muscles that have no id. */
  otherMuscle: string;
  /** The dark fill under the muscles. */
  core: string;
  /** The head. */
  clay: string;
  /** The see-through shell. */
  skin: string;
};

export type BodyMaterials = {
  muscle: MeshStandardMaterial;
  other: MeshStandardMaterial;
  core: MeshStandardMaterial;
  head: MeshStandardMaterial;
  skin: MeshBasicMaterial;
};

// The approved render lights the muscles from within a little (0.12) and the core more (0.5), so the shadow of a
// muscle does not turn a gap between muscles black.
const MUSCLE_GLOW = 0.12;
const CORE_GLOW = 0.5;

const matt = (color: string, glow = 0) =>
  new MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0,
    emissive: color,
    emissiveIntensity: glow,
  });

/**
 * The materials of the body, new each time so one canvas can dispose its own. Everything is opaque except
 * the skin, which is drawn last and writes no depth, so the muscles under it never need sorting. The head
 * fades into the colour of the muscles at the neck.
 */
export function bodyMaterials(colours: BodyColours): BodyMaterials {
  const head = matt(colours.clay);
  const neckColour = { value: new Color(colours.muscle) };
  head.onBeforeCompile = (parameters) => {
    Object.assign(parameters, withNeckFade(parameters));
    parameters.uniforms["bodyNeckColour"] = neckColour;
  };
  head.customProgramCacheKey = () => "bodyHeadNeckFade";

  const skin = new MeshBasicMaterial({
    color: colours.skin,
    transparent: true,
    depthWrite: false,
    // The approved render culls the back faces, which would otherwise draw the far side of the body over the muscles.
    side: FrontSide,
  });
  skin.onBeforeCompile = (parameters) => {
    Object.assign(parameters, withSkinFresnel(parameters));
  };
  skin.customProgramCacheKey = () => "bodySkinFresnel";

  return {
    muscle: matt(colours.muscle, MUSCLE_GLOW),
    other: matt(colours.otherMuscle),
    core: matt(colours.core, CORE_GLOW),
    head,
    skin,
  };
}
