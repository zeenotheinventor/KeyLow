import type * as React from "react";

export type IncompleteDaysChipProps = Omit<
  React.HTMLAttributes<HTMLElement>,
  "children" | "onClick"
> & {
  /** How many days of the week are not yet complete. Zero means the week is done. */
  count?: number;
  /** Makes the chip a button. Without it the chip is plain text. */
  onPress?: () => void;
};
