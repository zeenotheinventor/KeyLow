import { addCalendarDays } from "../../src/dates";
import { checkinStep, toDayInputs } from "../../src/engine";
import { expenditureMeasurementSchema, targetsBasisSchema } from "../../src/schemas";

import type { CheckinResult } from "../../src/engine";
import type { ProgramSnapshot, ProgramTargets } from "../../src/program";
import type { CheckinFixture } from "../../src/testing";

/*
 * Test inputs for the program model. Every row comes from running `checkinStep` on a shared fixture and
 * reading the result the way the screens hold it: camelCase, with `measurement` and `basis` parsed by
 * core's schemas (which is what the programme read in `@keylow/api-client` does).
 */

export const DAY_ZERO = "2026-04-02";

type CheckinOverrides = Readonly<{
  prior?: { muKcal: number; varKcal2: number };
  program?: Partial<CheckinFixture["program"]>;
  bmrKcal?: number;
  weighInDays?: readonly number[];
}>;

/** The check-in `daysAfterDayZero` days after day 0, from the fixture's rows. */
export function runCheckin(
  fixture: CheckinFixture,
  daysAfterDayZero: number,
  overrides: CheckinOverrides = {},
): CheckinResult {
  const { prior = fixture.prior, program = {}, bmrKcal = fixture.bmrKcal, weighInDays } = overrides;
  return checkinStep({
    asOfDate: addCalendarDays(DAY_ZERO, daysAfterDayZero),
    prior,
    weighIns:
      weighInDays === undefined
        ? fixture.weighIns
        : fixture.weighIns.filter((_, day) => weighInDays.includes(day)),
    days: toDayInputs(fixture.dayTotals, fixture.dayLogs),
    program: { ...fixture.program, ...program },
    bmrKcal,
  });
}

/** The belief a result leaves, to feed the next check-in of a chain. */
export function beliefOf({ snapshot }: CheckinResult): { muKcal: number; varKcal2: number } {
  return { muKcal: snapshot.mu_kcal, varKcal2: snapshot.var_kcal2 };
}

export function snapshotOf({ snapshot }: CheckinResult): ProgramSnapshot {
  return {
    kind: "checkin",
    asOfDate: snapshot.as_of_date,
    muKcal: snapshot.mu_kcal,
    varKcal2: snapshot.var_kcal2,
    measurement: expenditureMeasurementSchema.parse(snapshot.measurement),
  };
}

export function targetsOf({ targets }: CheckinResult): ProgramTargets {
  return {
    caloriesKcal: targets.calories_kcal,
    basis: targetsBasisSchema.parse(targets.basis),
  };
}

/** The targets of the setup estimate, 2060 kcal for the golden person (ADR 0002, Amendment 1). */
export function startTargets(result: CheckinResult): ProgramTargets {
  const { basis } = targetsOf(result);
  return {
    caloriesKcal: 2060,
    basis: { ...basis, source: "start", tdeeKcal: 2500, trendWeightKg: 80, clamps: [] },
  };
}
