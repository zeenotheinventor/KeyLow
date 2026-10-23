import type { IconName } from "../Icon";
import type { ReactNode } from "react";

/**
 * `review` is the warning-toned "Needs review" notice. `error` is the danger-toned notice of a failed
 * action, such as a product that could not be added: a design-system addition, never for "over target".
 * `offline` and `info` are quiet and neutral.
 */
export type BannerVariant = "review" | "offline" | "info" | "error";

/**
 * `default` is the design system card's notice. `compact` is the trend explainer's: no border, 12 points of
 * padding on every side and the title in 14 over 20 semibold.
 */
export type BannerSize = "default" | "compact";

export type BannerAction = {
  /** The action's label: short, sentence case, no full stop, such as "Copy to your foods". */
  label: string;
  onPress: () => void;
};

export type BannerProps = {
  /** Defaults to `info`. */
  variant?: BannerVariant;
  /** The fixed sentence that says what happened. A screen passes it from `@keylow/core/copy`. */
  title: string;
  /** One more sentence, from `@keylow/core/copy` too. */
  body?: string | undefined;
  /**
   * The icon, by name. Each variant has its own, and the boards draw others on the quiet one, such as a
   * crossed-out cloud for Open Food Facts being unreachable and a clock for it being busy.
   */
  icon?: IconName | undefined;
  /**
   * Whether to draw the leading icon. Defaults to true. The trend explainer's board draws its warning
   * with no icon, and `icon` can only change one.
   */
  hasIcon?: boolean | undefined;
  /** Defaults to `default`. */
  size?: BannerSize | undefined;
  /**
   * Draws a title with no body in regular body text, as the sign in error board draws its one sentence.
   * Without it a title is always strong body text, as the design system card draws it.
   */
  sentence?: boolean | undefined;
  /** The one thing to do about it, drawn under the words as a text button. */
  action?: BannerAction | undefined;
  /**
   * Announces a `review` notice as an alert when it appears, for a result the user is waiting on, such
   * as the food form's partial save. The `review` notice is otherwise a note, and the other variants
   * ignore this.
   */
  announce?: boolean | undefined;
  /** Drawn under the words and above the action, outside the words' announcement, such as a progress bar. */
  children?: ReactNode;
};
