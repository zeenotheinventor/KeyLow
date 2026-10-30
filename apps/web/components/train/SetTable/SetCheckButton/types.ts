import type * as React from "react";

export type SetCheckButtonProps = {
  /** What pressing it does, such as "Log set 3, 180 kilograms, 11 reps". It is the button's accessible name. */
  name: string;
  /** A logged set is filled in the success colour and pressing it takes the set back. */
  isLogged: boolean;
  /** Absent for a set still being saved, which the button then leaves alone. */
  onPress: ((event: React.MouseEvent<HTMLButtonElement>) => void) | undefined;
};
