import { toDayInputs } from "@keylow/core/engine";
import { goldenCheckinFixture, ineligibleCheckinFixture } from "@keylow/core/testing";

import { ReplayInputError } from "./replayInputError.ts";

import type { ReplayInput } from "./replay.ts";
import type { CheckinFixture } from "@keylow/core/testing";

/** Day 0 of the fixtures. The check-ins fall on days 14, 21 and 28, so on 16, 23 and 30 April. */
const DAY_ZERO = "2026-04-02";

const FIXTURES = {
  golden: goldenCheckinFixture,
  ineligible: ineligibleCheckinFixture,
  // The name the plan gave the ineligible fixture. It has 9 complete days, not 6 (ADR 0002, Amendment 2, Q8).
  "six-complete-days": ineligibleCheckinFixture,
};

const FIXTURE_NAMES = Object.keys(FIXTURES);
const FIXTURE_NAMES_IN_WORDS = `${FIXTURE_NAMES.slice(0, -1).join(", ")} or ${FIXTURE_NAMES.slice(-1).join("")}`;

function toInput(fixture: CheckinFixture): ReplayInput {
  return {
    startedOn: DAY_ZERO,
    program: fixture.program,
    weighIns: fixture.weighIns,
    days: toDayInputs(fixture.dayTotals, fixture.dayLogs),
    // A fixture holds its prior and BMR as numbers, so the start snapshot is not worked out from stats.
    start: () => ({ prior: fixture.prior, bmrKcalOn: () => fixture.bmrKcal }),
  };
}

/** The replay input of a named fixture of `@keylow/core/testing`. */
export function fixtureInput(name: string): ReplayInput {
  const build = Object.entries(FIXTURES).find(([fixtureName]) => fixtureName === name)?.[1];
  if (build === undefined) {
    throw new ReplayInputError(`Unknown fixture. Use ${FIXTURE_NAMES_IN_WORDS}.`);
  }
  return toInput(build(DAY_ZERO));
}
