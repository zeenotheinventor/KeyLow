import type { ReactNode } from "react";

export type CheckboxProps = {
  /** Whether the box is ticked. The screen keeps it, so a press only asks for the opposite. */
  checked: boolean;
  onChange: (checked: boolean) => void;
  /**
   * What is written beside the box: a string, or a Text tree whose links handle their own press, such as
   * the sign-up screen's Terms and Privacy Policy. Pressing the words toggles, and pressing a link does not.
   */
  label: ReactNode;
  /** Stops the box responding and dims it to half. */
  disabled?: boolean | undefined;
  /** The accessible name when the label's plain words are not the right one. Defaults to those words. */
  accessibilityLabel?: string | undefined;
};
