import type { iconColorTones } from "./iconColorTones";
import type * as iconMap from "./iconMap";
import type { Tone } from "../tone";
import type { iconSize } from "@keylow/tokens";

export type IconName = keyof typeof iconMap;

/** The design's icon size tokens: sm 16, md 20, lg 24, xl 32. */
export type IconSizeName = keyof typeof iconSize;

/**
 * A tone from the kit's text and fill tones, or a colour tone: the theme colour itself, for a glyph that is
 * drawn in `accent-ink`, `accent`, `success`, `success-ink`, `warning`, `danger` or `calories`. Each colour
 * tone is one file in `./tones`, named for the tone and saying what it is for, and `iconColorTones.ts` is
 * generated from them (see tools/generate-lists), so adding a tone is adding a file.
 */
export type IconTone = Tone | keyof typeof iconColorTones;

export type IconProps = {
  name: IconName;
  /**
   * A size token, or a size in points for a glyph the frames draw off the scale, such as the stack
   * header's close at 22. Defaults to `md`.
   */
  size?: IconSizeName | number;
  /** Defaults to `primary`. */
  tone?: IconTone;
  /**
   * The stroke weight, for a glyph the frames draw heavier than the design's 1.75, such as the tab bar's
   * plus at 2.25. Defaults to `iconStroke`.
   */
  strokeWidth?: number;
  /** The accessible name. An icon without one is decoration and is hidden from screen readers. */
  label?: string;
};
