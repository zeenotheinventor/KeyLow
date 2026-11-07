// The user's logged workouts, for "what did I do last week?" and "what did I squat last time?". A range
// gives one summary per workout and a session id gives its sets. The minutes, the working sets and the
// best set are core's, as the History screen works them out, and the loads are written in the unit the
// profile shows. Row level security shows a user their own sessions only, so another user's id reads the
// same as one that does not exist. A set's snapshot never leaves the tool, only the exercise's name.
import { z } from "zod";

import {
  bestSetPerWeek,
  describeHistorySessionName,
  describeHistorySet,
  describeSets,
  describeWorkoutsCitation,
  displayLoad,
  summariseSession,
} from "../../core.ts";
import { getMyWeightUnit, getSession, listSessionsInWeek } from "../../repos.ts";
import { citedResult } from "./diaryView.ts";
import { dataNotice, isRangeOfAtMost, localDateSchema, weekStartsOf } from "./shared.ts";

import type { HistorySessionRow, SessionWithSets } from "../../repos.ts";
import type { ReadToolDefinition, ToolContext, ToolRunOutput } from "../tool.ts";

const maxRangeDays = 42;
const maxListedWorkouts = 20;
const maxListedSets = 60;

// A date that failed its own check would make the range check throw, so the range is only checked once the fields passed.
const hasNoFieldProblem = ({ issues }: { issues: readonly unknown[] }) => issues.length === 0;

const getWorkoutsInput = z
  .strictObject({
    from: localDateSchema
      .nullable()
      .default(null)
      .describe("The first day of the range, YYYY-MM-DD, or null when reading one workout."),
    to: localDateSchema
      .nullable()
      .default(null)
      .describe(
        `The last day of the range, YYYY-MM-DD, at most ${maxRangeDays} days from the first, or null when reading one workout.`,
      ),
    session_id: z
      .guid()
      .nullable()
      .default(null)
      .describe("The id of a workout from this tool's list, or null to list a range."),
  })
  .refine(({ session_id, from, to }) => session_id !== null || (from !== null && to !== null), {
    path: ["from"],
    when: hasNoFieldProblem,
  })
  .refine(
    ({ session_id, from, to }) =>
      session_id !== null ||
      from === null ||
      to === null ||
      isRangeOfAtMost(maxRangeDays)({ from, to }),
    { path: ["to"], when: hasNoFieldProblem },
  );

type LoadUnit = Awaited<ReturnType<typeof getMyWeightUnit>>;

const loadInWords = (loadKg: number | null, unit: LoadUnit): string | null =>
  loadKg === null ? null : `${displayLoad(loadKg, unit)} ${unit}`;

// One line per exercise, in the order the session lists them: its name, its working sets and its best set.
function exerciseLines(session: SessionWithSets, unit: LoadUnit): string[] {
  const best = new Map(
    bestSetPerWeek(session.sets.map((set) => ({ ...set, local_date: session.local_date }))).map(
      (set) => [set.exercise_id, set],
    ),
  );
  const exercises = new Map<string, { name: string; sets: SessionWithSets["sets"] }>();
  for (const set of session.sets) {
    const exercise = exercises.get(set.exercise_id) ?? { name: set.snapshot.name, sets: [] };
    exercise.sets.push(set);
    exercises.set(set.exercise_id, exercise);
  }
  return [...exercises].map(([exerciseId, { name, sets }]) => {
    const top = best.get(exerciseId);
    const workingSets = describeSets(summariseSession(session, sets).workingSets);
    if (top === undefined) {
      return `${name}: ${workingSets}`;
    }
    // Only the numbers of the set are used, so its number among the working sets does not matter.
    const { what } = describeHistorySet({
      setType: top.set_type,
      setNumber: 1,
      loadKg: top.load_kg,
      reps: top.reps,
      rir: null,
      unit,
    });
    return `${name}: ${workingSets}, best ${what}`;
  });
}

// The History's row for the session, with the minutes core works out and null while it is open.
function sessionView(session: HistorySessionRow | SessionWithSets) {
  const { durationMinutes } = summariseSession(session, session.sets);
  return {
    id: session.id,
    local_date: session.local_date,
    name: describeHistorySessionName(session.routine_day_name),
    minutes: durationMinutes,
    in_progress: durationMinutes === null,
  };
}

async function readRange(
  caller: ToolContext["caller"],
  from: string,
  to: string,
): Promise<ToolRunOutput> {
  const [weeks, unit] = await Promise.all([
    Promise.all(weekStartsOf(from, to).map((weekStart) => listSessionsInWeek(caller, weekStart))),
    getMyWeightUnit(caller),
  ]);
  // The repo answers each week newest first, so the newest week first makes the whole list newest first.
  const inRange: HistorySessionRow[] = [...weeks]
    .reverse()
    .flat()
    .filter(({ local_date }) => local_date >= from && local_date <= to);
  const listed = inRange.slice(0, maxListedWorkouts);
  const workouts = await Promise.all(
    listed.map(async (summary) => {
      // The list holds no reps or loads, so each workout is read whole for its exercise lines.
      const detail = await getSession(caller, summary.id);
      return {
        ...sessionView(summary),
        exercises: detail === null ? [] : exerciseLines(detail, unit),
      };
    }),
  );
  return citedResult(
    { workouts, truncated: inRange.length > maxListedWorkouts },
    describeWorkoutsCitation({ from, to, workoutCount: workouts.length }),
  );
}

async function readWorkout(
  caller: ToolContext["caller"],
  sessionId: string,
): Promise<ToolRunOutput> {
  const [session, unit] = await Promise.all([
    getSession(caller, sessionId),
    getMyWeightUnit(caller),
  ]);
  if (session === null) {
    return { data: { error: "not_found" } };
  }
  return citedResult(
    {
      ...sessionView(session),
      note: session.note,
      sets: session.sets.slice(0, maxListedSets).map((set) => ({
        id: set.id,
        exercise: set.snapshot.name,
        set_type: set.set_type,
        reps: set.reps,
        load: loadInWords(set.load_kg, unit),
        rir: set.rir,
        rpe: set.rpe,
      })),
      truncated: session.sets.length > maxListedSets,
    },
    describeWorkoutsCitation({ from: session.local_date, to: session.local_date, workoutCount: 1 }),
  );
}

export const getWorkoutsTool: ReadToolDefinition<z.infer<typeof getWorkoutsInput>> = {
  name: "get_workouts",
  description:
    `Reads the user's logged workouts. With session_id null, from and to are needed, at most ${maxRangeDays} ` +
    `days apart, and it lists the workouts in them, newest first, at most ${maxListedWorkouts}: id, ` +
    "local_date, name (the routine day), minutes (null while in_progress) and one line per exercise " +
    "with its working sets and best set. With a session_id it reads that workout: its note and its " +
    `sets in order, at most ${maxListedSets}, each with id, exercise, set_type (warmup, working, drop ` +
    "or failure), reps, load in the user's unit (null none), rir and rpe (null none). truncated is true " +
    "when more exist, so ask for a shorter range. The citation is printed under your answer. Ids come " +
    "from here, never invent one. " +
    dataNotice,
  kind: "read",
  input: getWorkoutsInput,
  // Many nullable fields would not fit the strict budget (D2 of KEY-881).
  strict: false,
  annotations: { readOnlyHint: true },
  run(ctx, { from, to, session_id }) {
    if (session_id !== null) {
      return readWorkout(ctx.caller, session_id);
    }
    // The input check refuses a call with neither, so this only narrows the types.
    if (from === null || to === null) {
      return Promise.resolve({ data: { error: "not_found" } });
    }
    return readRange(ctx.caller, from, to);
  },
};
