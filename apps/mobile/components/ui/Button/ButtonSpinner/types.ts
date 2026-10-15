import type { ButtonVariant } from "../types";

export type ButtonSpinnerProps = {
  variant: ButtonVariant;
  /** The ghost destructive look: the ring takes the danger colour, as the label does. */
  isDanger?: boolean;
};
