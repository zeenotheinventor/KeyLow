import type * as React from "react";

export type CheckboxProps = Omit<
  React.ComponentProps<"input">,
  "type" | "children" | "className"
> & {
  /** Names the checkbox, and so does any link text inside it. Clicking the text toggles the box. */
  label: React.ReactNode;
  /**
   * For a label that wraps onto more lines, such as a sentence with links. The box sits at the top
   * and the label is regular weight, as the design system's own checkbox is drawn.
   */
  multiline?: boolean;
  className?: string;
};
