import { MUSCLE_IDS } from "@keylow/body-model/meshNames";

import { byMuscle } from "./byMuscle";
import { paintsOf, writePaints } from "./paints";

import type { BodyMaterials } from "./bodyMaterials";
import type { Look, LookEmphasis } from "./Look";
import type { BodyPaints } from "./paints";
import type { MuscleId } from "@keylow/body-model/meshNames";

/** An ease in and out, so a colour starts and stops softly. It is 0.5 half way through. */
const smooth = (progress: number) => progress * progress * (3 - 2 * progress);

export type LookFade = {
  /**
   * Eases from what is shown now to these looks over `milliseconds`. Returns whether frames must follow: false when
   * the looks are what is shown already, or the change was made at once because `milliseconds` is 0.
   */
  moveTo: (
    looks: Readonly<Record<MuscleId, Look>>,
    emphasis: LookEmphasis,
    milliseconds: number,
  ) => boolean;
  /** Moves the fade on by the time since the last frame and sets the materials. Returns whether another frame is needed. */
  step: (deltaMilliseconds: number) => boolean;
};

const copyOf = (paints: BodyPaints): BodyPaints => ({
  ...byMuscle((id) => ({ color: paints[id].color.clone(), emissive: paints[id].emissive.clone() })),
  neckColour: paints.neckColour.clone(),
});

const areSame = (first: BodyPaints, second: BodyPaints) =>
  first.neckColour.equals(second.neckColour) &&
  MUSCLE_IDS.every(
    (id) =>
      first[id].color.equals(second[id].color) && first[id].emissive.equals(second[id].emissive),
  );

/**
 * A fade between the looks of the body, driven from the render loop so no React state changes per frame. It
 * begins with the materials set to the first looks. It colours in the linear working space of three.js, as the
 * lights do.
 */
export function createLookFade(
  materials: BodyMaterials,
  looks: Readonly<Record<MuscleId, Look>>,
  emphasis: LookEmphasis,
): LookFade {
  let target = paintsOf(looks, emphasis);
  let start = copyOf(target);
  const shown = copyOf(target);
  writePaints(materials, shown);
  let elapsed = 0;
  let duration = 0;
  let isMoving = false;
  // The first frame after a change reports the time since the last draw, which may be minutes, so it takes no part.
  let isFirstFrame = false;

  return {
    moveTo(newLooks, newEmphasis, milliseconds) {
      const next = paintsOf(newLooks, newEmphasis);
      // The same target needs nothing, unless it is asked for at once while the fade is part way to it.
      if (areSame(next, target) && !(isMoving && milliseconds <= 0)) {
        return isMoving;
      }
      target = next;
      if (milliseconds <= 0) {
        for (const id of MUSCLE_IDS) {
          shown[id].color.copy(next[id].color);
          shown[id].emissive.copy(next[id].emissive);
        }
        shown.neckColour.copy(next.neckColour);
        writePaints(materials, shown);
        isMoving = false;
        return false;
      }
      start = copyOf(shown);
      elapsed = 0;
      duration = milliseconds;
      isMoving = true;
      isFirstFrame = true;
      return true;
    },
    step(deltaMilliseconds) {
      if (!isMoving) {
        return false;
      }
      if (isFirstFrame) {
        isFirstFrame = false;
      } else {
        elapsed += deltaMilliseconds;
      }
      const progress = Math.min(1, elapsed / duration);
      const eased = progress >= 1 ? 1 : smooth(progress);
      for (const id of MUSCLE_IDS) {
        shown[id].color.copy(start[id].color).lerp(target[id].color, eased);
        shown[id].emissive.copy(start[id].emissive).lerp(target[id].emissive, eased);
      }
      shown.neckColour.copy(start.neckColour).lerp(target.neckColour, eased);
      writePaints(materials, shown);
      isMoving = progress < 1;
      return isMoving;
    },
  };
}
