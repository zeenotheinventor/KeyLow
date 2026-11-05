export type MinutesStepProps = {
  /** The minutes a session takes, or `undefined` while none is given or the Other field holds none. */
  value: number | undefined;
  /** Gives the minutes, or `undefined` to take them back. A number outside the allowed range is given too, so Next can stay off. */
  onChange: (minutes: number | undefined) => void;
};
