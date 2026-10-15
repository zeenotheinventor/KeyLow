import type * as React from "react";

export type DayCompleteToggleProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-checked" | "children" | "onChange" | "onClick" | "role" | "type"
> & {
  /** Whether the day is marked complete. */
  complete?: boolean;
  /** Asked for when the switch is pressed, with the state it would move to. */
  onChange?: (complete: boolean) => void;
};
