import type { IconName } from "../Icon";

export type EmptyStateAction = {
  /** The button's label: short, sentence case, no full stop, such as "Create a food". */
  label: string;
  onPress: () => void;
  /** A leading icon, by name. */
  icon?: IconName | undefined;
  /** Defaults to `secondary`. A first-time empty screen, such as the recipes tab's, draws its one action `primary`. */
  variant?: "primary" | "secondary" | undefined;
  /** Dims the button to 40 percent and stops it responding, such as while the phone is offline. */
  disabled?: boolean | undefined;
};

export type EmptyStateProps = {
  /** The icon in the tile above the title, by name. */
  icon: IconName;
  /** The fixed sentence that says what is missing. A screen passes it from `@keylow/core/copy`. */
  title: string;
  /** One more sentence, from `@keylow/core/copy` too. */
  body?: string | undefined;
  /** The one thing to do about it, drawn as a button: secondary unless its `variant` says otherwise. */
  action?: EmptyStateAction | undefined;
  /** How far the words are from the sides: 24 points by default, 32 when wide, as the food not found board draws it. */
  inset?: "default" | "wide" | undefined;
};
