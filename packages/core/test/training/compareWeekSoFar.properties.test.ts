import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { asLogged, legs, pull, push, routine, session, WEEK } from "./plans";
import { addCalendarDays, toLocalDate } from "../../src/dates";
import {
  COMPARE_PARAMS_V2,
  compareWeek,
  compareWeekSoFar,
  MUSCLE_IDS,
  projectWeek,
} from "../../src/training";

import type { LoggedSession, LoggedSet, PlannedSet } from "../../src/training";

const params = COMPARE_PARAMS_V2;

const ZONES = ["Europe/London", "America/Los_Angeles", "Pacific/Auckland", "Asia/Kolkata", "UTC"];
const PLANNED_DAYS = [push, legs, pull];
/** The weekdays of `PLANNED_DAYS` in the plans: Monday, Wednesday and Friday. */
const PLANNED_WEEKDAYS = [0, 2, 4];
const HOURS_IN_WEEK = 168;
const MILLISECONDS_PER_HOUR = 3_600_000;
const WEEK_START = Date.UTC(2026, 9, 19);

const toIso = (milliseconds: number): string => new Date(milliseconds).toISOString();

/** Any instant from the Sunday before the week to the Monday after it. */
const anyMoment = fc.integer({ min: Date.UTC(2026, 9, 18), max: Date.UTC(2026, 9, 27) }).map(toIso);

/** An evening of a planned weekday (Monday, Wednesday or Friday), where the day's own plan matters. */
const plannedEvening = fc
  .tuple(
    fc.constantFrom(0, 2, 4),
    fc.integer({ min: 16, max: 31 }),
    fc.integer({ min: 0, max: 59 }),
  )
  .map(([weekday, hour, minute]) =>
    toIso(WEEK_START + (weekday * 24 + hour) * MILLISECONDS_PER_HOUR + minute * 60_000),
  );

const moment = fc.oneof(anyMoment, plannedEvening);

/** For each planned day, the hour of the week it was logged at, or null when it was not logged. */
const loggedHours = fc.tuple(
  ...PLANNED_DAYS.map(() =>
    fc.option(fc.integer({ min: 0, max: HOURS_IN_WEEK - 1 }), { nil: null }),
  ),
);

/** For each planned day, the hour of the week it was logged at. */
const everyDayLoggedHours = fc.tuple(
  ...PLANNED_DAYS.map(() => fc.integer({ min: 0, max: HOURS_IN_WEEK - 1 })),
);

/** The week with each planned day logged exactly as planned at its hour, or left unlogged when null. */
const weekLogged = (tz: string, hours: readonly (number | null)[]) => {
  const sessions: LoggedSession[] = [];
  const sets: LoggedSet[] = [];
  const setsOfDay: (LoggedSet[] | null)[] = [];
  const { planned } = projectWeek(routine, WEEK, tz, { sessions: [], sets: [] }, params);
  for (const [index, day] of PLANNED_DAYS.entries()) {
    const hour = hours[index];
    if (hour === null || hour === undefined) {
      setsOfDay.push(null);
      continue;
    }
    const logged = session(index + 1, addCalendarDays(WEEK, Math.floor(hour / 24)), day.id);
    const performedAt = toIso(WEEK_START + hour * MILLISECONDS_PER_HOUR);
    const daySets = asLogged(
      planned.filter((set) => set.routine_day_id === day.id),
      logged,
      performedAt,
    );
    sessions.push(logged);
    sets.push(...daySets);
    setsOfDay.push(daySets);
  }
  return { sessions, sets, setsOfDay, planned };
};

const shuffledBy = <Item>(items: readonly Item[], orderKeys: readonly number[]): Item[] =>
  items
    .map((item, index) => ({ item, key: orderKeys[index % orderKeys.length] ?? 0 }))
    .sort((first, second) => first.key - second.key)
    .map(({ item }) => item);

describe("compareWeekSoFar, properties", () => {
  it("should plan the logged days and the unlogged planned days dated before today, in any order", () => {
    fc.assert(
      fc.property(
        moment,
        fc.constantFrom(...ZONES),
        loggedHours,
        fc.array(fc.nat(), { minLength: 20, maxLength: 20 }),
        (at, tz, hours, orderKeys) => {
          const { sessions, sets, setsOfDay, planned } = weekLogged(tz, hours);
          const projection = projectWeek(routine, WEEK, tz, { sessions, sets }, params);

          // Worked from the days, not from the projection: a day is planned when it was logged or has
          // passed without a session, and a logged day gives its logged sets.
          const today = toLocalDate(new Date(at), tz);
          const expectedProjected = PLANNED_DAYS.flatMap<PlannedSet | LoggedSet>((day, index) => {
            const loggedSetsOfDay = setsOfDay[index];
            if (loggedSetsOfDay !== null && loggedSetsOfDay !== undefined) {
              return loggedSetsOfDay;
            }
            const date = addCalendarDays(WEEK, PLANNED_WEEKDAYS[index] ?? 0);
            return date < today ? planned.filter((set) => set.routine_day_id === day.id) : [];
          });

          const soFar = compareWeekSoFar(projection, at, tz, params);
          expect(soFar).toEqual(compareWeek(projection.actual, expectedProjected, params));

          const shuffled = {
            ...projection,
            actual: shuffledBy(projection.actual, orderKeys),
            projected: shuffledBy(projection.projected, orderKeys),
          };
          expect(compareWeekSoFar(shuffled, at, tz, params)).toEqual(soFar);
        },
      ),
    );
  });

  it("should read a gap of 0 for every muscle when every planned day is logged exactly as planned", () => {
    fc.assert(
      fc.property(moment, fc.constantFrom(...ZONES), everyDayLoggedHours, (at, tz, hours) => {
        const { sessions, sets } = weekLogged(tz, hours);
        const projection = projectWeek(routine, WEEK, tz, { sessions, sets }, params);

        for (const comparison of Object.values(compareWeekSoFar(projection, at, tz, params))) {
          expect(comparison.gap).toBe(0);
          expect(comparison.status).toBe("on_plan");
        }
      }),
    );
  });

  it("should never plan more than the whole week or log less", () => {
    fc.assert(
      fc.property(moment, fc.constantFrom(...ZONES), loggedHours, (at, tz, hours) => {
        const { sessions, sets } = weekLogged(tz, hours);
        const projection = projectWeek(routine, WEEK, tz, { sessions, sets }, params);
        const whole = compareWeek(projection.actual, projection.projected, params);

        const soFar = compareWeekSoFar(projection, at, tz, params);
        for (const muscle of MUSCLE_IDS) {
          expect(soFar[muscle].actualWeeklySets).toBe(whole[muscle].actualWeeklySets);
          expect(soFar[muscle].projectedWeeklySets).toBeLessThanOrEqual(
            whole[muscle].projectedWeeklySets,
          );
        }
      }),
    );
  });
});
