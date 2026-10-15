import type { iconMap } from "./iconMap";
import type { Tone } from "../tone";
import type { iconSize } from "@keylow/tokens";

export type IconName = keyof typeof iconMap;

/** The design's icon size tokens: sm 16, md 20, lg 24, xl 32. */
export type IconSizeName = keyof typeof iconSize;

/**
 * A tone from the kit's text and fill tones, or `accent-ink`: the design's `--accent-ink`, which is lime
 * in dark and the primary text colour in light. It is for a thin glyph such as a spinner, because lime
 * is never text or a thin line on a light surface. `warning` and `danger` are the status glyphs the
 * boards draw in both schemes, on a muted fill or beside the words, which stay in a text colour (Q14).
 * `calories` is the flame beside an energy value, in the calories colour.
 */
export type IconTone = Tone | "accent-ink" | "warning" | "danger" | "calories";

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
