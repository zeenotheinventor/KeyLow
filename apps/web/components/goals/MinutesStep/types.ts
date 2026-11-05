export type MinutesStepProps = {
  /** The session length chosen, or `undefined` when none is given yet. */
  value: number | undefined;
  /** Called with the minutes, or `undefined` while Other is chosen and its field holds none. */
  onChange: (minutes: number | undefined) => void;
};
