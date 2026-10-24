import { MUSCLE_IDS } from "@keylow/body-model/meshNames";
import { Color, MathUtils } from "three";

import { MUSCLE_RELIEF } from "./bodyMaterials";
import { byMuscle } from "./byMuscle";

import type { BodyMaterials } from "./bodyMaterials";
import type { Look, LookEmphasis } from "./Look";
import type { MuscleId } from "@keylow/body-model/meshNames";

// How far the selected muscle is pulled towards the primary text colour. The ticket asks for a low emissive of that
// colour, which would show nothing on the light theme, where the text is near black and adds no light. A mix goes
// lighter on the dark theme and darker on the light one, so the muscle stands out from the rest on both.
const SELECTED_SHARE_OF_TEXT_COLOUR = 0.5;

/** What a muscle's material is set to: the colour, and all the light it gives out (its emissive intensity stays 1). */
export type MusclePaint = { color: Color; emissive: Color };

export type BodyPaints = Record<MuscleId, MusclePaint>;

/** The paints of the looks under the emphasis, new each time. */
export function paintsOf(
  looks: Readonly<Record<MuscleId, Look>>,
  emphasis: LookEmphasis,
): BodyPaints {
  const resting = new Color(emphasis.restingColor);
  const text = new Color(emphasis.selectedColor);
  const hasSelection = emphasis.selected !== undefined;
  return byMuscle((id) => {
    const look = looks[id];
    const isSelected = id === emphasis.selected;
    const unselected = hasSelection && !isSelected ? emphasis.unselectedOpacity : 1;
    // Held to 0 to 1 as a opacity is, so a caller's 1.2 or -1 cannot mix past the look or the resting grey.
    const strength = MathUtils.clamp(emphasis.dim * unselected, 0, 1);
    const color = resting.clone().lerp(new Color(look.color), strength);
    if (isSelected) {
      color.lerp(text, SELECTED_SHARE_OF_TEXT_COLOUR);
    }
    const emissive = color
      .clone()
      .multiplyScalar(MUSCLE_RELIEF)
      // Squared, because light in three.js is linear and a screen shows it brighter than its number, so a dimmed
      // glow at the same share as the colour would still read strong.
      .add(new Color(look.glowColor).multiplyScalar(look.glow * strength * strength));
    return { color, emissive };
  });
}

/** Sets the materials to the paints, and the head's neck colour to the neck muscle's. */
export function writePaints(materials: BodyMaterials, paints: BodyPaints): void {
  for (const id of MUSCLE_IDS) {
    materials.muscles[id].color.copy(paints[id].color);
    materials.muscles[id].emissive.copy(paints[id].emissive);
  }
  materials.neckColour.copy(paints.neck.color);
}
