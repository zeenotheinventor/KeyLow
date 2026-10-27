import type { IconName } from "../Icon";
import type { ReactNode } from "react";

export type ToastTone = "neutral" | "success" | "warning" | "danger";

/**
 * How the card is drawn. `default` is the sheet card, and `success-filled` fills it with the success colour
 * and draws the words, the icon and the action in the ink for that fill, for a toast that must stand out.
 */
export type ToastVariant = "default" | "success-filled";

export type ToastProps = {
  /**
   * One short sentence, without a full stop or an exclamation mark. The one documented exception is "Ki-Lo
   * has been updated!", the green toast after an over-the-air update, which keeps its exclamation mark.
   */
  message: string;
  /** The one action, such as Undo after a delete. */
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  /**
   * Colours the icon only. The words stay in the primary text colour. Defaults to `neutral`. The
   * `success-filled` variant draws the icon in its own ink, so the tone has no effect there.
   */
  tone?: ToastTone | undefined;
  /** Defaults to `default`. */
  variant?: ToastVariant | undefined;
  icon?: IconName | undefined;
  /** Defaults to true. A toast that is not open draws nothing. */
  open?: boolean | undefined;
  /**
   * Called when the wait is over, or when the card is tapped outside the action, or when a screen reader runs
   * its dismiss action. Without it the toast never closes itself and cannot be dismissed.
   */
  onClose?: (() => void) | undefined;
  /** How long the toast waits, in milliseconds, with or without an action. Defaults to 5000. */
  duration?: number | undefined;
  /**
   * The safe area under the status bar, in points, which the toast sits below. The provider reads it from
   * `useSafeAreaInsets`, as the screens read their own. Defaults to 0.
   */
  topInset?: number | undefined;
};

/** What a screen passes to `show`. The provider owns opening, closing and placement, at the top of the screen. */
export type ToastOptions = Pick<
  ToastProps,
  "message" | "actionLabel" | "onAction" | "tone" | "icon" | "variant"
>;

export type ToastContextValue = {
  /** Shows a toast. One shows at a time, so a new toast replaces the current one. */
  show: (options: ToastOptions) => void;
  /** Takes the current toast down at once, with its action, such as when a page opens over the screen. */
  dismiss: () => void;
};

export type ToastProviderProps = {
  children: ReactNode;
};
