import type { SetupProgram } from "@keylow/api-client";
import type { WeightDisplayUnit } from "@keylow/core/weight";

export type ProgramEditFormProps = {
  /** The active programme the form starts from. */
  program: SetupProgram;
  /** The person's age on `today`, or 0 when no birth date is on the profile, so that Lose is not offered. */
  ageYears: number;
  /** The weight the rate and protein values are worked out at, in kilograms. */
  weightKg: number;
  weightUnit: WeightDisplayUnit;
  /** The newest expenditure estimate that a save keeps, or null while there is none to name. */
  expenditureKcal: number | null;
  /** The person's local date, `YYYY-MM-DD`, which the age rule of the save needs. */
  today: string;
};
