// The session Ki-Lo suggests, for "What should I train today?". The day, and whether there is a suggestion at
// all, are the Today card's (core's `suggestionTargetOf` over `todayPlanOf`, which the Train home asks too),
// the calculation is core's `nextSessionSuggestion`, and the words are the suggestion detail's, so the model
// only phrases them. It writes nothing: accepting a suggestion stays in the app. The exercise library is read
// here and never sent on, only the picks are.
import { z } from "zod";

import {
  EQUIPMENT,
  MAX_SESSION_MINUTES,
  MIN_SESSION_MINUTES,
  MUSCLE_NAMES,
  SUGGESTION_NO_GOAL,
  addCalendarDays,
  daysSinceMonday,
  describeNothingToSuggest,
  describeStoredAcceptedSuggestion,
  describeSuggestionCitation,
  describeSuggestionDetail,
  describeWeekdayName,
  localToday,
  nextSessionSuggestion,
  planRoutineOf,
  suggestionTargetOf,
  todayPlanOf,
} from "../../core.ts";
import {
  getActiveSession,
  getMyTimeZone,
  getRoutine,
  hasLoggedSession,
  listAcceptedSuggestions,
  listSuggestionLibrary,
  listWeekSessions,
  readTrainingInputs,
} from "../../repos.ts";
import { citedResult, zoneOrUtc } from "./diaryView.ts";
import { dataNotice } from "./shared.ts";

import type { ReadToolDefinition, ToolRunOutput } from "../tool.ts";

// Unknown keys are dropped and not refused, so a model that sends one (a planned day, say, which only the
// routine may give) is not left with nothing. A bad value of a key that is here is still refused.
const suggestNextSessionInput = z.object({
  minutes: z
    .number()
    .int()
    .min(MIN_SESSION_MINUTES)
    .max(MAX_SESSION_MINUTES)
    .nullable()
    .default(null)
    .describe(
      `The session length to fit, ${MIN_SESSION_MINUTES} to ${MAX_SESSION_MINUTES}, or null for the goal's.`,
    ),
  equipment: z
    .array(z.enum(EQUIPMENT))
    .min(1)
    .nullable()
    .default(null)
    .describe("Only these kinds of equipment, within the goal's, or null for the goal's."),
});

const mondayOf = (localDate: string): string =>
  addCalendarDays(localDate, -daysSinceMonday(localDate));

export const suggestNextSessionTool: ReadToolDefinition<z.infer<typeof suggestNextSessionInput>> = {
  name: "suggest_next_session",
  description:
    'Gives the session Ki-Lo suggests, for "What should I train today?", for the day the Today card ' +
    "asks for. Answers day (today or a weekday), is_rest_day (then day is the next planned day), " +
    "headline, plan_day (null for a built session), exercises (exercise_id, name, target, origin plan " +
    "or added, why), sets, minutes, skipped (hot muscles left out) and no_room, or nothing with its " +
    "reason. done_today true means today's session is finished and this is the next day's. accepted " +
    "true means the day's suggestion was already added, and these are the stored exercises. " +
    "in_progress true means a workout is open and there is none to give. needs_goal true means the " +
    "user has no goal. With minutes or equipment given it differs from the Today card: limited_to " +
    "says so, and say so too. It writes nothing, and accepting a suggestion is done in the app. The " +
    "citation is printed under your answer. " +
    dataNotice,
  kind: "read",
  input: suggestNextSessionInput,
  // Many nullable fields would not fit the strict budget (D2 of KEY-881).
  strict: false,
  annotations: { readOnlyHint: true },
  async run(ctx, { minutes, equipment }): Promise<ToolRunOutput> {
    const timeZone = zoneOrUtc(await getMyTimeZone(ctx.caller));
    const now = new Date().toISOString();
    const today = localToday(now, timeZone);
    const inputs = await readTrainingInputs(ctx.caller, { today });
    const { goal, activeRoutine } = inputs;
    if (goal === null) {
      return {
        data: {
          needs_goal: true,
          title: SUGGESTION_NO_GOAL.title,
          body: SUGGESTION_NO_GOAL.body,
          where: "The goal is set on the Train tab.",
        },
      };
    }

    // The Today card, read as the Train home reads it, says which day the suggestion is for.
    const weekStart = mondayOf(today);
    const hasNoRoutine = activeRoutine === null;
    const [weekSessions, sessionInProgress, hasLogged] = await Promise.all([
      listWeekSessions(ctx.caller, weekStart),
      getActiveSession(ctx.caller),
      hasNoRoutine ? hasLoggedSession(ctx.caller) : Promise.resolve(false),
    ]);
    const { plan, card } = todayPlanOf({
      routine: planRoutineOf(activeRoutine, timeZone),
      weekSessions,
      sessionInProgress,
      now,
      tz: timeZone,
      weekStart,
      hasEverLoggedSession: hasLogged,
    });
    const read = suggestionTargetOf({
      today,
      card,
      plannedDayId: plan.days.find((day) => day.date === plan.today)?.plannedDay?.id ?? null,
      hasRoutine: activeRoutine !== null,
      hasLoggedSession: hasLogged,
    });
    if (read.status === "in_progress") {
      return { data: { in_progress: true } };
    }
    if (read.status === "none") {
      return { data: { first_visit: true } };
    }
    const target = read.status === "done" ? read.next : read.target;
    const day = target.day === today ? "today" : describeWeekdayName(target.day);
    const citation = describeSuggestionCitation({ localDate: target.day, today });
    const dayFacts = {
      day,
      is_rest_day: target.isRestDay,
      ...(read.status === "done" ? { done_today: true } : {}),
      ...(minutes === null && equipment === null ? {} : { limited_to: { minutes, equipment } }),
    };

    // A day that already holds an accepted suggestion is worded from the stored row, which no later change
    // of the goal, the week or the routine moves.
    const { suggestions: accepted } = await listAcceptedSuggestions(
      ctx.caller,
      mondayOf(target.day),
    );
    const stored = accepted.find(({ local_date }) => local_date === target.day);
    if (stored !== undefined) {
      const words = describeStoredAcceptedSuggestion(
        stored.exercises,
        plan.routineDays.find(({ id }) => id === stored.routine_day_id)?.setCount ?? 0,
        {
          localDate: target.day,
          todayLocalDate: today,
          routineDayName: target.routineDayName,
        },
      );
      return citedResult(
        {
          ...dayFacts,
          accepted: true,
          headline: words.title,
          detail: words.detail,
          exercises: stored.exercises.map(({ target_sets, exercise }) => ({
            name: exercise.name,
            sets: target_sets,
          })),
        },
        citation,
      );
    }

    // The goal's equipment is intersected with the narrowing, as `suggestSession` does, so only the
    // exercises that can be picked are read.
    const equipmentToRead =
      equipment === null
        ? goal.equipment
        : goal.equipment.filter((kind) => equipment.includes(kind));
    const library = await listSuggestionLibrary(ctx.caller, { equipment: equipmentToRead });
    const { suggestion } = nextSessionSuggestion({
      ...inputs,
      now,
      library,
      timeZone,
      day: target.day,
      constraints: {
        ...(minutes === null ? {} : { minutes }),
        ...(equipment === null ? {} : { equipment }),
      },
    });
    if (suggestion === null) {
      // The goal and the library are both there, so a suggestion is always worked out.
      throw new Error("A suggestion was not worked out");
    }

    const context = {
      localDate: target.day,
      todayLocalDate: today,
      routineDayName: target.routineDayName,
      exerciseNames: new Map([
        ...library.map(({ id, name }): [string, string] => [id, name]),
        ...(activeRoutine?.days ?? []).flatMap((routineDay) =>
          routineDay.exercises.map(({ exercise }): [string, string] => [
            exercise.id,
            exercise.name,
          ]),
        ),
      ]),
      goals: {
        goal: goal.goal,
        focus: goal.focus,
        limit_minutes: minutes ?? goal.session_minutes,
      },
    };
    const skipped = suggestion.skipped.map(({ muscle_id }) => MUSCLE_NAMES[muscle_id]);
    const noRoom =
      suggestion.no_room === null
        ? null
        : {
            muscle: MUSCLE_NAMES[suggestion.no_room.muscle_id],
            minutes_if_added: suggestion.no_room.minutes_if_added,
          };

    if (suggestion.kind === "nothing") {
      const { title, body } = describeNothingToSuggest(suggestion, context);
      // Equipment that is none of the goal's leaves the library empty, which the card's words do not say.
      const why =
        equipment !== null && equipmentToRead.length === 0
          ? `${body} Your goal's equipment does not include any of the equipment asked for.`
          : body;
      return citedResult(
        { ...dayFacts, headline: title, nothing: why, skipped, no_room: noRoom },
        citation,
      );
    }

    // A kept exercise's rep range is the routine's, which the active routine read does not hold.
    const detailRoutine =
      suggestion.kind === "plan_adjusted" && activeRoutine !== null
        ? await getRoutine(ctx.caller, activeRoutine.id)
        : null;
    const detail = describeSuggestionDetail(suggestion, {
      ...context,
      plannedRepRanges: new Map(
        (detailRoutine?.days ?? []).flatMap((routineDay) =>
          routineDay.exercises.map(
            ({ id, rep_min, rep_max }): [string, { repMin: number; repMax: number }] => [
              id,
              { repMin: rep_min, repMax: rep_max },
            ],
          ),
        ),
      ),
    });

    return citedResult(
      {
        ...dayFacts,
        headline: detail.headline,
        plan_day: target.routineDayName,
        exercises: suggestion.exercises.map((exercise, index) => {
          const row = detail.rows[index];
          if (row === undefined) {
            // The detail has a row for each exercise of the suggestion, so none is dropped silently.
            throw new Error("A suggested exercise was not worded");
          }
          return {
            exercise_id: exercise.exercise_id,
            name: row.name,
            target: row.target,
            origin: exercise.origin,
            why: row.why,
          };
        }),
        sets: suggestion.sets,
        minutes: suggestion.minutes,
        skipped,
        no_room: noRoom,
      },
      citation,
    );
  },
};
