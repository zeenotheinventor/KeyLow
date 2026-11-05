export type DaysStepProps = {
  /** The days a week chosen, or `undefined` when none is chosen yet. */
  value: number | undefined;
  onChange: (days: number) => void;
};
