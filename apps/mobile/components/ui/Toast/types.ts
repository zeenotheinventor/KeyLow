import type { IconName } from "../Icon";
import type { ReactNode } from "react";

export type ToastTone = "neutral" | "success" | "warning" | "danger";

export type ToastProps = {
  /** One short sentence, without a full stop or an exclamation mark. */
  message: string;
  /** The one action, such as Undo after a delete. */
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  /** Colours the icon only. The words stay in the primary text colour. Defaults to `neutral`. */
  tone?: ToastTone | undefined;
  icon?: IconName | undefined;
  /** Defaults to true. A toast that is not open draws nothing. */
  open?: boolean | undefined;
  /** Called when the wait is over. Without it the toast never closes itself. */
  onClose?: (() => void) | undefined;
  /** How long the toast waits, in milliseconds, with or without an action. Defaults to 5000. */
  duration?: number | undefined;
  /**
   * The safe area under the tab bar, in points, which the toast sits above. The screen reads it from
   * `useSafeAreaInsets`, as it gives the tab bar its own. Defaults to 0.
   */
  bottomInset?: number | undefined;
  /**
   * Extra points to sit above the tab bar, for a bar that stands on it, such as the search dock. The
   * provider fills this from `useToastClearance`. Defaults to 0.
   */
  bottomClearance?: number | undefined;
};

/** What a screen passes to `show`. The provider owns opening, closing and placement. */
export type ToastOptions = Pick<
  ToastProps,
  "message" | "actionLabel" | "onAction" | "tone" | "icon"
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
