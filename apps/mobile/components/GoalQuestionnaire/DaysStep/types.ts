export type DaysStepProps = {
  /** The days a week chosen, or `undefined` while none is. */
  value: number | undefined;
  onChange: (days: number) => void;
};
