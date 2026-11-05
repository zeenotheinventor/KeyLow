import type * as React from "react";

export type SetMarkButtonProps = {
  /** What pressing it does, such as "Set type, leg press set 3". It is the button's accessible name. */
  name: string;
  /** "W", "3", "D" or "F". */
  label: string;
  /** Absent for a set that cannot change its type just now, which the button then leaves alone. */
  onPress: ((event: React.MouseEvent<HTMLButtonElement>) => void) | undefined;
};
