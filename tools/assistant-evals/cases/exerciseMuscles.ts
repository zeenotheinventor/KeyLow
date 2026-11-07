// The muscles of an exercise (KEY-924): 6 questions about what an exercise works, added to the training advice
// set in a file of their own. The set decides ruling 3 of KEY-881 and has its own threshold, so these cases join
// it and are not must-pass. The spec table of `trainingAdvice.ts` is built on themes and a facts layer for
// numbers, which these cases have none of, and its test pins 26 cases.
//
// A case passes on state and never on wording: the tool drew the right number of figures for the right
// exercises, each figure is the stored map of the exercise the call read (read as the eval user, with the id
// from the call's input and never typed), and the reply and the figure name the same muscles. A failing case
// prints its question and the tools it called, and never the answer.
import { MUSCLE_NAMES } from "@keylow/core";
import { MUSCLE_IDS } from "@keylow/core/training";

import {
  answerOf,
  callsOf,
  critical,
  endedWell,
  fail,
  isRecord,
  noFirstPersonWithContext,
  noWriteRows,
  onlyTrainingReadTools,
  pass,
  soft,
  withContext,
  workoutUntouched,
} from "./trainingAdviceGraders.ts";
import { CUSTOM_EXERCISE } from "../fixtures/training.ts";
import { LIVE_WORKOUT } from "../src/trainingWorld.ts";
import { trainingWorldHolder } from "../src/trainingWorldHolder.ts";

import type { GradeContext } from "./trainingAdviceGraders.ts";
import type { EvalCase, Grader } from "../src/case.ts";
import type { TrainingWorld } from "../src/trainingWorld.ts";
import type { AssistantExerciseMuscles } from "@keylow/core";
import type { MuscleId } from "@keylow/core/training";

const SHOW_EXERCISE_MUSCLES = "show_exercise_muscles";

const figuresOf = (context: GradeContext): readonly AssistantExerciseMuscles[] =>
  context.turns.flatMap((turn) => turn.exerciseMuscles ?? []);

/** A muscle as the figure and the stored map write it, so two maps compare as two sorted lists. */
const muscleKeysOf = (muscles: readonly Readonly<{ muscle_id: unknown; role: unknown }>[]) =>
  muscles.map(({ muscle_id, role }) => `${String(muscle_id)}:${String(role)}`).sort();

// ---------------------------------------------------------------------------------------------------------
// Which figures were drawn
// ---------------------------------------------------------------------------------------------------------

/**
 * Passes when the turn drew exactly one figure for each of these exercises, and no other: each is the name of an
 * exercise as a pattern, so "bench press" takes any bench press of the library. A call of the tool alone is not
 * enough, because the figure is what the person sees.
 */
export function figuresDrawnFor(...exercises: readonly RegExp[]): Grader {
  return (context) => {
    const names = figuresOf(context).map(({ exerciseName }) => exerciseName);
    if (names.length !== exercises.length) {
      return Promise.resolve(
        fail(`the turn drew ${names.length} figures and not the ${exercises.length} asked for`),
      );
    }
    const unmatched = [...names];
    for (const exercise of exercises) {
      const index = unmatched.findIndex((name) => exercise.test(name));
      if (index < 0) {
        return Promise.resolve(fail(`no figure was drawn for an exercise named like ${exercise}`));
      }
      unmatched.splice(index, 1);
    }
    return Promise.resolve(pass("the figures are those of the exercises asked for"));
  };
}

/** Passes when the turn drew no figure. */
export const noFigureDrawn = (): Grader => (context) =>
  Promise.resolve(
    figuresOf(context).length === 0
      ? pass("no figure was drawn")
      : fail(
          `the turn drew ${figuresOf(context).length} figures for an exercise that is not there`,
        ),
  );

/** Passes when the one figure is the person's own exercise, with the muscles the fixture gave it. */
export function figureIsTheCustomExercise(): Grader {
  return (context) => {
    const [figure, ...others] = figuresOf(context);
    if (figure === undefined || others.length > 0) {
      return Promise.resolve(fail("the turn did not draw exactly one figure"));
    }
    const sameName = figure.exerciseName === CUSTOM_EXERCISE.name;
    const sameMuscles =
      JSON.stringify(muscleKeysOf(figure.muscles)) ===
      JSON.stringify(muscleKeysOf(CUSTOM_EXERCISE.muscles));
    return Promise.resolve(
      sameName && sameMuscles
        ? pass("the figure is the custom exercise, rear delts primary and mid traps secondary")
        : fail("the figure is not the custom exercise as the fixture made it"),
    );
  };
}

/**
 * Passes when each figure is the stored map of the exercise a call of the tool read. The call's input names the
 * exercise by id, and the name and the muscles are read as the eval user, so the library and the person's own
 * exercises read alike and nothing is typed. A figure that no call of the tool explains fails.
 */
export function figureIsTheMap(): Grader {
  return async (context) => {
    const unmatched = [...figuresOf(context)];
    for (const call of callsOf(context).filter(({ name }) => name === SHOW_EXERCISE_MUSCLES)) {
      const id = isRecord(call.input) ? call.input["exercise_id"] : undefined;
      if (typeof id !== "string") {
        continue;
      }
      const [exercise] = await context.database.readRows({ table: "exercises", where: { id } });
      const index = unmatched.findIndex(({ exerciseName }) => exerciseName === exercise?.["name"]);
      const figure = unmatched[index];
      if (figure === undefined) {
        continue;
      }
      unmatched.splice(index, 1);
      const stored = await context.database.readRows({
        table: "exercise_muscles",
        where: { exercise_id: id },
      });
      const storedKeys = muscleKeysOf(
        stored.map((row) => ({ muscle_id: row["muscle_id"], role: row["role"] })),
      );
      if (JSON.stringify(storedKeys) !== JSON.stringify(muscleKeysOf(figure.muscles))) {
        return fail("a figure is not the stored map of the exercise its call read");
      }
    }
    return unmatched.length === 0
      ? pass("every figure is the stored map of the exercise its call read")
      : fail(`${unmatched.length} figures are of no exercise a call of the tool read`);
  };
}

// ---------------------------------------------------------------------------------------------------------
// What the reply says
// ---------------------------------------------------------------------------------------------------------

const escapePattern = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
const NOT_INSIDE_A_WORD_BEFORE = "(?<![\\p{L}\\p{N}])";
const NOT_INSIDE_A_WORD_AFTER = "(?![\\p{L}\\p{N}])";

// The longest names first, so "Side glutes" is read whole and "Glutes" is not found inside it.
const NAMES_LONGEST_FIRST: readonly (readonly [MuscleId, string])[] = MUSCLE_IDS.map(
  (muscle): readonly [MuscleId, string] => [muscle, MUSCLE_NAMES[muscle]],
).sort(([, first], [, second]) => second.length - first.length);

/** The muscles whose name the reply holds as whole words, ignoring case. */
export function musclesNamedIn(reply: string): ReadonlySet<MuscleId> {
  const named = new Set<MuscleId>();
  let rest = reply.toLowerCase();
  for (const [muscle, name] of NAMES_LONGEST_FIRST) {
    const source = `${NOT_INSIDE_A_WORD_BEFORE}${escapePattern(name.toLowerCase())}${NOT_INSIDE_A_WORD_AFTER}`;
    if (new RegExp(source, "u").test(rest)) {
      named.add(muscle);
      rest = rest.replace(new RegExp(source, "gu"), " ");
    }
  }
  return named;
}

/** The last word of a muscle's name with its plural optional, so "chest" counts for "Upper chest". */
function lastWordPattern(muscle: MuscleId): RegExp {
  const lastWord = (MUSCLE_NAMES[muscle].toLowerCase().split(" ").at(-1) ?? "").trim();
  const stem = lastWord.endsWith("s") ? lastWord.slice(0, -1) : lastWord;
  return new RegExp(
    `${NOT_INSIDE_A_WORD_BEFORE}${escapePattern(stem)}s?${NOT_INSIDE_A_WORD_AFTER}`,
    "u",
  );
}

/**
 * Passes when the reply and the figure agree. Every muscle the reply names, by a name of the muscle list, is on
 * one of the turn's figures, and the reply of a one-figure turn names every primary muscle of it.
 */
export function replyNamesOnlyTheFigure(): Grader {
  return (context) => {
    const figures = figuresOf(context);
    const reply = answerOf(context);
    const shown = new Set(
      figures.flatMap(({ muscles }) => muscles.map(({ muscle_id }) => muscle_id)),
    );
    for (const muscle of musclesNamedIn(reply)) {
      if (!shown.has(muscle)) {
        return Promise.resolve(fail("the reply names a muscle that no figure shows"));
      }
    }
    const [only, ...others] = figures;
    if (only !== undefined && others.length === 0) {
      const lowered = reply.toLowerCase();
      for (const { muscle_id, role } of only.muscles) {
        if (role === "primary" && !lastWordPattern(muscle_id).test(lowered)) {
          return Promise.resolve(fail("the reply leaves out a primary muscle of the figure"));
        }
      }
    }
    return Promise.resolve(pass("the reply names the muscles of the figure and no others"));
  };
}

const RANKING = /\b(?:more than|works it more|better|best|most)\b/i;

/** Passes when the reply ranks nothing: Ki-Lo holds each muscle's role and no order between exercises. */
export const noRanking = (): Grader => (context) =>
  Promise.resolve(
    RANKING.test(answerOf(context))
      ? fail("the reply ranks the exercises")
      : pass("the reply ranks nothing"),
  );

/** Passes when the reply names no muscle, as for an exercise that is not there. */
export const noMusclesNamed = (): Grader => (context) =>
  Promise.resolve(
    musclesNamedIn(answerOf(context)).size === 0
      ? pass("the reply names no muscle")
      : fail("the reply names a muscle of an exercise that is not there"),
  );

// ---------------------------------------------------------------------------------------------------------
// The cases
// ---------------------------------------------------------------------------------------------------------

type MusclesSpec = Readonly<{
  id: string;
  question: string;
  /** What this case checks besides the checks every case takes. */
  checks: readonly Grader[];
  /** A question to the person is a fair way to answer only where the exercise may be unclear. */
  mayClarify?: true;
  duringWorkout?: true;
}>;

const specs: readonly MusclesSpec[] = [
  {
    id: "muscles-one",
    question: "What muscles does a Romanian deadlift work?",
    checks: [figuresDrawnFor(/romanian deadlift/i), figureIsTheMap(), replyNamesOnlyTheFigure()],
  },
  {
    id: "muscles-words",
    question: "What does a bench press hit?",
    checks: [figuresDrawnFor(/bench press/i), figureIsTheMap(), replyNamesOnlyTheFigure()],
  },
  {
    id: "muscles-compare",
    question: "Which works my hamstrings more, Romanian deadlift or leg curl?",
    checks: [
      figuresDrawnFor(/romanian deadlift/i, /leg curl/i),
      figureIsTheMap(),
      replyNamesOnlyTheFigure(),
      noRanking(),
    ],
  },
  {
    id: "muscles-unknown",
    question: "What muscles does a zorblat press work?",
    // A question about which exercise is meant is a fair way to answer a word nobody knows.
    mayClarify: true,
    checks: [noFigureDrawn(), noMusclesNamed()],
  },
  {
    id: "muscles-during-workout",
    question: "What muscles does the bench press work?",
    duringWorkout: true,
    checks: [
      figuresDrawnFor(/bench press/i),
      figureIsTheMap(),
      replyNamesOnlyTheFigure(),
      workoutUntouched(LIVE_WORKOUT.sets),
    ],
  },
  {
    id: "muscles-custom",
    question: `What muscles does my ${CUSTOM_EXERCISE.name} work?`,
    checks: [figureIsTheCustomExercise(), figureIsTheMap(), replyNamesOnlyTheFigure()],
  },
];

function caseOf(spec: MusclesSpec, world: () => TrainingWorld): EvalCase {
  const graders: Grader[] = [
    ...spec.checks,
    endedWell(spec.mayClarify === true),
    // One write, or one tool that is not a read, fails the set whatever its percentage.
    critical(onlyTrainingReadTools()),
    critical(noWriteRows()),
    // A slip of style: it counts in the percentage and is no missed must-pass.
    soft(noFirstPersonWithContext()),
  ];
  return {
    id: spec.id,
    set: "trainingAdvice",
    prepare: () => world().ensureHistory(),
    ...(spec.duringWorkout === true
      ? {
          setup: async () => {
            await world().startWorkout();
            return null;
          },
          cleanUp: () => world().discardWorkout(),
        }
      : {}),
    messages: [spec.question],
    expect: graders.map((grade) => withContext(grade, spec.question)),
  };
}

/** The cases, with the world they read from. */
export const exerciseMusclesCasesOf = (
  world: () => TrainingWorld = trainingWorldHolder.current,
): readonly EvalCase[] => specs.map((spec) => caseOf(spec, world));

export const exerciseMusclesCases: readonly EvalCase[] = exerciseMusclesCasesOf();
