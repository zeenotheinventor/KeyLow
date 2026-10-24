import { addCalendarDays } from "../dates";

import type {
  CheckinProgram,
  DayLogRow,
  DayTotalRow,
  ExpenditureBelief,
  TrendInput,
} from "../engine";

/** The rows and settings of one run of weekly check-ins, as the database would hold them. */
export type CheckinFixture = Readonly<{
  /** One weigh-in a day, from day 0 to day 27. */
  weighIns: readonly TrendInput[];
  /** One `day_totals` row a day, from day 0 to day 27. */
  dayTotals: readonly DayTotalRow[];
  /** The `day_logs` rows. A day without one has a total and no log. */
  dayLogs: readonly DayLogRow[];
  /** The belief before the first check-in. */
  prior: ExpenditureBelief;
  program: CheckinProgram;
  bmrKcal: number;
}>;

const DAYS_OF_DATA = 28;

function dayCounts(): number[] {
  return Array.from({ length: DAYS_OF_DATA }, (_, day) => day);
}

/**
 * ADR 0002, Amendment 2: the golden run of the weekly check-in. Days 0 to 27 from `day0` (`YYYY-MM-DD`)
 * hold a weigh-in of exactly `80 - 0.05 * day` kg, a `day_totals` row of 2200 kcal and a complete
 * `day_logs` row. The prior is 2500 / 140625, the program is a lose goal at 0.5 % a week with protein
 * 1.6 g/kg and fat 0.40 of the remainder, and the BMR is 1755. A check-in 14, 21 and 28 days after `day0`,
 * each fed the last one's snapshot, gives mu 2559.56, 2574.22 and 2579.54, and the day 28 targets are
 * 2140 kcal, P 126, F 73, C 245. The function's HTTP test and the replay harness build the same run.
 */
export function goldenCheckinFixture(day0: string): CheckinFixture {
  return {
    weighIns: dayCounts().map((day) => ({
      localDate: addCalendarDays(day0, day),
      weightKg: 80 - 0.05 * day,
    })),
    dayTotals: dayCounts().map((day) => ({ local_date: addCalendarDays(day0, day), kcal: 2200 })),
    dayLogs: dayCounts().map((day) => ({
      local_date: addCalendarDays(day0, day),
      is_complete: true,
    })),
    prior: { muKcal: 2500, varKcal2: 140625 },
    program: {
      goal: "lose",
      ratePctPerWeek: 0.5,
      proteinGPerKg: 1.6,
      fatFraction: 0.4,
      dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
    },
    bmrKcal: 1755,
  };
}

/** Days 0 to 8 are the only complete days before day 14, so the day 14 window has 9 and needs 10. */
const LAST_COMPLETE_DAY_BEFORE_GAP = 8;
const FIRST_DAY_WITHOUT_LOG = 9;
const LAST_DAY_WITHOUT_LOG = 10;
const FIRST_COMPLETE_DAY_AFTER_GAP = 14;

/**
 * The golden run with too few complete days for the first check-in (Q8 of ADR 0002, Amendment 2): the day
 * 14 window has 9 complete days and 14 weigh-ins over a span of 14, so it is ineligible on `complete_days`
 * alone. Only days 0 to 8 are complete before day 14. Days 9 and 10 keep their totals and have no
 * `day_logs` row, days 11 to 13 have a row that is not complete, and days 14 to 27 are complete again.
 * Everything else is the golden fixture's.
 */
export function ineligibleCheckinFixture(day0: string): CheckinFixture {
  const golden = goldenCheckinFixture(day0);
  return {
    ...golden,
    dayLogs: dayCounts()
      .filter((day) => day < FIRST_DAY_WITHOUT_LOG || day > LAST_DAY_WITHOUT_LOG)
      .map((day) => ({
        local_date: addCalendarDays(day0, day),
        is_complete: day <= LAST_COMPLETE_DAY_BEFORE_GAP || day >= FIRST_COMPLETE_DAY_AFTER_GAP,
      })),
  };
}
