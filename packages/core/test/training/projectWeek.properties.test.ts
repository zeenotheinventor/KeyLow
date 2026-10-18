import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { asLogged, legs, pull, push, routine, session, WEEK } from "./plans";
import { addCalendarDays, toLocalDate } from "../../src/dates";
import { COMPARE_PARAMS_V1, muscleState, projectedState, projectWeek } from "../../src/training";

import type { LoggedSession, LoggedSet } from "../../src/training";

const params = COMPARE_PARAMS_V1;

const ZONES = ["Europe/London", "America/Los_Angeles", "Pacific/Auckland", "Asia/Kolkata", "UTC"];
const PLANNED_DAYS = [push, legs, pull];
const HOURS_IN_WEEK = 168;
const MILLISECONDS_PER_HOUR = 3_600_000;
const WEEK_START = Date.UTC(2026, 9, 19);

const toIso = (milliseconds: number): string => new Date(milliseconds).toISOString();

/** Any instant from the Sunday before the week to the Monday after it. */
const anyMoment = fc.integer({ min: Date.UTC(2026, 9, 18), max: Date.UTC(2026, 9, 27) }).map(toIso);

/** An evening of a planned weekday (Monday, Wednesday or Friday), where today's unlogged plan matters. */
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

describe("projectedState, properties", () => {
  it("should count exactly the logged sets up to the moment and the planned sets dated before its local date, in any order", () => {
    fc.assert(
      fc.property(
        moment,
        fc.constantFrom(...ZONES),
        loggedHours,
        fc.array(fc.nat(), { minLength: 20, maxLength: 20 }),
        (at, tz, hours, orderKeys) => {
          const sessions: LoggedSession[] = [];
          const sets: LoggedSet[] = [];
          const planned = projectWeek(
            routine,
            WEEK,
            tz,
            { sessions: [], sets: [] },
            params,
          ).planned;
          for (const [index, day] of PLANNED_DAYS.entries()) {
            const hour = hours[index];
            if (hour === null || hour === undefined) {
              continue;
            }
            const logged = session(index + 1, addCalendarDays(WEEK, Math.floor(hour / 24)), day.id);
            const performedAt = new Date(WEEK_START + hour * MILLISECONDS_PER_HOUR).toISOString();
            sessions.push(logged);
            sets.push(
              ...asLogged(
                planned.filter((set) => set.routine_day_id === day.id),
                logged,
                performedAt,
              ),
            );
          }
          const { projected } = projectWeek(routine, WEEK, tz, { sessions, sets }, params);

          const today = toLocalDate(new Date(at), tz);
          const counted = projected.filter((set) => !("planned" in set) || set.local_date < today);
          const shuffled = projected
            .map((set, index) => ({ set, key: orderKeys[index % orderKeys.length] ?? 0 }))
            .sort((first, second) => first.key - second.key)
            .map(({ set }) => set);

          const state = projectedState(projected, at, tz, params);
          expect(state).toEqual(muscleState(counted, at, params.training));
          expect(projectedState(shuffled, at, tz, params)).toEqual(state);
        },
      ),
    );
  });
});
