import { Color, FrontSide, MeshBasicMaterial, MeshStandardMaterial } from "three";

import { withNeckFade, withSkinFresnel } from "./bodyShaders";
import { byMuscle } from "./byMuscle";

import type { MuscleId } from "@keylow/body-model/meshNames";

/** The five colours of the body, as strings three.js reads. The package never reads the design tokens, the caller passes them. */
export type BodyColours = {
  /** The 22 muscles that have an id, before a look is applied to them. */
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
  /** One material for each muscle, so each can take its own colour. */
  muscles: Record<MuscleId, MeshStandardMaterial>;
  /** The colour the head fades into at the neck, which `applyLooks` keeps equal to the neck muscle's. */
  neckColour: Color;
  other: MeshStandardMaterial;
  core: MeshStandardMaterial;
  head: MeshStandardMaterial;
  skin: MeshBasicMaterial;
};

// The approved render lights the muscles from within a little (0.12) and the core more (0.5), so the shadow of a
// muscle does not turn a gap between muscles black.
/** The share of a muscle's own colour that lights it from within. */
export const MUSCLE_RELIEF = 0.12;
const CORE_GLOW = 0.5;

const matt = (color: string, glow = 0) =>
  new MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0,
    emissive: color,
    emissiveIntensity: glow,
  });

// A muscle's emissive colour is all of the light it gives out, so its intensity stays 1 and `applyLooks` sets the colour.
function muscleMaterial(colour: string) {
  const material = matt(colour, 1);
  material.emissive.multiplyScalar(MUSCLE_RELIEF);
  return material;
}

/**
 * The materials of the body, new each time so one canvas can dispose its own. Everything is opaque except
 * the skin, which is drawn last and writes no depth, so the muscles under it never need sorting. The head
 * fades into the colour of the muscles at the neck.
 */
export function bodyMaterials(colours: BodyColours): BodyMaterials {
  const head = matt(colours.clay);
  const neckColour = new Color(colours.muscle);
  head.onBeforeCompile = (parameters) => {
    Object.assign(parameters, withNeckFade(parameters));
    // The uniform holds the very Color the materials expose, so copying a colour into it moves the collar.
    parameters.uniforms["bodyNeckColour"] = { value: neckColour };
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
    muscles: byMuscle(() => muscleMaterial(colours.muscle)),
    neckColour,
    other: matt(colours.otherMuscle),
    core: matt(colours.core, CORE_GLOW),
    head,
    skin,
  };
}

/**
 * Sets the colours of everything but the muscles, for a change of theme, so the materials live on and the muscles
 * can fade. The muscles take a look instead. The head's neck colour follows the neck muscle, so it is left alone.
 */
export function colourFixedMaterials(materials: BodyMaterials, colours: BodyColours): void {
  materials.other.color.set(colours.otherMuscle);
  materials.other.emissive.set(colours.otherMuscle);
  materials.core.color.set(colours.core);
  materials.core.emissive.set(colours.core);
  materials.head.color.set(colours.clay);
  materials.head.emissive.set(colours.clay);
  materials.skin.color.set(colours.skin);
}
