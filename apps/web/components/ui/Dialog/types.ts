import type * as React from "react";

export type DialogProps = {
  open: boolean;
  /** Called for Escape, the Close button and a press on the dimmed page. The owner closes it. */
  onClose: () => void;
  /** The dialog's accessible name, shown as its heading. */
  title: string;
  children?: React.ReactNode;
  /** The name of the icon button in the header, which calls `onClose`. Say what closing does when "Close" would be ambiguous. */
  closeLabel?: string;
  /** The actions, right aligned, such as Cancel and a primary button. */
  footer?: React.ReactNode;
  /** An action set apart on the left of the footer, such as a destructive Delete. */
  leadingAction?: React.ReactNode;
  /** A control in the header before Close, such as the plate chip. */
  headerAction?: React.ReactNode;
  /**
   * A band under the header that does not scroll with the body, such as the day's bars. It brings its own
   * padding and hairline, so what it holds is the only thing the owner sizes.
   */
  strip?: React.ReactNode;
  /** Set to false to leave the body's 20 px padding off, for children that bring their own, such as two columns. */
  bodyPadding?: boolean;
  /**
   * Dims Close and stops Escape, a press on the dimmed page and Close from calling `onClose`, while the owner is
   * busy and must not be interrupted, such as while a plate is being logged.
   */
  closeDisabled?: boolean;
  /** Classes for the panel, such as a height for a dialog that keeps one size through its steps. */
  className?: string;
  /**
   * Where focus goes when the dialog closes, for a dialog opened from inside another or from a control that
   * will be gone. Without it focus returns to the element that was focused when the dialog opened.
   */
  returnFocusTo?: Element | null;
};
