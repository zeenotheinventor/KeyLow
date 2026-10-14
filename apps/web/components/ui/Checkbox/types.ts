import type * as React from "react";

export type CheckboxProps = Omit<
  React.ComponentProps<"input">,
  "type" | "children" | "className"
> & {
  /** Names the checkbox. Clicking it toggles the box. */
  label: string;
  className?: string;
};
