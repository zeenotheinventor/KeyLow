import type { iconMap } from "./iconMap";
import type { Tone } from "../tone";
import type { iconSize } from "@keylow/tokens";

export type IconName = keyof typeof iconMap;

/** The design's icon size tokens: sm 16, md 20, lg 24, xl 32. */
export type IconSizeName = keyof typeof iconSize;

export type IconTone = Tone;

export type IconProps = {
  name: IconName;
  /** Defaults to `md`. */
  size?: IconSizeName;
  /** Defaults to `primary`. */
  tone?: IconTone;
  /** The accessible name. An icon without one is decoration and is hidden from screen readers. */
  label?: string;
};
