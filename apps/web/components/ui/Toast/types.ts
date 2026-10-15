import type { LucideIcon } from "lucide-react";
import type * as React from "react";

export type ToastTone = "neutral" | "success" | "warning" | "danger";

/** Where the toast sits. Absolute is inside its nearest positioned container, fixed is on the viewport. */
export type ToastPosition = "absolute" | "fixed";

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
  /** Called when the wait is over. Without it the toast never closes itself. */
  onClose?: () => void;
  /** How long the toast waits, in milliseconds, with or without an action. */
  duration?: number;
  position?: ToastPosition;
  /** The toast is its own live region. Pass false when an enclosing live region announces it. */
  announce?: boolean;
};

/** What a screen passes to `show`. The provider owns opening, closing and placement. */
export type ToastOptions = Pick<
  ToastProps,
  "message" | "actionLabel" | "onAction" | "tone" | "icon"
>;

export type ToastContextValue = {
  /** Shows a toast. One shows at a time, so a new toast replaces the current one. */
  show: (options: ToastOptions) => void;
};

export type ToastProviderProps = {
  children: React.ReactNode;
};
