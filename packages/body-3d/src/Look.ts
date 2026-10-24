import type { MuscleId } from "@keylow/body-model/meshNames";

/** How one muscle looks. The package reads no tokens, so the caller works these out and passes them in. */
export type Look = {
  /** The colour of the muscle, as a string three.js reads. */
  color: string;
  /** The colour a glowing muscle lights from within, as a string three.js reads. */
  glowColor: string;
  /** How strongly it glows, 0 for not at all, as three.js's emissive intensity. */
  glow: number;
};

/** What the screen asks of the whole body on top of each muscle's look, as `BodyFigure` has it. */
export type LookEmphasis = {
  /** The muscle to pull towards `selectedColor`. */
  selected: MuscleId | undefined;
  /** The primary text colour, so the selected muscle is lighter on a dark screen and darker on a light one. */
  selectedColor: string;
  /** The colour a muscle is mixed towards as it is dimmed, which is the resting grey of the body. */
  restingColor: string;
  /** How much of every look is kept, from 0 (all resting grey) to 1 (as it is). */
  dim: number;
  /** How much of the look the muscles but the selected one keep. Does nothing without a selected muscle. */
  unselectedOpacity: number;
};
