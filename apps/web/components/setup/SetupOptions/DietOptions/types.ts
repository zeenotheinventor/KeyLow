import type { DietStyle } from "@keylow/core/setup";

export type DietOptionsProps = {
  /** The group's accessible name, which is the question the cards answer. */
  label: string;
  /** The chosen style, or `undefined` while nothing is chosen. */
  value: DietStyle | undefined;
  onChange: (dietStyle: DietStyle) => void;
};
