// What a case of the training advice set expects once the rows, the clock and what the model read are known
// (KEY-895). Every figure is worked out with the core functions the tools use, over the rows as the tools read
// them, and none is typed. The graders that use it are in `trainingAdviceGraders.ts`.
import {
  describeMuscleCitation,
  describeProgressCitation,
  describeRoutineCitation,
  describeSuggestionCitation,
} from "@keylow/core";
import { toLocalDate } from "@keylow/core/dates";
import { EQUIPMENT, MUSCLE_GROUPS, displayLoad, weeksWithoutProgress } from "@keylow/core/training";

import { isRecord } from "./trainingAdviceGraders.ts";
import { ACTIVE_ROUTINE, CUSTOM_EXERCISE, trainingDateOf } from "../fixtures/training.ts";
import {
  LIBRARY_EXERCISE_VALUES,
  expectedSets,
  expectedTrend,
} from "../fixtures/trainingTotals.ts";
import { LIVE_WORKOUT } from "../src/trainingWorld.ts";

import type { AllowedFigures, Evidence, Route } from "./trainingAdviceGraders.ts";
import type { TrainingExercise } from "../fixtures/training.ts";
import type { MuscleFacts, SuggestionAnswer, TrainingWorld } from "../src/trainingWorld.ts";
import type { ToolCall } from "../src/types.ts";
import type { Equipment, MuscleGroup, TrendRange } from "@keylow/core/training";

export const ADVICE_THEMES = ["train", "progress", "recovery", "routines", "workout"] as const;
export type AdviceTheme = (typeof ADVICE_THEMES)[number];

/** A call the case needs. The model may add other arguments and other calls. */
export type CallRule =
  | Readonly<{
      tool: "suggest_next_session";
      /** The session length the question gives, which has to reach the tool. */
      minutes?: number;
      /** The equipment the question limits the session to, which has to reach the tool and nothing more. */
      onlyEquipment?: readonly Equipment[];
    }>
  /** This exercise's own id, for a question that gives the library's exact name. */
  | Readonly<{ tool: "get_exercise_progress"; exercise: TrainingExercise }>
  /** Any exercise whose name holds one of these words, because a search finds more than one. */
  | Readonly<{ tool: "get_exercise_progress"; family: readonly [string, ...string[]] }>
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
  | Readonly<{
      kind: "progress";
      /** The words of an exercise's name that make it the one asked about. */
      family: readonly [string, ...string[]];
      /** True when the question names the library's exact exercise, so no other will do. */
      exact?: TrainingExercise;
      /** True for a question about what to lift next, where no load is a right one. */
      noNextLoad?: true;
    }>
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
  rollingWindow: boolean;
  /** True when a workout is in progress, which no answer may change. */
  duringWorkout: boolean;
  /** True when a question to the person is a fair way to answer, because the exercise asked about is unclear. */
  mayClarify: boolean;
  /** True when a miss of the case fails the set whatever the percentage. */
  mustPass: boolean;
}>;

/** What a case expects once the rows and the clock are known. */
export type AdviceFacts = Readonly<{
  /** Any one route passes, and a route needs all its evidence. */
  routes: readonly Route[];
  /** For each group, the answer says one of its words. */
  mentions: readonly (readonly string[])[];
  /** The lines the tools build for the case. One has to be under the answer. Empty when no line is expected. */
  citations: readonly (string | RegExp)[];
  /**
   * Most of these exercises have to be named by the answer, each by any of its spellings. For a suggestion, whose
   * exercises are the answer.
   */
  mostOf: Readonly<{ names: readonly string[]; atLeast: number }> | null;
  allowed: AllowedFigures;
  /** Numbers the answer may quote though it need not, so a bare one is not taken for a made up load. */
  alsoGiven: readonly number[];
  /** True when the tool could not count a stall to its start, so the answer says "at least". */
  stallIsAtLeast: boolean;
}>;

// ---------------------------------------------------------------------------------------------------------

const LOAD_TOLERANCE = 0.05;
const SET_TOLERANCE = 0.05;
const PERCENT_TOLERANCE = 1;
const LOAD_UNITS = ["kg", "lb"] as const;
const TREND_RANGES_ASKED: readonly TrendRange[] = ["4w", "3m", "1y"];
const SEVEN_DAYS_MILLISECONDS = 7 * 24 * 3_600_000;
// The heat of the hottest muscle, give or take, because two muscles of one lift are nearly as hot.
const NEAR_THE_TOP_HEAT_POINTS = 1;

const figure = (value: number, tolerance: number): Evidence => ({
  numbers: [{ value, tolerance }],
});
// A load in pounds is shown to one decimal and said to the whole pound, so 165.3 is also 165.
const LOAD_TOLERANCE_BY_UNIT = { kg: LOAD_TOLERANCE, lb: 0.5 } as const;
const loadIn = (loadKg: number, unit: (typeof LOAD_UNITS)[number]): Evidence =>
  figure(Number(displayLoad(loadKg, unit)), LOAD_TOLERANCE_BY_UNIT[unit]);

export const exerciseNameOf = (exercise: TrainingExercise): string =>
  exercise === "facePull" ? CUSTOM_EXERCISE.name : LIBRARY_EXERCISE_VALUES[exercise].name;

const noFigures: AllowedFigures = { loads: [], setCounts: [], repRanges: [] };

const merge = (...parts: AllowedFigures[]): AllowedFigures => ({
  loads: parts.flatMap(({ loads }) => loads),
  setCounts: parts.flatMap(({ setCounts }) => setCounts),
  repRanges: parts.flatMap(({ repRanges }) => repRanges),
});

const bothUnits = (loadKg: number): number[] =>
  LOAD_UNITS.map((unit) => Number(displayLoad(loadKg, unit)));

const activeRoutineExercises = ACTIVE_ROUTINE.days.flatMap(({ exercises }) => exercises);
const routineFigures: AllowedFigures = {
  loads: [],
  setCounts: activeRoutineExercises.map(({ sets }) => sets),
  repRanges: activeRoutineExercises.map(({ repMin, repMax }) => [repMin, repMax] as const),
};

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

// The working sets of each exercise on each day, which is what a workout's lines say.
function workingSetCounts(anchorDate: string, isWanted: (localDate: string) => boolean): number[] {
  const counts = new Map<string, number>();
  for (const { local_date, exercise, set_type } of expectedSets(anchorDate)) {
    if (set_type === "working" && isWanted(local_date)) {
      const key = `${local_date}/${exercise}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.values()];
}

const loadsFromSets = (
  anchorDate: string,
  isWanted: (set: ReturnType<typeof expectedSets>[number]) => boolean,
): number[] =>
  expectedSets(anchorDate)
    .filter(isWanted)
    .flatMap(({ load_kg }) => (load_kg === null ? [] : bothUnits(load_kg)));

const longDate = (date: string): string =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
export { longDate };

// The shapes of `describeWorkoutsCitation` for a range with workouts in it and for one with none.
const WORKOUTS_FOUND = /^Based on \d+ workouts?, /;
const WORKOUTS_NONE = /^No workouts, /;

const MENTIONS_OF_PUSH_DAY: readonly (readonly string[])[] = [
  ["bench"],
  ["overhead", "military"],
  ["pushdown"],
];
// Nothing to give, said any of these ways.
const NOTHING_TO_GIVE = ["nothing", "n't", "no session", "not ", "none", "rest"];
const READY_WORDS = ["ready", "recovered", "fresh"];
const SOMETHING_TO_DO = [
  "bench",
  "overhead",
  "military",
  "pushdown",
  "press",
  "set",
  "next",
  "finish",
];

// ---------------------------------------------------------------------------------------------------------
// What the model read
// ---------------------------------------------------------------------------------------------------------

export type ProgressRead = Readonly<{
  /** True when the model read the progress of an exercise of the family asked about. */
  matched: boolean;
  /** The exercise of the history it read, or null when it read one with no history. */
  exercise: TrainingExercise | null;
}>;

/**
 * Which exercise the model read the progress of. A search finds many exercises (by part of the name, in
 * alphabetical order), so the model may read any one of the family, and the answer is graded against the trend of
 * the one it read, the last of them when it read several.
 */
export async function progressRead(
  world: TrainingWorld,
  family: readonly string[],
  calls: readonly ToolCall[],
): Promise<ProgressRead> {
  const ids = await world.exerciseIds();
  for (const { name, input } of [...calls].reverse()) {
    const id =
      name === "get_exercise_progress" && isRecord(input) ? input["exercise_id"] : undefined;
    if (typeof id !== "string") {
      continue;
    }
    const exerciseName = (await world.exerciseName(id))?.toLowerCase() ?? "";
    if (family.some((word) => exerciseName.includes(word.toLowerCase()))) {
      const exercise = [...ids].find(([, candidate]) => candidate === id)?.[0] ?? null;
      return { matched: true, exercise };
    }
  }
  return { matched: false, exercise: null };
}

/** The loads of one exercise's sets, and the weekly bests and the changes between them that the tool gives. */
function exerciseLoadFigures(
  anchorDate: string,
  now: string,
  exercise: TrainingExercise,
  onlyWeeklyBests: boolean,
): AllowedFigures {
  const year = expectedTrend(anchorDate, exercise, { range: "1y", now });
  const trainedLoads = year.weeks.flatMap((week) =>
    week.value === null || week.value.loadKg === null ? [] : [week.value.loadKg],
  );
  // The change beside each week is the difference of the best loads of two trained weeks, as "+2.5 kg".
  const changes = trainedLoads
    .slice(1)
    .map((loadKg, index) => Math.abs(loadKg - (trainedLoads[index] ?? loadKg)));
  const loads = onlyWeeklyBests
    ? trainedLoads.flatMap(bothUnits)
    : loadsFromSets(anchorDate, (set) => set.exercise === exercise);
  return { loads: [...loads, ...changes.flatMap(bothUnits)], setCounts: [], repRanges: [] };
}

function progressFacts(
  anchorDate: string,
  now: string,
  exercise: TrainingExercise,
  noNextLoad: boolean,
): Pick<AdviceFacts, "routes" | "citations" | "stallIsAtLeast" | "allowed"> {
  const trendOf = (range: TrendRange) => expectedTrend(anchorDate, exercise, { range, now });
  // The tool counts the stall over the last year whatever the range asked for.
  const year = trendOf("1y");
  const stall = weeksWithoutProgress(year, "kg");
  const latestLoadKg = year.latest?.value.loadKg ?? null;
  const latestLoads: Route[] =
    latestLoadKg === null ? [] : LOAD_UNITS.map((unit) => [loadIn(latestLoadKg, unit)]);
  return {
    // A stall is given by its weeks. Without one, the answer holds the load of the latest week. The question of
    // what to lift next has no load for an answer, so it takes either: the weeks, or the last best.
    routes: noNextLoad
      ? [[figure(stall.weeks, 0)], ...latestLoads]
      : stall.weeks > 0 || latestLoadKg === null
        ? [[figure(stall.weeks, 0)]]
        : latestLoads,
    citations: TREND_RANGES_ASKED.map((range) =>
      describeProgressCitation(exerciseNameOf(exercise), trendOf(range)),
    ),
    stallIsAtLeast: stall.isAtLeast,
    allowed: exerciseLoadFigures(anchorDate, now, exercise, noNextLoad),
  };
}

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

// ---------------------------------------------------------------------------------------------------------

/**
 * Works out what a case expects at `now`, from the rows the world reads, the clock and the calls the model made.
 * The calls matter for the progress cases only: they say which exercise was read.
 */
async function resolveOwnFacts(
  spec: AdviceSpec,
  world: TrainingWorld,
  now: string,
  calls: readonly ToolCall[] = [],
): Promise<AdviceFacts> {
  const { anchorDate } = world;
  const today = toLocalDate(new Date(now), "UTC");
  const { expects } = spec;
  const none = {
    mentions: [],
    citations: [],
    stallIsAtLeast: false,
    mostOf: null,
    alsoGiven: [],
  } as const;

  switch (expects.kind) {
    case "suggestion": {
      const answer = await world.suggestion(
        { minutes: expects.minutes, equipment: expects.equipment },
        now,
      );
      if (answer.kind === "none") {
        return { ...none, routes: [[]], mentions: [NOTHING_TO_GIVE], allowed: noFigures };
      }
      const citations = [describeSuggestionCitation({ localDate: answer.day, today })];
      if (answer.kind === "nothing") {
        return {
          ...none,
          routes: [[]],
          mentions: [NOTHING_TO_GIVE],
          citations,
          allowed: noFigures,
        };
      }
      return {
        ...none,
        // The Today card picks the day, and the tool answers for it. The headline holds neither the total sets nor
        // the minutes, so the answer is the exercises, most of them, and any figure it quotes is the tool's.
        routes: [[]],
        mostOf: {
          names: answer.exerciseNames,
          atLeast: Math.ceil(answer.exerciseNames.length / 2),
        },
        alsoGiven: [answer.sets, answer.minutes],
        citations,
        allowed: await suggestionFigures(world, answer, now),
      };
    }
    case "noGoal":
      return { ...none, routes: [[]], mentions: [["goal"]], allowed: noFigures };
    case "progress": {
      const read =
        expects.exact === undefined
          ? await progressRead(world, expects.family, calls)
          : { matched: true, exercise: expects.exact };
      if (!read.matched || read.exercise === null) {
        // The exercise has no history, so nothing is a right figure and the tool answers it was never trained.
        return { ...none, routes: [[]], allowed: noFigures };
      }
      return {
        ...none,
        ...progressFacts(anchorDate, now, read.exercise, expects.noNextLoad === true),
      };
    }
    case "untrained":
      // Nothing was logged for it, so no load, set count or rep range is a right one.
      return { ...none, routes: [[]], mentions: [["pull"]], allowed: noFigures };
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
      const topHeat = Math.max(...facts.rows.map(({ heat_percent }) => heat_percent));
      const hottest = facts.rows.filter(
        ({ heat_percent, status }) =>
          heat_percent >= topHeat - NEAR_THE_TOP_HEAT_POINTS || status === "High",
      );
      const routes: readonly Route[] =
        expects.says === "volume" && facts.area !== null
          ? [[figure(facts.area.sets, SET_TOLERANCE), figure(facts.area.target, SET_TOLERANCE)]]
          : expects.says === "hottest"
            ? [[]]
            : // Any muscle's heat as a percent or as its word, or when it is ready, its ready time.
              facts.rows.map(({ heat, heat_percent, ready_at }) => [
                {
                  numbers: [{ value: heat_percent, tolerance: PERCENT_TOLERANCE }],
                  words: [
                    heat,
                    ...(ready_at === "now"
                      ? READY_WORDS
                      : [ready_at, ready_at.split(" ").at(-1) ?? ready_at]),
                  ],
                },
              ]);
      return {
        ...none,
        routes,
        mentions:
          expects.says === "hottest"
            ? [hottest.flatMap(({ muscle }) => [muscle, muscle.split(" ")[0] ?? muscle])]
            : [],
        citations: [citation],
        allowed: muscleFigures(facts),
      };
    }
    case "workouts": {
      const facts = workoutFacts(anchorDate, expects.daysBefore);
      return {
        ...none,
        routes: facts.routes,
        // The tool names the range the model asked for, so the line is known by its shape.
        citations: [facts.hasWorkout ? WORKOUTS_FOUND : WORKOUTS_NONE],
        mentions: facts.hasWorkout
          ? []
          : [["no workout", "nothing", "n't", "no session", "not logged", "none"]],
        // A day with no workout allows nothing: any load, set count or rep range in the answer is invented.
        allowed: facts.hasWorkout
          ? {
              loads: loadsFromSets(anchorDate, ({ local_date }) => local_date === facts.localDate),
              setCounts: workingSetCounts(anchorDate, (day) => day === facts.localDate),
              repRanges: [],
            }
          : noFigures,
      };
    }
    case "routinePushDay": {
      const push = ACTIVE_ROUTINE.days.find(({ name }) => name === "Push");
      return {
        ...none,
        routes:
          (push?.exercises ?? []).length === 0
            ? [[]]
            : [
                (push?.exercises ?? []).flatMap(({ sets, repMin, repMax }) => [
                  figure(sets, 0),
                  figure(repMin, 0),
                  figure(repMax, 0),
                ]),
              ],
        mentions: MENTIONS_OF_PUSH_DAY,
        citations: [describeRoutineCitation(ACTIVE_ROUTINE.name)],
        allowed: routineFigures,
      };
    }
    case "routineActive":
      return {
        ...none,
        routes: [[figure(ACTIVE_ROUTINE.days.length, 0)]],
        mentions: [[ACTIVE_ROUTINE.name, "eval lower"]],
        allowed: routineFigures,
      };
    case "liveNext":
      return {
        ...none,
        routes: [[]],
        mentions: [SOMETHING_TO_DO],
        allowed: merge(
          {
            loads: [...loadsFromSets(anchorDate, () => true), ...bothUnits(LIVE_WORKOUT.loadKg)],
            setCounts: [LIVE_WORKOUT.sets, ...workingSetCounts(anchorDate, () => true)],
            repRanges: [],
          },
          routineFigures,
          muscleFigures(await world.muscleFacts(null, now)),
        ),
      };
    case "liveSoFar":
      return {
        ...none,
        routes: LOAD_UNITS.map((unit) => [
          figure(LIVE_WORKOUT.sets, 0),
          loadIn(LIVE_WORKOUT.loadKg, unit),
        ]),
        allowed: {
          loads: [...loadsFromSets(anchorDate, () => true), ...bothUnits(LIVE_WORKOUT.loadKg)],
          setCounts: [LIVE_WORKOUT.sets, ...workingSetCounts(anchorDate, () => true)],
          repRanges: [],
        },
      };
  }
}

// ---------------------------------------------------------------------------------------------------------

async function suggestionFigures(
  world: TrainingWorld,
  answer: Extract<SuggestionAnswer, { kind: "session" }>,
  now: string,
): Promise<AllowedFigures> {
  // The reasons of a pick quote the sets of the muscles, so those are the tool's too.
  return merge(
    { loads: [], setCounts: [answer.sets, ...answer.exerciseSets], repRanges: answer.repRanges },
    routineFigures,
    muscleFigures(await world.muscleFacts(null, now)),
  );
}

const asMuscleGroup = (value: unknown): MuscleGroup | null =>
  MUSCLE_GROUPS.find((group) => group === value) ?? null;

const asEquipment = (value: unknown): Equipment[] | null =>
  Array.isArray(value) ? EQUIPMENT.filter((kind) => value.includes(kind)) : null;

/**
 * The figures of the tools the model actually called, whichever the case is about. A progress question answered
 * after a read of the workouts may quote a set count of those workouts, and that is the tool's.
 */
async function calledFigures(
  world: TrainingWorld,
  now: string,
  calls: readonly ToolCall[],
): Promise<AllowedFigures> {
  const { anchorDate } = world;
  const ids = await world.exerciseIds();
  const parts = await Promise.all(
    calls.map(async ({ name, input }): Promise<AllowedFigures> => {
      const args = isRecord(input) ? input : {};
      switch (name) {
        case "get_workouts": {
          const { from, to } = args;
          const isRead = (day: string) =>
            typeof from !== "string" || typeof to !== "string" || (from <= day && day <= to);
          return {
            loads: loadsFromSets(anchorDate, ({ local_date }) => isRead(local_date)),
            setCounts: workingSetCounts(anchorDate, isRead),
            repRanges: [],
          };
        }
        case "get_routines":
          return routineFigures;
        case "get_muscle_state":
          return muscleFigures(await world.muscleFacts(asMuscleGroup(args["area"]), now));
        case "suggest_next_session": {
          const minutes = typeof args["minutes"] === "number" ? args["minutes"] : null;
          const answer = await world.suggestion(
            { minutes, equipment: asEquipment(args["equipment"]) },
            now,
          );
          return answer.kind === "session" ? suggestionFigures(world, answer, now) : noFigures;
        }
        case "get_exercise_progress": {
          const read = [...ids].find(([, id]) => id === args["exercise_id"])?.[0];
          return read === undefined ? noFigures : exerciseLoadFigures(anchorDate, now, read, false);
        }
        default:
          return noFigures;
      }
    }),
  );
  return merge(...parts);
}

/**
 * Works out what a case expects at `now`, from the rows the world reads, the clock and the calls the model made.
 * The calls say which exercise a progress question was answered for, and which tools' figures an answer may quote.
 */
export async function resolveFacts(
  spec: AdviceSpec,
  world: TrainingWorld,
  now: string,
  calls: readonly ToolCall[] = [],
): Promise<AdviceFacts> {
  const own = await resolveOwnFacts(spec, world, now, calls);
  return { ...own, allowed: merge(own.allowed, await calledFigures(world, now, calls)) };
}

/** The facts of two moments, for a case that crossed midnight between its start and its grading. */
export const mergeFacts = (first: AdviceFacts, second: AdviceFacts): AdviceFacts => ({
  routes: [...first.routes, ...second.routes],
  mentions: first.mentions,
  mostOf: first.mostOf,
  alsoGiven: [...first.alsoGiven, ...second.alsoGiven],
  citations: [...first.citations, ...second.citations],
  allowed: merge(first.allowed, second.allowed),
  stallIsAtLeast: first.stallIsAtLeast,
});

export const expectedNumbersOf = (routes: readonly Route[]): number[] =>
  routes.flatMap((route) => route.flatMap(({ numbers = [] }) => numbers.map(({ value }) => value)));
