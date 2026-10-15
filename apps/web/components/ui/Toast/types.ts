import type { LucideIcon } from "lucide-react";
import type * as React from "react";

export type ToastTone = "neutral" | "success" | "warning" | "danger";

/** Where the toast sits. Absolute is inside its nearest positioned container, fixed is on the viewport. */
export type ToastPosition = "absolute" | "fixed";

/**
 * The keyboard route to the action. A screen asks for it when the person pressed a button with the keyboard
 * (a delete, a copy), because the toast sits after the page and a keyboard user could not reach Undo within
 * the wait.
 */
export type ToastFocusAction = {
  /**
   * Where focus goes when the toast closes with focus still on it: the next row after a delete, or the
   * button pressed after a copy. Null leaves focus where the browser puts it. A target that has left the
   * page is skipped.
   */
  returnTo: HTMLElement | null;
};

export type ToastProps = {
  /** One short sentence, without a full stop or an exclamation mark. */
  message: string;
  /** The one action, such as Undo after a delete. */
  actionLabel?: string;
  onAction?: () => void;
  /** Colours the icon only. The words stay in the primary text colour. */
  tone?: ToastTone;
  icon?: LucideIcon;
  open?: boolean;
  /**
   * Called when the wait is over, and when Escape is pressed with focus inside the toast. Without it
   * the toast never closes itself.
   */
  onClose?: () => void;
  /** Moves focus to the action when the toast opens, and back to `returnTo` when it closes. Needs an action. */
  focusAction?: ToastFocusAction;
  /** How long the toast waits, in milliseconds, with or without an action. */
  duration?: number;
  position?: ToastPosition;
  /** The toast is its own live region. Pass false when an enclosing live region announces it. */
  announce?: boolean;
};

/** What a screen passes to `show`. The provider owns opening, closing and placement. */
export type ToastOptions = Pick<
  ToastProps,
  "message" | "actionLabel" | "onAction" | "tone" | "icon" | "focusAction"
>;

export type ToastContextValue = {
  /** Shows a toast. One shows at a time, so a new toast replaces the current one. */
  show: (options: ToastOptions) => void;
};

export type ToastProviderProps = {
  children: React.ReactNode;
};
