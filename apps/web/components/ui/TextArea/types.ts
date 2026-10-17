import type * as React from "react";

export type TextAreaProps = Omit<
  React.ComponentPropsWithoutRef<"textarea">,
  "aria-invalid" | "aria-describedby"
> & {
  /** What the field is for, such as "Step 3 text". It is the field's accessible name. */
  label: string;
  /** Keeps the label for a screen reader and takes it off the screen, for a field whose visible name sits elsewhere. */
  hideLabel?: boolean | undefined;
  /** Says what to do. Turns the border danger and is announced as an alert. */
  error?: string | undefined;
  /** How much has been written, such as "201 / 1,000". It describes the field and sits at the end of the foot. */
  counter?: string | undefined;
  /** Turns the counter danger, once the text is past what it may hold. */
  isOverLimit?: boolean | undefined;
  /** Controls for the field, such as Done and Cancel. They sit at the start of the foot, level with the counter. */
  footer?: React.ReactNode;
};
