import { addCalendarDays } from "@keylow/core/dates";
import { checkinStep, dueCheckinDates, firstCheckinDate } from "@keylow/core/engine";

import { ReplayInputError } from "./replayInputError.ts";
import { toReplayRow } from "./replayRow.ts";

import type { ReplayRow } from "./replayRow.ts";
import type {
  CheckinProgram,
  DayInput,
  EngineParams,
  ExpenditureBelief,
  TrendInput,
} from "@keylow/core/engine";

/** Where a replay starts: the belief before the first check-in, and the BMR the targets' floor reads. */
export type ReplayStart = Readonly<{
  prior: ExpenditureBelief;
  /** Mifflin-St Jeor on the check-in day, in kilocalories a day. */
  bmrKcalOn: (asOfDate: string) => number;
}>;

/** Everything a replay reads. It is plain data and a function: there is no database behind it. */
export type ReplayInput = Readonly<{
  /** The day the schedule was set. The first check-in is 14 days later. */
  startedOn: string;
  program: CheckinProgram;
  weighIns: readonly TrendInput[];
  days: readonly DayInput[];
  onboardingWeightKg?: number | undefined;
  /** The start snapshot's belief and the BMR, which both depend on the params being tried. */
  start: (params: EngineParams) => ReplayStart;
}>;

/** The newest date any weigh-in or day carries, or null when there is none. */
function lastDataDate({ weighIns, days }: ReplayInput): string | null {
  const dates = [
    ...weighIns.map(({ localDate }) => localDate),
    ...days.map(({ localDate }) => localDate),
  ];
  return dates.reduce<string | null>(
    (last, date) => (last === null || date > last ? date : last),
    null,
  );
}

/** Every number of a row, so that one that is not finite can be found. A null is a figure that does not apply. */
function numbersOf(row: ReplayRow): number[] {
  return [
    row.muKcal,
    row.bandLowKcal,
    row.bandHighKcal,
    row.gain,
    row.stepKcal,
    row.trendWeightKg,
    row.caloriesKcal,
    row.proteinG,
    row.fatG,
    row.carbsG,
  ].filter((figure) => figure !== null);
}

/**
 * Runs the engine week by week: a `checkinStep` on each scheduled date from 14 days after `startedOn`, each
 * fed the belief the last one left. A check-in reads only the days before its date, so the last one is
 * the day after the last day of data. A replay of a history with no data has no rows. A row with a number that
 * is not finite stops the replay with a `ReplayInputError` that names the date.
 */
export function replay(input: ReplayInput, params: EngineParams): ReplayRow[] {
  const lastDay = lastDataDate(input);
  if (lastDay === null) {
    return [];
  }
  const { prior, bmrKcalOn } = input.start(params);
  let belief = prior;
  const rows: ReplayRow[] = [];
  for (const asOfDate of dueCheckinDates(
    firstCheckinDate(input.startedOn),
    addCalendarDays(lastDay, 1),
  )) {
    const result = checkinStep(
      {
        asOfDate,
        prior: belief,
        weighIns: input.weighIns,
        days: input.days,
        program: input.program,
        bmrKcal: bmrKcalOn(asOfDate),
        ...(input.onboardingWeightKg === undefined
          ? {}
          : { onboardingWeightKg: input.onboardingWeightKg }),
      },
      params,
    );
    belief = { muKcal: result.snapshot.mu_kcal, varKcal2: result.snapshot.var_kcal2 };
    const row = toReplayRow(result);
    if (!numbersOf(row).every(Number.isFinite)) {
      // Params that break a documented floor, such as minCompleteDays of 0, give NaN. It has no JSON form.
      throw new ReplayInputError(
        `The engine gave a value that is not a number on ${asOfDate}. Check the --param values.`,
      );
    }
    rows.push(row);
  }
  return rows;
}
