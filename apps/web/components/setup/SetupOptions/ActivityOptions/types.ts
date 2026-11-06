import type { ActivityLevel } from "@keylow/core/engine";

export type ActivityOptionsProps = {
  /** The group's accessible name, which is the question the cards answer. */
  label: string;
  /** The chosen level, or `undefined` while nothing is chosen. */
  value: ActivityLevel | undefined;
  onChange: (activity: ActivityLevel) => void;
};
