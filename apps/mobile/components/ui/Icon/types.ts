import type { iconMap } from "./iconMap";
import type { Tone } from "../tone";
import type { iconSize } from "@keylow/tokens";

export type IconName = keyof typeof iconMap;

/** The design's icon size tokens: sm 16, md 20, lg 24, xl 32. */
export type IconSizeName = keyof typeof iconSize;

/**
 * A tone from the kit's text and fill tones, or `accent-ink`: the design's `--accent-ink`, which is lime
 * in dark and the primary text colour in light. It is for a thin glyph such as a spinner, because lime
 * is never text or a thin line on a light surface.
 */
export type IconTone = Tone | "accent-ink";

export type IconProps = {
  name: IconName;
  /** Defaults to `md`. */
  size?: IconSizeName;
  /** Defaults to `primary`. */
  tone?: IconTone;
  /** The accessible name. An icon without one is decoration and is hidden from screen readers. */
  label?: string;
};
