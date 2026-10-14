import type { ButtonVariant } from "../Button";

export type ErrorStateRetry = {
  /** The button's label: short, sentence case, no full stop, such as "Try again". */
  label: string;
  onPress: () => void;
};

/** A button that is not a retry, such as the link error board's "Back to sign in": no icon. */
export type ErrorStateAction = {
  /** The button's label: short, sentence case, no full stop. */
  label: string;
  onPress: () => void;
  /** Defaults to `secondary`. */
  variant?: ButtonVariant;
};

export type ErrorStateProps = {
  /** The fixed sentence that says what failed. A screen passes it from `@keylow/core/copy`. */
  title: string;
  /** One more sentence, from `@keylow/core/copy` too: what to do or what still works. */
  body?: string | undefined;
  /** Tries again, drawn as a secondary button. A failure that retries itself, such as a search that runs again when the query changes, has none. */
  retry?: ErrorStateRetry | undefined;
  /** A button for what to do instead, with no icon. A retry takes its place when both are given. */
  action?: ErrorStateAction | undefined;
  /** How far the words are from the sides: 24 points by default, 32 when wide, as the link error board draws it. */
  inset?: "default" | "wide" | undefined;
};
