export type BirthDateStepProps = {
  /** The birth date to start the fields from, `YYYY-MM-DD`, or `undefined` for empty fields. */
  value: string | undefined;
  /** Today as `YYYY-MM-DD` in the device's time zone, which the age and the checks are worked from. */
  today: string;
  /** Called with the birth date once the fields hold one that can be used, and with `undefined` when they do not. */
  onChange: (birthDate: string | undefined) => void;
};
