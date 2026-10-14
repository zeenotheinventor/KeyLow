import type { IconName } from "../Icon";

export type EmptyStateAction = {
  /** The button's label: short, sentence case, no full stop, such as "Create a food". */
  label: string;
  onPress: () => void;
  /** A leading icon, by name. */
  icon?: IconName | undefined;
};

export type EmptyStateProps = {
  /** The icon in the tile above the title, by name. */
  icon: IconName;
  /** The fixed sentence that says what is missing. A screen passes it from `@keylow/core/copy`. */
  title: string;
  /** One more sentence, from `@keylow/core/copy` too. */
  body?: string | undefined;
  /** The one thing to do about it, drawn as a secondary button. */
  action?: EmptyStateAction | undefined;
};
