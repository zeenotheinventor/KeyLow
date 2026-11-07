// The training advice set (KEY-895): 26 questions about the eval user's synthetic training history (KEY-887),
// each answered from the training read tools. It decides ruling 3 of KEY-881: the assistant stays on its model
// unless this set fails at 90 %, or misses one of the must-pass cases, or writes anything.
//
// Every expected number is worked out with the core functions the tools use (`trainingAdviceFacts.ts`), over the
// rows as the tools read them, and none is typed. The questions name their dates relative to the day of the run.
// A case passes on state and numbers and never on wording: the right tool was called with the right arguments,
// the answer holds the numbers to Ki-Lo's rounding, the line under the answer is a tool's, no tool wrote, and the
// answer states no load, set count or rep range that no tool of the case gave. The words of an answer are read in
// four places, each a rule of the tools or the smallest sign that an answer is one: the rolling 7 days are never
// called "this week", a stall the tool could not count to its start is said with "at least", a marker such as
// `needs_goal` is never printed by name, and each state has a word or two it cannot be answered without ("goal"
// for no goal), so an empty apology does not pass.
//
// A failing case prints its question, the tools it called with their arguments and how each ended, and the numbers
// it expected. It never prints an answer, which is the person's training.
import {
  ADVICE_THEMES,
  expectedNumbersOf,
  longDate,
  mergeFacts,
  progressRead,
  resolveFacts,
} from "./trainingAdviceFacts.ts";
import {
  answerHoldsARoute,
  answerNamesMostOf,
  answerSaysOneOfEach,
  callsOf,
  citationIsTheTools,
  critical,
  endedWell,
  endedWithQuestion,
  fail,
  isRecord,
  neverSaysThisWeek,
  noInventedLoad,
  noFirstPersonWithContext,
  noMarkerNames,
  noWriteRows,
  onlyTrainingReadTools,
  pass,
  saysAtLeast,
  soft,
  withContext,
  workoutUntouched,
} from "./trainingAdviceGraders.ts";
import { trainingDateOf, SESSION_SLOTS } from "../fixtures/training.ts";
import { toolCalled } from "../src/case.ts";
import { LIVE_WORKOUT } from "../src/trainingWorld.ts";
import { trainingWorldHolder } from "../src/trainingWorldHolder.ts";

import type {
  AdviceFacts,
  AdviceSpec,
  CallRule,
  Expectation,
  AdviceTheme,
} from "./trainingAdviceFacts.ts";
import type { GradeContext } from "./trainingAdviceGraders.ts";
import type { EvalCase, Grader } from "../src/case.ts";
import type { TrainingWorld } from "../src/trainingWorld.ts";

export { ADVICE_THEMES, resolveFacts };
export type { AdviceFacts, AdviceSpec, AdviceTheme, CallRule, Expectation };
export {
  answerHoldsARoute,
  citationIsTheTools,
  neverSaysThisWeek,
  noInventedLoad,
  noMarkerNames,
  saysAtLeast,
  workoutUntouched,
} from "./trainingAdviceGraders.ts";

// ---------------------------------------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------------------------------------

function callRuleGrader(rule: CallRule, world: () => TrainingWorld, mayClarify: boolean): Grader {
  return async (context) => {
    // A question to the person is a fair way to answer when the exercise asked about is unclear.
    if (mayClarify && endedWithQuestion(context)) {
      return pass("the turn asked the person which exercise");
    }
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
        if ("family" in rule) {
          const read = await progressRead(world(), rule.family, callsOf(context));
          return read.matched
            ? pass("the progress of an exercise of the family was read")
            : fail(`no progress was read of an exercise named ${rule.family.join(" or ")}`);
        }
        const id = (await world().exerciseIds()).get(rule.exercise);
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

// ---------------------------------------------------------------------------------------------------------
// Graders
// ---------------------------------------------------------------------------------------------------------

/** What a case reads of the clock: the moment it started, so a run that crosses midnight UTC is still graded. */
type Clock = { startedAt: string | null };

const gradeNow = (): string => new Date().toISOString();

const dayOf = (moment: string): string => moment.slice(0, 10);

function gradersOf(spec: AdviceSpec, world: () => TrainingWorld, clock: Clock): Grader[] {
  // The facts depend on the calls the model made, so they are worked out once for each set of turns.
  const resolved = new WeakMap<GradeContext["turns"], Promise<AdviceFacts>>();
  const factsOf = (context: GradeContext): Promise<AdviceFacts> => {
    const known = resolved.get(context.turns);
    if (known !== undefined) {
      return known;
    }
    const now = gradeNow();
    const calls = callsOf(context);
    const atGrading = resolveFacts(spec, world(), now, calls);
    const started = clock.startedAt;
    // A case that began on the day before has two days a tool may have answered for.
    const facts =
      started !== null && dayOf(started) !== dayOf(now)
        ? Promise.all([atGrading, resolveFacts(spec, world(), started, calls)]).then(
            ([later, earlier]) => mergeFacts(later, earlier),
          )
        : atGrading;
    resolved.set(context.turns, facts);
    return facts;
  };
  const lazily =
    (grade: (facts: AdviceFacts) => Grader): Grader =>
    async (context) =>
      grade(await factsOf(context))(context);
  // A question to the person in place of an answer holds no figure, so the figures are not looked for in it.
  const unlessAsked =
    (grade: Grader): Grader =>
    (context) =>
      spec.mayClarify && endedWithQuestion(context)
        ? Promise.resolve(pass("the turn asked the person which exercise"))
        : grade(context);

  const graders: Grader[] = [
    ...spec.calls.map((rule) => callRuleGrader(rule, world, spec.mayClarify)),
    unlessAsked(lazily(({ routes }) => answerHoldsARoute(routes))),
    unlessAsked(lazily(({ mentions }) => answerSaysOneOfEach(mentions))),
    unlessAsked(
      lazily(({ mostOf }) =>
        mostOf === null
          ? () => Promise.resolve(pass("no exercises to name"))
          : answerNamesMostOf(mostOf.names, mostOf.atLeast),
      ),
    ),
    unlessAsked(lazily(({ citations }) => citationIsTheTools(citations))),
    unlessAsked(
      lazily(({ allowed, routes, alsoGiven }) =>
        noInventedLoad(allowed, [...expectedNumbersOf(routes), ...alsoGiven]),
      ),
    ),
    unlessAsked(
      lazily(({ stallIsAtLeast }) =>
        stallIsAtLeast
          ? saysAtLeast()
          : () => Promise.resolve(pass("the stall is counted to its start")),
      ),
    ),
    endedWell(spec.mayClarify),
    // One write, or one tool that is not a read, fails the set whatever its percentage.
    critical(onlyTrainingReadTools()),
    critical(noWriteRows()),
    noMarkerNames(),
    // A slip of style: it counts in the percentage and is no missed must-pass.
    soft(noFirstPersonWithContext()),
    // The question's own "this week" may be echoed back.
    ...(spec.rollingWindow && !/this week/i.test(spec.messages.at(-1) ?? "")
      ? [neverSaysThisWeek()]
      : []),
    ...(spec.duringWorkout ? [workoutUntouched(LIVE_WORKOUT.sets)] : []),
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
    flags: Partial<
      Pick<AdviceSpec, "rollingWindow" | "duringWorkout" | "mayClarify" | "mustPass">
    > = {},
  ): AdviceSpec => ({
    id,
    theme,
    messages: [question],
    calls,
    expects,
    rollingWindow: false,
    duringWorkout: false,
    mayClarify: false,
    mustPass: false,
    ...flags,
  });
  const date = (daysBefore: number) => trainingDateOf(anchorDate, daysBefore);
  // The days the history is on, so a question names a day with a workout in it.
  const benchDaysBefore = SESSION_SLOTS[1]?.daysBefore ?? 0;

  // A progress question may be answered by a read of any exercise of the family, or by asking which one.
  const progress = (
    id: string,
    question: string,
    family: readonly [string, ...string[]],
    extra: Partial<Extract<Expectation, { kind: "progress" }>> = {},
    flags: Partial<Pick<AdviceSpec, "mustPass">> = {},
  ) =>
    spec(
      "progress",
      id,
      question,
      [{ tool: "get_exercise_progress", family }],
      { kind: "progress", family, ...extra },
      { mayClarify: true, ...flags },
    );

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
      { mustPass: true },
    ),

    // Progress.
    progress(
      "progress-bench-stalled",
      "Why has my bench stalled?",
      ["bench press"],
      {},
      {
        mustPass: true,
      },
    ),
    // The library's own name, which a search finds, so this one id is the right one.
    spec(
      "progress",
      "progress-squat-rising",
      "Is my Barbell Full Squat still going up?",
      [{ tool: "get_exercise_progress", exercise: "squat" }],
      { kind: "progress", family: ["squat"], exact: "squat" },
    ),
    progress("progress-overhead-press", "How is my overhead press doing?", [
      "overhead press",
      "military press",
      "shoulder press",
    ]),
    progress("progress-leg-press-four-weeks", "How has my leg press gone over the last 4 weeks?", [
      "leg press",
    ]),
    progress("progress-own-exercise", "How is my face pull progressing?", ["face pull"]),
    progress("progress-bench-next-load", "How much should I bench next?", ["bench press"], {
      noNextLoad: true,
    }),
    spec(
      "progress",
      "progress-untrained",
      "How are my pull-ups progressing?",
      [{ anyOf: ["search_exercises", "get_exercise_progress"] }],
      { kind: "untrained" },
      // Several pull-up exercises exist, and asking which one is a fair way to answer.
      { mayClarify: true },
    ),

    // Volume and recovery.
    spec(
      "recovery",
      "recovery-back-volume",
      "Am I doing enough for my back?",
      [{ tool: "get_muscle_state", area: "back" }],
      { kind: "muscles", area: "back", says: "volume" },
      { rollingWindow: true },
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
      { rollingWindow: true },
    ),
    spec(
      "recovery",
      "recovery-legs-volume",
      "How many sets have I done for my legs lately?",
      [{ tool: "get_muscle_state", area: "legs" }],
      { kind: "muscles", area: "legs", says: "volume" },
      { rollingWindow: true },
    ),
    spec(
      "recovery",
      "recovery-shoulders-volume",
      "Are my shoulders getting enough work?",
      [{ tool: "get_muscle_state", area: "shoulders" }],
      { kind: "muscles", area: "shoulders", says: "volume" },
      { rollingWindow: true },
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
      { duringWorkout: true, mustPass: true },
    ),
    spec(
      "workout",
      "workout-so-far",
      "How is this workout going so far?",
      [{ tool: "get_workouts" }],
      { kind: "liveSoFar" },
      { duringWorkout: true, mustPass: true },
    ),
  ];
}

/** The ids of the cases a miss of which fails the set, whatever the percentage. */
export const MUST_PASS_IDS: readonly string[] = adviceSpecs("2026-01-01")
  .filter(({ mustPass }) => mustPass)
  .map(({ id }) => id);

/**
 * The history is written by `prepare`, before the case's ceiling, because it is 190 requests one at a time. The
 * goal-less case closes the goal and the live ones start a workout, and both put things back in `cleanUp`.
 */
function caseOf(spec: AdviceSpec, world: () => TrainingWorld): EvalCase {
  const needsNoGoal = spec.expects.kind === "noGoal";
  const clock: Clock = { startedAt: null };
  return {
    id: spec.id,
    set: "trainingAdvice",
    ...(spec.mustPass ? { mustPass: true as const } : {}),
    prepare: () => world().ensureHistory(),
    setup: async () => {
      clock.startedAt = gradeNow();
      if (needsNoGoal) {
        await world().clearGoal();
      }
      if (spec.duringWorkout) {
        await world().startWorkout();
      }
      return null;
    },
    messages: spec.messages,
    expect: gradersOf(spec, world, clock),
    ...(needsNoGoal || spec.duringWorkout
      ? {
          cleanUp: async () => {
            // Both are put back whatever the other did.
            const failures: unknown[] = [];
            for (const step of [
              ...(needsNoGoal ? [() => world().restoreGoal()] : []),
              ...(spec.duringWorkout ? [() => world().discardWorkout()] : []),
            ]) {
              try {
                await step();
              } catch (error) {
                failures.push(error);
              }
            }
            if (failures[0] !== undefined) {
              throw failures[0] instanceof Error ? failures[0] : new Error("clean up failed");
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
