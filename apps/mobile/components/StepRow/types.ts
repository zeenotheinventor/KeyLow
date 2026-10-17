export type StepRowProps = {
  /** The step's place in the method, starting at 1. */
  number: number;
  /** The whole step. It wraps and is never clamped. */
  text: string;
};
