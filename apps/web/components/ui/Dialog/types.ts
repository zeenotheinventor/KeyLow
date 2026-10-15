import type * as React from "react";

export type DialogProps = {
  open: boolean;
  /** Called for Escape, the Close button and a press on the dimmed page. The owner closes it. */
  onClose: () => void;
  /** The dialog's accessible name, shown as its heading. */
  title: string;
  children?: React.ReactNode;
  /** The actions, right aligned, such as Cancel and a primary button. */
  footer?: React.ReactNode;
  /** An action set apart on the left of the footer, such as a destructive Delete. */
  leadingAction?: React.ReactNode;
  /** Classes for the panel, such as a height for a dialog that keeps one size through its steps. */
  className?: string;
  /**
   * Where focus goes when the dialog closes, for a dialog opened from inside another or from a control that
   * will be gone. Without it focus returns to the element that was focused when the dialog opened.
   */
  returnFocusTo?: Element | null;
};
