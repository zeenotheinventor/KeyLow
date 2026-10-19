import { MUSCLE_IDS } from "../muscles";
import { muscleParams } from "../muscleState";

import type { ExerciseMuscleEntry } from "../../schemas/training";
import type { Equipment } from "../enums";
import type { MuscleId } from "../muscles";
import type { ExerciseTieBreak, SuggestParams } from "./suggestParams";
import type { SuggestExercise, SuggestGoals, SuggestionReason, SuggestState } from "./suggestTypes";

/*
 * What a suggestion reads and keeps while it runs, shared by the fresh session and the planned day: the
 * score of a muscle, the sets credited so far, and the order exercises are chosen in (ADR 0005, "Goals and
 * suggestions", and the numbers Zee agreed on KEY-396, Part 3).
 */

// Scores compare after rounding to 6 decimals, so a tie is a tie. Sets round as `muscleState` rounds them.
const SCORE_SCALE = 1e6;
const SETS_SCALE = 1e9;

export const roundedTo = (value: number, scale: number): number =>
  Math.round(value * scale) / scale;

/** Code unit order, so the answer never depends on the language of the device. */
const compareText = (first: string, second: string): number =>
  first < second ? -1 : first > second ? 1 : 0;

/** The primary muscles of a muscle map, in the order of the muscle list. */
export const primaryMusclesOf = (muscles: readonly ExerciseMuscleEntry[]): MuscleId[] =>
  MUSCLE_IDS.filter((muscle) =>
    muscles.some((entry) => entry.muscle_id === muscle && entry.role === "primary"),
  );

/** Every muscle of a muscle map with its weight, in the order of the muscle list. */
export const creditOf = (
  muscles: readonly ExerciseMuscleEntry[],
): readonly (readonly [MuscleId, number])[] =>
  MUSCLE_IDS.flatMap((muscle) => {
    const entry = muscles.find((each) => each.muscle_id === muscle);
    return entry === undefined ? [] : [[muscle, entry.weight] as const];
  });

export type Candidate = Readonly<{
  exercise: SuggestExercise;
  /** The primary muscles, in the order of the muscle list. */
  primary: readonly MuscleId[];
  /** Every muscle the exercise works with its weight, in the order of the muscle list. */
  credit: readonly (readonly [MuscleId, number])[];
}>;

const candidateOf = (exercise: SuggestExercise): Candidate => ({
  exercise,
  primary: primaryMusclesOf(exercise.muscles),
  credit: creditOf(exercise.muscles),
});

type RankedCandidate = Readonly<{ candidate: Candidate; score: number }>;

const EXERCISE_COMPARISONS: Record<
  ExerciseTieBreak,
  (first: RankedCandidate, second: RankedCandidate) => number
> = {
  exercise_score: (first, second) => second.score - first.score,
  compound_first: (first, second) =>
    Number(second.candidate.exercise.mechanic === "compound") -
    Number(first.candidate.exercise.mechanic === "compound"),
  name: (first, second) =>
    compareText(first.candidate.exercise.name, second.candidate.exercise.name),
  id: (first, second) => compareText(first.candidate.exercise.id, second.candidate.exercise.id),
};

export type SuggestContext = Readonly<{
  /** The library exercises the user can do with their equipment. */
  pool: readonly Candidate[];
  setsPerExercise: number;
  isHot: (muscle: MuscleId) => boolean;
  heatOf: (muscle: MuscleId) => number;
  priorityOf: (muscle: MuscleId) => number;
  scoreOf: (muscle: MuscleId) => number;
  reasonOf: (muscle: MuscleId) => SuggestionReason;
  /** The best of these exercises by the tie-break order, or undefined when there are none. */
  bestOf: (candidates: readonly Candidate[]) => Candidate | undefined;
  /** Credits `sets` sets of an exercise with this muscle map to every muscle it works, at its weight. */
  creditSets: (credit: Candidate["credit"], sets: number) => void;
}>;

/**
 * The scoring state of one suggestion. `equipment` is what the user can use (the goal's, narrowed by the
 * constraints). The sets credited so far start at the logged sets of `state` and grow as sets are credited.
 */
export const createSuggestContext = (
  state: SuggestState,
  goals: SuggestGoals,
  library: readonly SuggestExercise[],
  equipment: readonly Equipment[],
  params: SuggestParams,
): SuggestContext => {
  // The sets this suggestion has credited so far, rounded. A muscle not credited yet is at its logged sets.
  const sets = new Map<MuscleId, number>();
  const heatOf = (muscle: MuscleId): number => state[muscle].heat;
  const priorityOf = (muscle: MuscleId): number => goals.muscle_priority[muscle] ?? 0;
  const mavLowOf = (muscle: MuscleId): number => muscleParams(muscle, params.training).mav.low;
  const setsOf = (muscle: MuscleId): number => sets.get(muscle) ?? state[muscle].weeklySets;
  const scoreOf = (muscle: MuscleId): number =>
    roundedTo(
      priorityOf(muscle) * Math.max(0, mavLowOf(muscle) - setsOf(muscle)) * (1 - heatOf(muscle)),
      SCORE_SCALE,
    );
  const compare = (first: RankedCandidate, second: RankedCandidate): number => {
    for (const rule of params.exerciseTieBreak) {
      const order = EXERCISE_COMPARISONS[rule](first, second);
      if (order !== 0) {
        return order;
      }
    }
    return 0;
  };

  return {
    pool: library.filter((exercise) => equipment.includes(exercise.equipment)).map(candidateOf),
    setsPerExercise: params.presets.setsPerExercise[goals.experience],
    isHot: (muscle) => heatOf(muscle) > params.hotHeatThreshold,
    heatOf,
    priorityOf,
    scoreOf,
    reasonOf: (muscle) => ({
      muscle_id: muscle,
      priority: priorityOf(muscle),
      weekly_sets: setsOf(muscle),
      mav_low: mavLowOf(muscle),
      heat: heatOf(muscle),
      score: scoreOf(muscle),
    }),
    bestOf: (candidates) =>
      candidates
        .map((candidate) => ({
          candidate,
          score: roundedTo(
            candidate.primary.reduce((total, muscle) => total + scoreOf(muscle), 0),
            SCORE_SCALE,
          ),
        }))
        .sort(compare)[0]?.candidate,
    creditSets: (credit, credited) => {
      for (const [muscle, weight] of credit) {
        sets.set(muscle, roundedTo(setsOf(muscle) + weight * credited, SETS_SCALE));
      }
    },
  };
};
