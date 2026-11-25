import type { IconName } from "../ui";
import type { ReactNode } from "react";

/**
 * The tile's colours: `neutral` is the raised surface with secondary ink, `danger` and `success` are the
 * muted fill and the ink of that name. Danger is announced as an alert, the others as a status.
 */
export type AuthMessageTone = "neutral" | "danger" | "success";

export type AuthMessageAction = {
  /** The button's label, from `@keylow/core/copy`. */
  label: string;
  onPress: () => void;
};

export type AuthMessageProps = {
  /** The icon in the tile, by name. */
  icon: IconName;
  tone: AuthMessageTone;
  /** The heading, from `@keylow/core/copy`. */
  title: string;
  /** The sentence under it, from `@keylow/core/copy`. */
  body: string;
  /** The main thing to do, a primary button the full width. */
  primary?: AuthMessageAction | undefined;
  /** A second thing to do, a secondary button the full width, under the primary one. */
  secondary?: AuthMessageAction | undefined;
  /** What goes under the buttons, such as the sent screen's caption and Send again. */
  children?: ReactNode;
};
