// The training advice set (KEY-895): 25 questions about the eval user's synthetic training history (KEY-887),
// each answered from the training read tools. It decides ruling 3 of KEY-881: the assistant stays on its model
// unless this set fails at 90 %.
//
// Every expected number is worked out with the core functions the tools use (`fixtures/trainingTotals.ts`, the
// suggestion, the muscle rows and the stall count), over the rows the eval user holds, and none is typed. The
// questions name their dates relative to the day of the run. A case passes on state and numbers and never on
// wording: the right tool was called with the right arguments, the answer holds the numbers to Ki-Lo's rounding,
// the line under the answer is a tool's, no tool wrote, and the answer states no load, set count or rep range that
// no tool gave. The words of an answer are never judged, with three exceptions that are rules of the tools
// themselves: the volume of the last 7 days is never called "this week", the answer says "at least" for a stall
// the tool could not count to its start, and a marker such as `needs_goal` is never printed by name.
//
// A failing case prints its question, the tools it called with their arguments and how each ended, and the numbers
// it expected. It never prints an answer, which is the person's training.
import {
  describeMuscleCitation,
  describeProgressCitation,
  describeRoutineCitation,
  describeSuggestionCitation,
} from "@keylow/core";
import { addCalendarDays, toLocalDate } from "@keylow/core/dates";
import { displayLoad, weeksWithoutProgress } from "@keylow/core/training";

import { answerNames, noFirstPerson, READ_TOOLS } from "./ask.ts";
import {
  ACTIVE_ROUTINE,
  ARCHIVED_ROUTINE,
  CUSTOM_EXERCISE,
  SESSION_SLOTS,
  trainingDateOf,
} from "../fixtures/training.ts";
import {
  LIBRARY_EXERCISE_VALUES,
  expectedSets,
  expectedTrend,
} from "../fixtures/trainingTotals.ts";
import { answerContainsNumber, noActionRows, toolCalled } from "../src/case.ts";
import { LIVE_WORKOUT } from "../src/trainingWorld.ts";
import { trainingWorldHolder } from "../src/trainingWorldHolder.ts";

import type { TrainingExercise } from "../fixtures/training.ts";
import type { EvalCase, GradeOutcome, Grader } from "../src/case.ts";
import type { MuscleFacts, TrainingWorld } from "../src/trainingWorld.ts";
import type { ToolCall } from "../src/types.ts";
import type { Equipment, MuscleGroup, TrendRange } from "@keylow/core/training";

const pass = (reason: string): GradeOutcome => ({ passed: true, reason });
const fail = (reason: string): GradeOutcome => ({ passed: false, reason });

export const ADVICE_THEMES = ["train", "progress", "recovery", "routines", "workout"] as const;
export type AdviceTheme = (typeof ADVICE_THEMES)[number];

// ---------------------------------------------------------------------------------------------------------
// What a case expects, in plain data
// ---------------------------------------------------------------------------------------------------------

/** A call the case needs. The model may add other arguments and other calls. */
export type CallRule =
  | Readonly<{
      tool: "suggest_next_session";
      /** The session length the question gives, which has to reach the tool. */
      minutes?: number;
      /** The equipment the question limits the session to, which has to reach the tool and nothing more. */
      onlyEquipment?: readonly Equipment[];
    }>
  | Readonly<{ tool: "get_exercise_progress"; exercise: TrainingExercise }>
  | Readonly<{ tool: "get_muscle_state"; area: MuscleGroup | null }>
  /** A range that holds every one of these days. */
  | Readonly<{ tool: "get_workouts"; covers: readonly string[] }>
  /** Any range or workout. */
  | Readonly<{ tool: "get_workouts"; covers?: undefined }>
  /** `routine` is the read of one routine by its id, `list` the list. */
  | Readonly<{ tool: "get_routines"; reads: "routine" | "list" }>
  | Readonly<{ anyOf: readonly [string, ...string[]] }>;

export type Expectation =
  | Readonly<{ kind: "suggestion"; minutes: number | null; equipment: readonly Equipment[] | null }>
  | Readonly<{ kind: "noGoal" }>
  | Readonly<{ kind: "progress"; exercise: TrainingExercise }>
  | Readonly<{ kind: "untrained" }>
  | Readonly<{ kind: "muscles"; area: MuscleGroup | null; says: "volume" | "recovery" | "hottest" }>
  | Readonly<{ kind: "workouts"; daysBefore: number }>
  | Readonly<{ kind: "routinePushDay" }>
  | Readonly<{ kind: "routineActive" }>
  | Readonly<{ kind: "liveNext" }>
  | Readonly<{ kind: "liveSoFar" }>;

export type AdviceSpec = Readonly<{
  id: string;
  theme: AdviceTheme;
  messages: readonly [string, ...string[]];
  calls: readonly CallRule[];
  expects: Expectation;
  /** True when the question is about the volume of the last 7 days, which is never called "this week". */
  sevenDays: boolean;
  /** True when a workout is in progress, which no answer may change. */
  duringWorkout: boolean;
}>;

type ExpectedNumber = Readonly<{ value: number; tolerance: number }>;
type Route = readonly ExpectedNumber[];

/** The loads, set counts and rep ranges some tool could have given for the case. */
export type AllowedFigures = Readonly<{
  loads: readonly number[];
  setCounts: readonly number[];
  repRanges: readonly (readonly [number, number])[];
}>;

/** What a case expects once the rows and the clock are known. */
export type AdviceFacts = Readonly<{
  /** Any one route passes, and a route needs all its numbers. */
  routes: readonly Route[];
  mentions: readonly (readonly [string, ...string[]])[];
  /** The lines the tools build for the case. One has to be under the answer. Empty when no line is expected. */
  citations: readonly (string | RegExp)[];
  allowed: AllowedFigures;
  /** True when the tool could not count a stall to its start, so the answer says "at least". */
  stallIsAtLeast: boolean;
}>;

// ---------------------------------------------------------------------------------------------------------
// Working the expected figures out
// ---------------------------------------------------------------------------------------------------------

const LOAD_TOLERANCE = 0.05;
const SET_TOLERANCE = 0.05;
const PERCENT_TOLERANCE = 1;
const LOAD_UNITS = ["kg", "lb"] as const;
const FIRST_DAY_AHEAD = 0;
const LAST_DAY_AHEAD = 6;
const TREND_RANGES_ASKED: readonly TrendRange[] = ["4w", "3m", "1y"];
const SEVEN_DAYS_MILLISECONDS = 7 * 24 * 3_600_000;

const exact = (value: number): ExpectedNumber => ({ value, tolerance: 0 });
const loadIn = (loadKg: number, unit: (typeof LOAD_UNITS)[number]): ExpectedNumber => ({
  value: Number(displayLoad(loadKg, unit)),
  tolerance: LOAD_TOLERANCE,
});

const exerciseName = (exercise: TrainingExercise): string =>
  exercise === "facePull" ? CUSTOM_EXERCISE.name : LIBRARY_EXERCISE_VALUES[exercise].name;

const planned = (...routines: (typeof ACTIVE_ROUTINE)[]) =>
  routines.flatMap(({ days }) => days.flatMap(({ exercises }) => exercises));

function historyFigures(anchorDate: string): AllowedFigures {
  const sets = expectedSets(anchorDate);
  const sessions = new Map<string, number>();
  const exercises = new Map<string, number>();
  for (const set of sets) {
    sessions.set(set.local_date, (sessions.get(set.local_date) ?? 0) + 1);
    const key = `${set.local_date}/${set.exercise}`;
    exercises.set(key, (exercises.get(key) ?? 0) + 1);
  }
  return {
    loads: [],
    setCounts: [...sessions.values(), ...exercises.values()],
    repRanges: planned(ACTIVE_ROUTINE, ARCHIVED_ROUTINE).map(
      ({ repMin, repMax }) => [repMin, repMax] as const,
    ),
  };
}

/** The loads of the sets that `isWanted` takes, in both units, because the profile may show either. */
function loadsOf(
  anchorDate: string,
  isWanted: (set: ReturnType<typeof expectedSets>[number]) => boolean,
): AllowedFigures {
  return {
    loads: expectedSets(anchorDate)
      .filter(isWanted)
      .flatMap(({ load_kg }) =>
        load_kg === null ? [] : LOAD_UNITS.map((unit) => Number(displayLoad(load_kg, unit))),
      ),
    setCounts: [],
    repRanges: [],
  };
}

const merge = (...parts: AllowedFigures[]): AllowedFigures => ({
  loads: parts.flatMap(({ loads }) => loads),
  setCounts: parts.flatMap(({ setCounts }) => setCounts),
  repRanges: parts.flatMap(({ repRanges }) => repRanges),
});

// The workout the "during a workout" cases start: two sets of one load.
const LIVE_FIGURES: AllowedFigures = {
  loads: [LIVE_WORKOUT.loadKg],
  setCounts: [LIVE_WORKOUT.sets],
  repRanges: [],
};

const noFigures: AllowedFigures = { loads: [], setCounts: [], repRanges: [] };

function muscleFigures({ rows, area }: MuscleFacts): AllowedFigures {
  return {
    loads: [],
    setCounts: [
      ...rows.flatMap(({ sets, target }) => [sets, target]),
      ...(area === null ? [] : [area.sets, area.target]),
    ],
    repRanges: [],
  };
}

function routineFigures(): AllowedFigures {
  return {
    loads: [],
    setCounts: planned(ACTIVE_ROUTINE, ARCHIVED_ROUTINE).map(({ sets }) => sets),
    repRanges: [],
  };
}

const dayAhead = (today: string, daysAhead: number): string => addCalendarDays(today, daysAhead);

async function suggestionFacts(
  world: TrainingWorld,
  expects: Extract<Expectation, { kind: "suggestion" }>,
  now: string,
  today: string,
): Promise<Pick<AdviceFacts, "routes" | "citations" | "allowed">> {
  const days = Array.from({ length: LAST_DAY_AHEAD - FIRST_DAY_AHEAD + 1 }, (_, offset) =>
    dayAhead(today, FIRST_DAY_AHEAD + offset),
  );
  const facts = await Promise.all(
    days.map(async (day) => ({
      day,
      facts: await world.suggestionFacts(
        { day, minutes: expects.minutes, equipment: expects.equipment },
        now,
      ),
    })),
  );
  // The Today card picks which of these days the tool answers for, so any day's session is a right one, and the
  // sets and the minutes have to be those of the same day.
  const sessions = facts.flatMap(({ facts: session }) => (session === null ? [] : [session]));
  return {
    routes:
      sessions.length === 0
        ? [[]]
        : sessions.map(({ sets, minutes }) => [exact(sets), exact(minutes)]),
    citations: days.map((day) => describeSuggestionCitation({ localDate: day, today })),
    allowed: {
      loads: [],
      setCounts: sessions.map(({ sets }) => sets),
      repRanges: sessions.flatMap(({ repRanges }) => repRanges),
    },
  };
}

function progressFacts(
  anchorDate: string,
  now: string,
  exercise: TrainingExercise,
): Pick<AdviceFacts, "routes" | "citations" | "stallIsAtLeast"> {
  const trendOf = (range: TrendRange) => expectedTrend(anchorDate, exercise, { range, now });
  // The tool counts the stall over the last year whatever the range asked for.
  const stall = weeksWithoutProgress(trendOf("1y"), "kg");
  const latest = trendOf("1y").latest;
  const latestLoadKg = latest?.value.loadKg ?? null;
  return {
    // A stall is given by its weeks. Without one, the answer holds the load of the latest week.
    routes:
      stall.weeks > 0 || latestLoadKg === null
        ? [[exact(stall.weeks)]]
        : LOAD_UNITS.map((unit) => [loadIn(latestLoadKg, unit)]),
    citations: TREND_RANGES_ASKED.map((range) =>
      describeProgressCitation(exerciseName(exercise), trendOf(range)),
    ),
    stallIsAtLeast: stall.isAtLeast,
  };
}

const longDate = (date: string): string =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

function workoutFacts(anchorDate: string, daysBefore: number) {
  const localDate = trainingDateOf(anchorDate, daysBefore);
  const sets = expectedSets(anchorDate).filter((set) => set.local_date === localDate);
  const heaviest = new Map<string, number>();
  for (const { exercise, set_type, load_kg } of sets) {
    if (set_type === "working") {
      heaviest.set(exercise, Math.max(heaviest.get(exercise) ?? 0, load_kg ?? 0));
    }
  }
  const topLoads = [...heaviest.values()];
  return {
    localDate,
    routes:
      topLoads.length === 0
        ? [[]]
        : LOAD_UNITS.map((unit) => topLoads.map((loadKg) => loadIn(loadKg, unit))),
    hasWorkout: sets.length > 0,
  };
}

// The shapes of `describeWorkoutsCitation` for a range with workouts in it and for one with none.
const WORKOUTS_FOUND = /^Based on \d+ workouts?, /;
const WORKOUTS_NONE = /^No workouts, /;

const MENTIONS_OF_PUSH_DAY: readonly (readonly [string, ...string[]])[] = [
  ["bench"],
  ["overhead", "military"],
  ["pushdown"],
];

/** Works out what a case expects at `now`, from the rows the world reads and the clock. Nothing is typed. */
export async function resolveFacts(
  spec: AdviceSpec,
  world: TrainingWorld,
  now: string,
): Promise<AdviceFacts> {
  const { anchorDate } = world;
  const today = toLocalDate(new Date(now), "UTC");
  const history = historyFigures(anchorDate);
  const base = merge(history, routineFigures(), muscleFigures(await world.muscleFacts(null, now)));
  const withBase = (...allowed: AllowedFigures[]) => merge(base, ...allowed);
  const { expects } = spec;
  const none = { mentions: [], citations: [], stallIsAtLeast: false } as const;

  switch (expects.kind) {
    case "suggestion": {
      const facts = await suggestionFacts(world, expects, now, today);
      return { ...none, ...facts, allowed: withBase(facts.allowed) };
    }
    case "noGoal":
      return { ...none, routes: [[]], allowed: noFigures };
    case "progress":
      return {
        ...none,
        ...progressFacts(anchorDate, now, expects.exercise),
        mentions: [],
        // Only the loads of the exercise asked about are ones a tool gave.
        allowed: withBase(loadsOf(anchorDate, ({ exercise }) => exercise === expects.exercise)),
      };
    case "untrained":
      // Nothing was logged for it, so no load, set count or rep range is a right one.
      return { ...none, routes: [[]], allowed: noFigures };
    case "muscles": {
      const facts = await world.muscleFacts(expects.area, now);
      const from = toLocalDate(new Date(Date.parse(now) - SEVEN_DAYS_MILLISECONDS), "UTC");
      const totalSets = facts.rows.reduce((sum, { sets }) => sum + sets, 0);
      const citation = describeMuscleCitation({
        area: expects.area,
        sets: facts.area?.sets ?? totalSets,
        from,
        to: today,
      });
      const hottest = [...facts.rows].sort(
        (first, second) => second.heat_percent - first.heat_percent,
      )[0];
      const routes: readonly Route[] =
        expects.says === "volume" && facts.area !== null
          ? [
              [
                { value: facts.area.sets, tolerance: SET_TOLERANCE },
                { value: facts.area.target, tolerance: SET_TOLERANCE },
              ],
            ]
          : expects.says === "hottest"
            ? [[]]
            : [
                ...facts.rows.map(({ heat_percent }) => [
                  { value: heat_percent, tolerance: PERCENT_TOLERANCE },
                ]),
                // Nothing to read out of a muscle that is ready: the tool gives "now" and no figure to quote.
                ...(facts.rows.every(({ ready_at }) => ready_at === "now") ? [[]] : []),
              ];
      return {
        ...none,
        routes,
        mentions: expects.says === "hottest" && hottest !== undefined ? [[hottest.muscle]] : [],
        citations: [citation],
        allowed: withBase(muscleFigures(facts)),
      };
    }
    case "workouts": {
      const facts = workoutFacts(anchorDate, expects.daysBefore);
      return {
        ...none,
        routes: facts.routes,
        // The tool names the range the model asked for, so the line is known by its shape.
        citations: [facts.hasWorkout ? WORKOUTS_FOUND : WORKOUTS_NONE],
        // A day with no workout allows nothing: any load, set count or rep range in the answer is invented.
        allowed: facts.hasWorkout
          ? withBase(loadsOf(anchorDate, ({ local_date }) => local_date === facts.localDate))
          : noFigures,
      };
    }
    case "routinePushDay": {
      const push = ACTIVE_ROUTINE.days.find(({ name }) => name === "Push");
      return {
        ...none,
        routes: [
          (push?.exercises ?? []).flatMap(({ sets, repMin, repMax }) => [
            exact(sets),
            exact(repMin),
            exact(repMax),
          ]),
        ],
        mentions: MENTIONS_OF_PUSH_DAY,
        citations: [describeRoutineCitation(ACTIVE_ROUTINE.name)],
        allowed: base,
      };
    }
    case "routineActive":
      return {
        ...none,
        routes: [[exact(ACTIVE_ROUTINE.days.length)]],
        mentions: [[ACTIVE_ROUTINE.name]],
        allowed: base,
      };
    case "liveNext":
      return {
        ...none,
        routes: [[]],
        allowed: withBase(
          loadsOf(anchorDate, () => true),
          LIVE_FIGURES,
        ),
      };
    case "liveSoFar":
      return {
        ...none,
        routes: LOAD_UNITS.map((unit) => [
          exact(LIVE_WORKOUT.sets),
          loadIn(LIVE_WORKOUT.loadKg, unit),
        ]),
        allowed: withBase(
          loadsOf(anchorDate, () => true),
          LIVE_FIGURES,
        ),
      };
  }
}

// ---------------------------------------------------------------------------------------------------------
// Graders
// ---------------------------------------------------------------------------------------------------------

type GradeContext = Parameters<Grader>[0];

const answerOf = (context: GradeContext): string => context.turns.at(-1)?.answer ?? "";
const callsOf = (context: GradeContext): ToolCall[] =>
  context.turns.flatMap((turn) => turn.toolCalls);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

// The injected sentence of a turn that read twice is joined with " · " (the turn loop's `distinctLine`).
const CITATION_SEPARATOR = " · ";
// Every line the training read tools build starts one of these ways.
const TOOL_CITATION = /^(?:Based on .+|No (?:sets|workouts|weeks of)\b.*)$/;

/**
 * Passes when the line under the answer is made of lines a training read tool builds, and one of them is an
 * expected line. With no expected line the case needs none, but a line under the answer still has to be a tool's.
 */
export function citationIsTheTools(citations: readonly (string | RegExp)[]): Grader {
  return (context) => {
    const line = context.turns.at(-1)?.answerMeta?.citation ?? null;
    const parts = (line ?? "").split(CITATION_SEPARATOR).filter((part) => part !== "");
    if (!parts.every((part) => TOOL_CITATION.test(part))) {
      return Promise.resolve(fail("the citation under the answer is not a tool's"));
    }
    if (
      citations.length === 0 ||
      parts.some((part) =>
        citations.some((wanted) =>
          typeof wanted === "string" ? wanted === part : wanted.test(part),
        ),
      )
    ) {
      return Promise.resolve(pass("the citation is the tool's"));
    }
    return Promise.resolve(
      fail("the citation under the answer is not the tool's for these figures"),
    );
  };
}

/** Passes when every tool called is a read tool. This set builds its allowed tools from `READ_TOOLS`. */
export function onlyTrainingReadTools(): Grader {
  return (context) => {
    const other = callsOf(context).find((call) => !READ_TOOLS.has(call.name));
    return Promise.resolve(
      other === undefined
        ? pass("only read tools were called")
        : fail(`${other.name} is not a read tool`),
    );
  };
}

// The names of the markers and fields the training tools give. A marker is put into words and never named.
const MARKER_NAMES =
  /\b(?:needs_goal|first_visit|in_progress|done_today|stall_may_be_longer|weeks_without_progress|limited_to|is_rest_day|no_room|plan_adjusted|plan_day|ready_at|week_start|exercise_id)\b/i;

/** Passes when the answer prints no marker or field name of a tool. */
export function noMarkerNames(): Grader {
  return (context) =>
    Promise.resolve(
      MARKER_NAMES.test(answerOf(context))
        ? fail("the answer prints the name of a marker")
        : pass("the answer prints no marker name"),
    );
}

/** Passes when the answer says the volume was counted over the last 7 days. */
export function saysLastSevenDays(): Grader {
  return (context) =>
    Promise.resolve(
      /\b(?:7|seven)[- ]days?\b/i.test(answerOf(context))
        ? pass("the answer says the last 7 days")
        : fail('the answer does not say "the last 7 days"'),
    );
}

/** Passes when the answer never calls the 7 days "this week", which a calendar week would be. */
export function neverSaysThisWeek(): Grader {
  return (context) =>
    Promise.resolve(
      /\bthis week\b/i.test(answerOf(context))
        ? fail('the answer calls the last 7 days "this week"')
        : pass('the answer does not say "this week"'),
    );
}

/** Passes when a stall the tool could not count to its start is said with "at least". */
export function saysAtLeast(): Grader {
  return (context) =>
    Promise.resolve(
      /\bat least\b/i.test(answerOf(context))
        ? pass('the answer says "at least"')
        : fail(
            'the stall runs back further than the tool could count and the answer does not say "at least"',
          ),
    );
}

const MONTH =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
// Dates are removed before figures are read, so the day of a date is not taken for a count.
const DATES = new RegExp(
  `\\d{4}-\\d{2}-\\d{2}|\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}\\b|\\b${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`,
  "gi",
);
const LOAD_IN_TEXT = /(\d[\d,]*(?:\.\d+)?)\s*(?:kg|kgs|kilos?|kilograms?|lb|lbs|pounds?)\b/gi;
const SETS_IN_TEXT =
  /(\d+(?:\.\d+)?)\s*(?:working |warm-up |warm up |hard |total |extra )?sets?\b/gi;
const REP_RANGE_IN_TEXT = /(\d+)\s*(?:-|–|to)\s*(\d+)\s*reps?\b|[x×]\s*(\d+)\s*(?:-|–)\s*(\d+)\b/gi;

const near = (values: readonly number[], value: number, tolerance: number): boolean =>
  values.some((candidate) => Math.abs(candidate - value) <= tolerance + 1e-9);

/**
 * Passes when every load, set count and rep range in the answer is one a tool could have given. A load is a
 * number with a unit of weight, a set count a number before "sets" and a rep range two numbers before "reps" or
 * after a multiplication sign. Everything allowed was worked out by core from the rows, so a figure the model made
 * up, worked out itself or remembered from elsewhere fails the case.
 */
export function noInventedLoad(allowed: AllowedFigures): Grader {
  return (context) => {
    const answer = answerOf(context).replace(DATES, " ");
    const invented: string[] = [];
    for (const [, digits] of answer.matchAll(LOAD_IN_TEXT)) {
      const value = Number((digits ?? "").replaceAll(",", ""));
      if (!near(allowed.loads, value, LOAD_TOLERANCE)) {
        invented.push(`a load of ${value}`);
      }
    }
    for (const [, digits] of answer.matchAll(SETS_IN_TEXT)) {
      if (!near(allowed.setCounts, Number(digits), SET_TOLERANCE)) {
        invented.push(`${digits ?? ""} sets`);
      }
    }
    for (const match of answer.matchAll(REP_RANGE_IN_TEXT)) {
      const low = Number(match[1] ?? match[3]);
      const high = Number(match[2] ?? match[4]);
      if (!allowed.repRanges.some(([min, max]) => min === low && max === high)) {
        invented.push(`a rep range of ${low} to ${high}`);
      }
    }
    return Promise.resolve(
      invented.length === 0
        ? pass("the answer states no load, set count or rep range that no tool gave")
        : fail(`the answer states ${[...new Set(invented)].join(", ")}, which no tool gave`),
    );
  };
}

/** Passes when the workout in progress is still open and holds the sets the case logged, so nothing was written. */
export function workoutUntouched(): Grader {
  return async (context) => {
    const open = await context.database.readRows({
      table: "workout_sessions",
      where: { ended_at: null, deleted_at: null },
    });
    const id = open[0]?.["id"];
    if (open.length !== 1 || typeof id !== "string") {
      return fail("the workout in progress is not the one open workout it was");
    }
    const sets = await context.database.countRows({
      table: "workout_sets",
      where: { session_id: id, deleted_at: null },
    });
    return sets === LIVE_WORKOUT.sets
      ? pass("the workout in progress was not changed")
      : fail(`the workout in progress holds ${sets} sets and not the ${LIVE_WORKOUT.sets} logged`);
  };
}

function answerHoldsARoute(routes: readonly Route[]): Grader {
  return async (context) => {
    const outcomes = await Promise.all(
      routes.map((route) =>
        Promise.all(
          route.map(({ value, tolerance }) => answerContainsNumber(value, tolerance)(context)),
        ),
      ),
    );
    if (outcomes.some((route) => route.every(({ passed }) => passed))) {
      return pass("the answer holds the numbers");
    }
    const wanted = routes
      .map((route) => route.map(({ value }) => value).join(" and "))
      .filter((line) => line !== "");
    return fail(`the answer does not hold the numbers (wanted ${wanted.join(" or ")})`);
  };
}

const toolsLine = (calls: readonly ToolCall[]): string =>
  calls.length === 0
    ? "none"
    : calls
        .map(
          ({ name, input, errorCode, outcome }) =>
            `${name}(${JSON.stringify(input).slice(0, 200)})${errorCode === undefined ? "" : ` [${errorCode}]`}${outcome === undefined ? "" : ` [${outcome}]`}`,
        )
        .join(", ");

/**
 * A failing case says what it was asked and which tools it called, with their arguments and how each ended, and
 * never the answer, which is the person's training. The driver keeps no body of a tool result, so how a call
 * ended is the error code or the outcome it stored.
 */
function withContext(grade: Grader, question: string): Grader {
  return async (context) => {
    const outcome = await grade(context);
    return outcome.passed
      ? outcome
      : fail(`${outcome.reason}; question: "${question}"; tools: ${toolsLine(callsOf(context))}`);
  };
}

function callRuleGrader(
  rule: CallRule,
  exerciseIdsOf: () => Promise<ReadonlyMap<TrainingExercise, string>>,
): Grader {
  return async (context) => {
    if ("anyOf" in rule) {
      const called = callsOf(context).some(({ name }) => rule.anyOf.includes(name));
      return called
        ? pass("a fitting tool was called")
        : fail(`none of ${rule.anyOf.join(", ")} was called`);
    }
    switch (rule.tool) {
      case "suggest_next_session":
        return toolCalled("suggest_next_session", (input) => {
          if (!isRecord(input)) {
            return false;
          }
          const { minutes, equipment } = input;
          const onlyEquipment = rule.onlyEquipment;
          return (
            (rule.minutes === undefined || minutes === rule.minutes) &&
            (onlyEquipment === undefined ||
              (Array.isArray(equipment) &&
                equipment.length > 0 &&
                equipment.every((kind) => onlyEquipment.some((wanted) => wanted === kind))))
          );
        })(context);
      case "get_exercise_progress": {
        const id = (await exerciseIdsOf()).get(rule.exercise);
        return toolCalled(
          "get_exercise_progress",
          (input) => isRecord(input) && input["exercise_id"] === id,
        )(context);
      }
      case "get_muscle_state":
        return toolCalled(
          "get_muscle_state",
          (input) => isRecord(input) && (input["area"] ?? null) === rule.area,
        )(context);
      case "get_routines":
        return toolCalled(
          "get_routines",
          (input) =>
            isRecord(input) &&
            ((input["routine_id"] ?? null) !== null) === (rule.reads === "routine"),
        )(context);
      case "get_workouts": {
        const { covers } = rule;
        if (covers === undefined) {
          return toolCalled("get_workouts")(context);
        }
        return toolCalled("get_workouts", (input) => {
          if (!isRecord(input)) {
            return false;
          }
          const { from, to } = input;
          return (
            typeof from === "string" &&
            typeof to === "string" &&
            covers.every((day) => from <= day && day <= to)
          );
        })(context);
      }
    }
  };
}

/** Runs `grade` on the facts of the case, worked out once at the moment of the first grader to ask. */
function lazily(facts: () => Promise<AdviceFacts>, grade: (facts: AdviceFacts) => Grader): Grader {
  return async (context) => grade(await facts())(context);
}

function gradersOf(spec: AdviceSpec, world: () => TrainingWorld): Grader[] {
  let resolved: Promise<AdviceFacts> | null = null;
  const facts = () => {
    resolved ??= resolveFacts(spec, world(), new Date().toISOString());
    return resolved;
  };
  const exerciseIds = () => world().exerciseIds();
  const graders: Grader[] = [
    ...spec.calls.map((rule) => callRuleGrader(rule, exerciseIds)),
    lazily(facts, ({ routes }) => answerHoldsARoute(routes)),
    lazily(facts, ({ mentions }) => async (context) => {
      const outcomes = await Promise.all(
        mentions.map((spellings) => answerNames(...spellings)(context)),
      );
      return outcomes.find(({ passed }) => !passed) ?? pass("the answer names what it should");
    }),
    lazily(facts, ({ citations }) => citationIsTheTools(citations)),
    lazily(facts, ({ allowed }) => noInventedLoad(allowed)),
    lazily(facts, ({ stallIsAtLeast }) =>
      stallIsAtLeast
        ? saysAtLeast()
        : () => Promise.resolve(pass("the stall is counted to its start")),
    ),
    onlyTrainingReadTools(),
    noActionRows(),
    noMarkerNames(),
    noFirstPerson(),
    ...(spec.sevenDays ? [saysLastSevenDays(), neverSaysThisWeek()] : []),
    ...(spec.duringWorkout ? [workoutUntouched()] : []),
  ];
  return graders.map((grade) => withContext(grade, spec.messages.at(-1) ?? ""));
}

// ---------------------------------------------------------------------------------------------------------
// The cases
// ---------------------------------------------------------------------------------------------------------

/** Every case of the set, as plain data. `anchorDate` is today in a run, and the history is dated back from it. */
export function adviceSpecs(anchorDate: string): readonly AdviceSpec[] {
  const spec = (
    theme: AdviceTheme,
    id: string,
    question: string,
    calls: readonly CallRule[],
    expects: Expectation,
    flags: Partial<Pick<AdviceSpec, "sevenDays" | "duringWorkout">> = {},
  ): AdviceSpec => ({
    id,
    theme,
    messages: [question],
    calls,
    expects,
    sevenDays: false,
    duringWorkout: false,
    ...flags,
  });
  const date = (daysBefore: number) => trainingDateOf(anchorDate, daysBefore);
  // The days the history is on, so a question names a day with a workout in it.
  const [, benchSlot] = SESSION_SLOTS;
  const benchDaysBefore = benchSlot?.daysBefore ?? 0;

  return [
    // What to train.
    spec("train", "train-today", "What should I train today?", [{ tool: "suggest_next_session" }], {
      kind: "suggestion",
      minutes: null,
      equipment: null,
    }),
    spec(
      "train",
      "train-thirty-minutes",
      "I only have 30 minutes, what should I train?",
      [{ tool: "suggest_next_session", minutes: 30 }],
      { kind: "suggestion", minutes: 30, equipment: null },
    ),
    spec(
      "train",
      "train-fifteen-minutes",
      "I can squeeze in 15 minutes today. What is worth doing?",
      [{ tool: "suggest_next_session", minutes: 15 }],
      { kind: "suggestion", minutes: 15, equipment: null },
    ),
    spec(
      "train",
      "train-dumbbells-only",
      "I'm at home with dumbbells only. What should I train?",
      [{ tool: "suggest_next_session", onlyEquipment: ["dumbbell"] }],
      { kind: "suggestion", minutes: null, equipment: ["dumbbell"] },
    ),
    spec(
      "train",
      "train-kettlebell-only",
      "All I have is a kettlebell. What session do you suggest?",
      [{ tool: "suggest_next_session", onlyEquipment: ["kettlebell"] }],
      { kind: "suggestion", minutes: null, equipment: ["kettlebell"] },
    ),
    spec(
      "train",
      "train-no-goal",
      "What should I train next?",
      [{ tool: "suggest_next_session" }],
      { kind: "noGoal" },
    ),

    // Progress.
    spec(
      "progress",
      "progress-bench-stalled",
      "Why has my bench stalled?",
      [{ tool: "get_exercise_progress", exercise: "benchPress" }],
      { kind: "progress", exercise: "benchPress" },
    ),
    spec(
      "progress",
      "progress-squat-rising",
      "Is my squat still going up?",
      [{ tool: "get_exercise_progress", exercise: "squat" }],
      { kind: "progress", exercise: "squat" },
    ),
    spec(
      "progress",
      "progress-overhead-press",
      "How is my overhead press doing?",
      [{ tool: "get_exercise_progress", exercise: "overheadPress" }],
      { kind: "progress", exercise: "overheadPress" },
    ),
    spec(
      "progress",
      "progress-leg-press-four-weeks",
      "How has my leg press gone over the last 4 weeks?",
      [{ tool: "get_exercise_progress", exercise: "legPress" }],
      { kind: "progress", exercise: "legPress" },
    ),
    spec(
      "progress",
      "progress-own-exercise",
      "How is my face pull progressing?",
      [{ tool: "get_exercise_progress", exercise: "facePull" }],
      { kind: "progress", exercise: "facePull" },
    ),
    spec(
      "progress",
      "progress-untrained",
      "How are my pull-ups progressing?",
      [{ anyOf: ["search_exercises", "get_exercise_progress"] }],
      { kind: "untrained" },
    ),

    // Volume and recovery.
    spec(
      "recovery",
      "recovery-back-volume",
      "Am I doing enough for my back?",
      [{ tool: "get_muscle_state", area: "back" }],
      { kind: "muscles", area: "back", says: "volume" },
      { sevenDays: true },
    ),
    spec(
      "recovery",
      "recovery-chest-recovered",
      "Is my chest recovered?",
      [{ tool: "get_muscle_state", area: "chest" }],
      { kind: "muscles", area: "chest", says: "recovery" },
    ),
    spec(
      "recovery",
      "recovery-overworked",
      "What's overworked this week?",
      [{ tool: "get_muscle_state", area: null }],
      { kind: "muscles", area: null, says: "hottest" },
      { sevenDays: true },
    ),
    spec(
      "recovery",
      "recovery-legs-volume",
      "How many sets have I done for my legs lately?",
      [{ tool: "get_muscle_state", area: "legs" }],
      { kind: "muscles", area: "legs", says: "volume" },
      { sevenDays: true },
    ),
    spec(
      "recovery",
      "recovery-shoulders-volume",
      "Are my shoulders getting enough work?",
      [{ tool: "get_muscle_state", area: "shoulders" }],
      { kind: "muscles", area: "shoulders", says: "volume" },
      { sevenDays: true },
    ),
    spec(
      "recovery",
      "recovery-arms-recovered",
      "Can I hit arms again or are they still tired?",
      [{ tool: "get_muscle_state", area: "arms" }],
      { kind: "muscles", area: "arms", says: "recovery" },
    ),

    // Workouts and routines.
    spec(
      "routines",
      "workouts-yesterday",
      "What did I do yesterday?",
      [{ tool: "get_workouts", covers: [date(1)] }],
      { kind: "workouts", daysBefore: 1 },
    ),
    spec(
      "routines",
      "workouts-on-a-date",
      `What did I do on ${longDate(date(benchDaysBefore))}?`,
      [{ tool: "get_workouts", covers: [date(benchDaysBefore)] }],
      { kind: "workouts", daysBefore: benchDaysBefore },
    ),
    spec(
      "routines",
      "routine-push-day",
      "What's in my push day?",
      [{ tool: "get_routines", reads: "routine" }],
      { kind: "routinePushDay" },
    ),
    spec(
      "routines",
      "routine-active",
      "Which routine am I on, and how many days does it have?",
      [{ tool: "get_routines", reads: "list" }],
      { kind: "routineActive" },
    ),
    spec(
      "routines",
      "workouts-before-the-first",
      `What did I do on ${longDate(date(60))}?`,
      [{ tool: "get_workouts", covers: [date(60)] }],
      { kind: "workouts", daysBefore: 60 },
    ),

    // During a workout: the case starts one, and the answer comes from the tools with nothing written.
    spec(
      "workout",
      "workout-what-next",
      "What should I do next?",
      [{ anyOf: ["suggest_next_session", "get_routines", "get_workouts"] }],
      { kind: "liveNext" },
      { duringWorkout: true },
    ),
    spec(
      "workout",
      "workout-so-far",
      "How is this workout going so far?",
      [{ tool: "get_workouts" }],
      { kind: "liveSoFar" },
      { duringWorkout: true },
    ),
  ];
}

/** Every theme's cases need the history. The goal-less case closes the goal, and the live ones start a workout. */
function caseOf(spec: AdviceSpec, world: () => TrainingWorld): EvalCase {
  const needsNoGoal = spec.expects.kind === "noGoal";
  return {
    id: spec.id,
    set: "trainingAdvice",
    setup: async () => {
      await world().ensureHistory();
      if (needsNoGoal) {
        await world().clearGoal();
      }
      if (spec.duringWorkout) {
        await world().startWorkout();
      }
      return null;
    },
    messages: spec.messages,
    expect: gradersOf(spec, world),
    ...(needsNoGoal || spec.duringWorkout
      ? {
          cleanUp: async () => {
            if (needsNoGoal) {
              await world().restoreGoal();
            }
            if (spec.duringWorkout) {
              await world().discardWorkout();
            }
          },
        }
      : {}),
  };
}

/** The cases of the set for a history dated from `anchorDate`, with the world they read from. */
export const adviceCasesOf = (
  anchorDate: string,
  world: () => TrainingWorld = trainingWorldHolder.current,
): readonly EvalCase[] => adviceSpecs(anchorDate).map((spec) => caseOf(spec, world));

/** The set for a run now: the eval user's history is dated from today (UTC), as `createFixtureUser` does. */
export const trainingAdviceCases: readonly EvalCase[] = adviceCasesOf(
  new Date().toISOString().slice(0, 10),
);
