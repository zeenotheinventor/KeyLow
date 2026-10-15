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
};
