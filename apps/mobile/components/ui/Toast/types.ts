import type { BadgeTone } from "../Badge";
import type { IconName } from "../Icon";
import type { ReactNode } from "react";

export type ToastTone = "neutral" | "success" | "warning" | "danger" | "accent";

/**
 * How the card is drawn. `default` is the sheet card, and `success-filled` fills it with the success colour
 * and draws the words, the icon and the action in the ink for that fill, for a toast that must stand out.
 * `achievement` is the unlock toast of board 3: a medal, a title with a line under it, chips and View. It sits
 * above the tab bar instead of under the status bar, and a swipe down takes it away.
 */
export type ToastVariant = "default" | "success-filled" | "achievement";

/** A small pill under the words of an achievement toast, such as "+1 freeze". */
export type ToastChip = { label: string; tone: BadgeTone };

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
  /** Fills the icon with its tone, as the favourite toast's heart is. Defaults to false. */
  isIconFilled?: boolean | undefined;
  /**
   * How far under the safe area the card sits, in points, in place of the usual 12. A toast that confirms
   * a control in a header gives the header's height, so the card sits just under it and the control stays
   * in view to be tapped again.
   */
  topOffset?: number | undefined;
  /** Defaults to true. A toast that is not open draws nothing. */
  open?: boolean | undefined;
  /**
   * Called when the wait is over, or when the card is tapped outside the action, or when a screen reader runs
   * its dismiss action. Without it the toast never closes itself and cannot be dismissed.
   */
  onClose?: (() => void) | undefined;
  /** How long the toast waits, in milliseconds, with or without an action. Defaults to 5000. */
  duration?: number | undefined;
  /** Achievement only: the line under the title, such as how the badge was earned. */
  description?: string | undefined;
  /** Achievement only: the 44 point medal to the left of the words. Decoration, the title names the badge. */
  medal?: ReactNode;
  /** Achievement only: the pills under the words. */
  chips?: readonly ToastChip[] | undefined;
  /**
   * Achievement only: the safe area above the home indicator, in points, which the card sits above together
   * with the tab bar. Defaults to 0.
   */
  bottomInset?: number | undefined;
  /**
   * The safe area under the status bar, in points, which the toast sits below. The provider reads it from
   * `useSafeAreaInsets`, as the screens read their own. Defaults to 0.
   */
  topInset?: number | undefined;
};

/** What a screen passes to `show`. The provider owns opening, closing and placement, at the top of the screen. */
export type ToastOptions = Pick<
  ToastProps,
  | "message"
  | "actionLabel"
  | "onAction"
  | "tone"
  | "icon"
  | "isIconFilled"
  | "topOffset"
  | "variant"
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
