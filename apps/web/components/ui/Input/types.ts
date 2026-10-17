import type { LucideIcon } from "lucide-react";
import type * as React from "react";

export type TextFieldProps = Omit<
  React.ComponentProps<"input">,
  "aria-invalid" | "aria-describedby"
> & {
  label: string;
  /** One short sentence under the field. An error replaces it. */
  helper?: string | undefined;
  /** Says what to do. Turns the border danger and is announced as an alert. */
  error?: string | undefined;
  /** A short note beside the label, such as "Required". It also describes the field. */
  labelHint?: string | undefined;
  /** Flags the field invalid when something else on the page says why, such as a message that covers a whole row. */
  invalid?: boolean | undefined;
  /** The id of an element that also describes the field. It is read after the hint and the message. */
  describedBy?: string | undefined;
  /** A decorative icon at the end of the box, such as a lock on a field that cannot be changed. */
  trailingIcon?: LucideIcon | undefined;
};

/** What the control inside a `Field` needs to be named, flagged and described. */
export type FieldControlProps = {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby": string | undefined;
};

export type FieldProps = {
  id?: string | undefined;
  label: React.ReactNode;
  helper?: string | undefined;
  error?: string | undefined;
  labelHint?: string | undefined;
  invalid?: boolean | undefined;
  describedBy?: string | undefined;
  disabled?: boolean | undefined;
  /** Keeps the label for a screen reader and takes it off the screen, for a field whose visible name sits elsewhere. */
  hideLabel?: boolean | undefined;
  /** Draws the control from the props that tie it to the label and the message. */
  children: (control: FieldControlProps) => React.ReactNode;
};
