import { ageInYears } from "../dates";

/** Where the weight of Edit programme can come from, from the most to the least current. */
export type ProgramEditWeightSources = Readonly<{
  /** The newest point of the weight trend. */
  trendKg: number | undefined;
  /** The latest weigh-in the setup holds, or null or undefined when there is none. */
  latestWeighInKg: number | null | undefined;
  /** The trend weight the current targets were worked out at. */
  currentTargetsKg: number | undefined;
}>;

/**
 * The weight that the rate and protein values of Edit programme are worked out at: the trend weight, then
 * the latest weigh-in, then the weight the current targets were worked out at. Undefined when none is known.
 */
export function programEditWeightKg({
  trendKg,
  latestWeighInKg,
  currentTargetsKg,
}: ProgramEditWeightSources): number | undefined {
  return trendKg ?? latestWeighInKg ?? currentTargetsKg;
}

/**
 * The person's age on `today`, which decides the goals Edit programme offers. With no birth date there is no
 * proof of age, so it is 0 and Lose is not offered, as the save decides it.
 */
export function programEditAgeYears(birthDate: string | null, today: string): number {
  return birthDate === null ? 0 : ageInYears(birthDate, today);
}

/**
 * The expenditure estimate a save keeps: the newest snapshot's, whichever programme made it. Null while there is
 * none to name.
 */
export function newestExpenditureKcal(
  snapshots: readonly Readonly<{ asOfDate: string; muKcal: number }>[] | undefined,
): number | null {
  const newest = [...(snapshots ?? [])]
    .sort((first, second) => first.asOfDate.localeCompare(second.asOfDate))
    .at(-1);

  return newest?.muKcal ?? null;
}
