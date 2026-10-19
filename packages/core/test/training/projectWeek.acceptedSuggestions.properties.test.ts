import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { curlSuggestion } from "./acceptedSuggestions";
import {
  arms,
  curl,
  curlMuscles,
  dayId,
  legs,
  loggedSets,
  pull,
  push,
  routine,
  session,
  WEEK,
} from "./plans";
import { addCalendarDays } from "../../src/dates";
import { COMPARE_PARAMS_V1, expandPlan, projectWeek } from "../../src/training";

import type { LoggedSession, LoggedSet, LoggedWeek } from "../../src/training";

const params = COMPARE_PARAMS_V1;

const ZONES = ["Europe/London", "America/Los_Angeles", "Pacific/Auckland", "Asia/Kolkata", "UTC"];
const WEEK_DAYS = Array.from({ length: 7 }, (_, offset) => addCalendarDays(WEEK, offset));
const DAY_CHOICES = [push.id, legs.id, pull.id, arms.id, dayId(99), null];
const PERFORMED_AT = "2026-10-21T17:00:00.000Z";

/*
 * The projection before accepted suggestions were read (KEY-402), restated here from the documented rules
 * and `expandPlan`, so a change that moves a result with no suggestion given is caught.
 */
const projectWeekBeforeSuggestions = (
  tz: string,
  logged: LoggedWeek,
  routineToProject = routine,
) => {
  const planned = expandPlan(routineToProject, WEEK, tz, params);
  const days = new Set(WEEK_DAYS);
  const routineDayIds = new Set(routineToProject.days.map((day) => day.id));
  const sessions = logged.sessions.filter(
    (each) => each.deleted_at === null && days.has(each.local_date),
  );
  const sessionIds = new Set(sessions.map((each) => each.id));
  const planSessionIds = new Set<string>();
  const loggedDayIds = new Set<string>();
  for (const { id, routine_day_id } of sessions) {
    if (routine_day_id !== null && routineDayIds.has(routine_day_id)) {
      planSessionIds.add(id);
      loggedDayIds.add(routine_day_id);
    }
  }
  const actual = logged.sets.filter(
    (set) => set.deleted_at === null && sessionIds.has(set.session_id),
  );
  const projected = [
    ...planned.filter(
      (set) => set.routine_day_id === null || !loggedDayIds.has(set.routine_day_id),
    ),
    ...actual.filter((set) => planSessionIds.has(set.session_id)),
  ];
  return { planned, actual, projected };
};

type SessionDraft = { offset: number; choice: number; deleted: boolean; setCount: number };

/** A day from the Sunday before the week to the Monday after it. */
const sessionDraft: fc.Arbitrary<SessionDraft> = fc.record({
  offset: fc.integer({ min: -1, max: 7 }),
  choice: fc.integer({ min: 0, max: DAY_CHOICES.length - 1 }),
  deleted: fc.boolean(),
  setCount: fc.integer({ min: 0, max: 4 }),
});

const loggedFrom = (
  drafts: readonly SessionDraft[],
): { sessions: LoggedSession[]; sets: LoggedSet[] } => {
  const sessions = drafts.map((draft, index) =>
    session(index + 1, addCalendarDays(WEEK, draft.offset), DAY_CHOICES[draft.choice] ?? null, {
      deleted_at: draft.deleted ? "2026-10-25T12:00:00.000Z" : null,
    }),
  );
  const sets = sessions.flatMap((each, index) =>
    loggedSets(each, curl, curlMuscles, drafts[index]?.setCount ?? 0, PERFORMED_AT),
  );
  return { sessions, sets };
};

const loggedWeek = fc.array(sessionDraft, { maxLength: 6 });

/** Accepted suggestions on distinct days from the Sunday before the week to the Monday after it. */
const suggestionDrafts = fc.uniqueArray(
  fc.record({ offset: fc.integer({ min: -1, max: 7 }), folded: fc.integer({ min: -1, max: 3 }) }),
  { selector: (draft) => draft.offset, maxLength: 5 },
);

const suggestionsFrom = (drafts: readonly { offset: number; folded: number }[]) =>
  drafts.map((draft) =>
    curlSuggestion(addCalendarDays(WEEK, draft.offset), DAY_CHOICES[draft.folded] ?? null),
  );

describe("projectWeek, properties of accepted suggestions", () => {
  it("should give the same result as before for any week when none is given, left out or empty", () => {
    fc.assert(
      fc.property(fc.constantFrom(...ZONES), loggedWeek, (tz, drafts) => {
        const logged = loggedFrom(drafts);
        const before = projectWeekBeforeSuggestions(tz, logged);

        expect(projectWeek(routine, WEEK, tz, logged, params)).toEqual(before);
        expect(
          projectWeek(routine, WEEK, tz, { ...logged, acceptedSuggestions: [] }, params),
        ).toEqual(before);
      }),
    );
  });

  it("should give the same result as before when the routine plans only some days, or from a day", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ZONES),
        loggedWeek,
        fc.subarray([push, legs, pull, arms]),
        fc.option(fc.integer({ min: 0, max: 7 }), { nil: undefined }),
        (tz, drafts, days, activeOffset) => {
          const logged = loggedFrom(drafts);
          const partial = {
            days,
            ...(activeOffset === undefined
              ? {}
              : { activeFrom: addCalendarDays(WEEK, activeOffset) }),
          };

          expect(projectWeek(partial, WEEK, tz, logged, params)).toEqual(
            projectWeekBeforeSuggestions(tz, logged, partial),
          );
        },
      ),
    );
  });

  it("should never change actual, or the routine's own planned and projected sets, whatever is accepted", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ZONES),
        loggedWeek,
        suggestionDrafts,
        (tz, drafts, accepted) => {
          const logged = loggedFrom(drafts);
          const before = projectWeekBeforeSuggestions(tz, logged);
          const after = projectWeek(
            routine,
            WEEK,
            tz,
            { ...logged, acceptedSuggestions: suggestionsFrom(accepted) },
            params,
          );

          expect(after.actual).toEqual(before.actual);
          expect(after.planned.slice(0, before.planned.length)).toEqual(before.planned);
          // Every set the projection had before is still there.
          expect(after.projected).toEqual(expect.arrayContaining(before.projected));
        },
      ),
    );
  });

  describe("with suggestions", () => {
    const projectWith = (
      tz: string,
      logged: LoggedWeek,
      accepted: readonly { offset: number; folded: number }[],
    ) => {
      const suggestions = suggestionsFrom(accepted);
      const week = projectWeek(
        routine,
        WEEK,
        tz,
        { ...logged, acceptedSuggestions: suggestions },
        params,
      );
      const before = projectWeekBeforeSuggestions(tz, logged);
      const days = new Set(WEEK_DAYS);
      const liveSessions = logged.sessions.filter(
        (each) => each.deleted_at === null && days.has(each.local_date),
      );
      const loggedDayIds = new Set(
        liveSessions.flatMap((each) =>
          each.routine_day_id !== null && routine.days.some((day) => day.id === each.routine_day_id)
            ? [each.routine_day_id]
            : [],
        ),
      );
      const inWeek = suggestions.filter((each) => days.has(each.local_date));
      const foldedInRoutine = (each: (typeof inWeek)[number]): boolean =>
        routine.days.some((day) => day.id === each.routine_day_id);
      const kept = inWeek.filter((each) =>
        foldedInRoutine(each)
          ? !loggedDayIds.has(each.routine_day_id ?? "")
          : !liveSessions.some((live) => live.local_date === each.local_date),
      );
      return { week, before, inWeek, kept, liveSessions, foldedInRoutine };
    };

    it("should plan 3 sets for each suggestion of the week, and keep exactly those no session replaces", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ZONES),
          loggedWeek,
          suggestionDrafts,
          (tz, drafts, accepted) => {
            const { week, before, inWeek, kept } = projectWith(tz, loggedFrom(drafts), accepted);
            const suggestedPlanned = week.planned.slice(before.planned.length);

            expect(suggestedPlanned).toHaveLength(3 * inWeek.length);
            expect(
              week.projected.filter((set) => suggestedPlanned.some((each) => each === set)),
            ).toHaveLength(3 * kept.length);
            expect(
              new Set(
                week.projected.flatMap((set) =>
                  suggestedPlanned.some((each) => each === set) && "planned" in set
                    ? [set.local_date]
                    : [],
                ),
              ),
            ).toEqual(new Set(kept.map((each) => each.local_date)));
          },
        ),
      );
    });

    it("should stand every live session of a suggestion's date in its place, with all its live sets", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ZONES),
          loggedWeek,
          suggestionDrafts,
          (tz, drafts, accepted) => {
            const logged = loggedFrom(drafts);
            const { week, before, inWeek, liveSessions, foldedInRoutine } = projectWith(
              tz,
              logged,
              accepted,
            );
            const dates = new Set(
              inWeek.filter((each) => !foldedInRoutine(each)).map((each) => each.local_date),
            );
            const standIn = liveSessions.filter((each) => dates.has(each.local_date));
            const expectedSets = logged.sets.filter(
              (set) =>
                set.deleted_at === null && standIn.some((each) => each.id === set.session_id),
            );
            // No other logged set joins the projection: a folded suggestion's date stands nothing in.
            const projectedLogged = week.projected.filter((set) => !("planned" in set));
            for (const set of projectedLogged) {
              expect([...before.projected, ...expectedSets]).toContain(set);
            }

            for (const set of expectedSets) {
              expect(week.projected).toContain(set);
            }
          },
        ),
      );
    });
  });
});
