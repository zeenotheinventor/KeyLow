import { MUSCLE_IDS } from "../muscles";
import { muscleParams } from "../muscleState";
import { estimateSessionMinutes } from "../sessionTime";

import type { MuscleId } from "../muscles";
import type { ExerciseTieBreak, SuggestParams } from "./suggestParams";
import type {
  NoRoom,
  OtherNothingReason,
  SuggestConstraints,
  SuggestedExercise,
  SuggestExercise,
  SuggestGoals,
  SuggestionReason,
  SuggestState,
  Suggestion,
} from "./suggestTypes";

/*
 * `suggestSession`, the fresh half (ADR 0005, "Goals and suggestions", and the numbers Zee agreed on
 * KEY-396, Part 3 and Part 4). Pure under the ADR 0002 rule: no clock, no randomness and no IO, so the
 * same inputs always give the same output, whatever order the library and the state keys come in.
 *
 * The rules, one muscle at a time. A muscle scores `priority × max(0, MAV low − sets) × (1 − heat)`. The
 * muscle with the highest score that has an eligible exercise leads the next pick (a muscle leads at most
 * one exercise), and the best of its exercises is added with its sets credited to every muscle it works,
 * so the next score sees them. It stops at the exercise cap, when no muscle can lead, or when one more
 * exercise would read longer than the minutes.
 */

// Scores compare after rounding to 6 decimals, so a tie is a tie. Sets round as `muscleState` rounds them.
const SCORE_SCALE = 1e6;
const SETS_SCALE = 1e9;

const roundedTo = (value: number, scale: number): number => Math.round(value * scale) / scale;

/** Code unit order, so the answer never depends on the language of the device. */
const compareText = (first: string, second: string): number =>
  first < second ? -1 : first > second ? 1 : 0;

type Candidate = Readonly<{
  exercise: SuggestExercise;
  /** The primary muscles, in the order of the muscle list. */
  primary: readonly MuscleId[];
  /** Every muscle the exercise works with its weight, in the order of the muscle list. */
  credit: readonly (readonly [MuscleId, number])[];
}>;

const candidateOf = (exercise: SuggestExercise): Candidate => ({
  exercise,
  primary: MUSCLE_IDS.filter((muscle) =>
    exercise.muscles.some((entry) => entry.muscle_id === muscle && entry.role === "primary"),
  ),
  credit: MUSCLE_IDS.flatMap((muscle) => {
    const entry = exercise.muscles.find((each) => each.muscle_id === muscle);
    return entry === undefined ? [] : [[muscle, entry.weight] as const];
  }),
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

/**
 * A fresh session for a user with no routine for the day, or `nothing`. The goal's equipment and minutes
 * are used unless `constraints` narrows them. Reasons and skipped muscles are data (muscle ids and the
 * numbers behind each pick), never names or sentences.
 *
 * Throws a `RangeError` stating the rule for an empty equipment list or a minutes budget that is not
 * above 0. The message never holds a value, because a goal answer is health data.
 */
export const suggestSession = (
  state: SuggestState,
  goals: SuggestGoals,
  library: readonly SuggestExercise[],
  constraints: SuggestConstraints,
  params: SuggestParams,
): Suggestion => {
  const narrowing = constraints.equipment;
  const minutes = constraints.minutes ?? goals.session_minutes;
  if (goals.equipment.length === 0 || narrowing?.length === 0) {
    throw new RangeError("Suggestions need at least one piece of equipment");
  }
  if (!(minutes > 0)) {
    throw new RangeError("The session minutes must be greater than 0");
  }

  // A screen may narrow the goal's equipment and never widen it, so the pool holds what both list.
  const equipment =
    narrowing === undefined
      ? goals.equipment
      : goals.equipment.filter((each) => narrowing.includes(each));
  const pool = library
    .filter((exercise) => equipment.includes(exercise.equipment))
    .map(candidateOf);
  const setsPerExercise = params.presets.setsPerExercise[goals.experience];
  // The sets this suggestion has credited so far, rounded. A muscle not credited yet is at its logged sets.
  const sets = new Map<MuscleId, number>();
  const isHot = (muscle: MuscleId): boolean => state[muscle].heat > params.hotHeatThreshold;
  const priorityOf = (muscle: MuscleId): number => goals.muscle_priority[muscle] ?? 0;
  const mavLowOf = (muscle: MuscleId): number => muscleParams(muscle, params.training).mav.low;
  const setsOf = (muscle: MuscleId): number => sets.get(muscle) ?? state[muscle].weeklySets;
  const scoreOf = (muscle: MuscleId): number =>
    roundedTo(
      priorityOf(muscle) *
        Math.max(0, mavLowOf(muscle) - setsOf(muscle)) *
        (1 - state[muscle].heat),
      SCORE_SCALE,
    );
  const reasonOf = (muscle: MuscleId): SuggestionReason => ({
    muscle_id: muscle,
    priority: priorityOf(muscle),
    weekly_sets: setsOf(muscle),
    mav_low: mavLowOf(muscle),
    heat: state[muscle].heat,
    score: scoreOf(muscle),
  });
  const compare = (first: RankedCandidate, second: RankedCandidate): number => {
    for (const rule of params.exerciseTieBreak) {
      const order = EXERCISE_COMPARISONS[rule](first, second);
      if (order !== 0) {
        return order;
      }
    }
    return 0;
  };

  const scoredAtStart = MUSCLE_IDS.filter((muscle) => scoreOf(muscle) > 0);
  const skipped = scoredAtStart
    .filter(isHot)
    .map((muscle) => ({ muscle_id: muscle, heat: state[muscle].heat }));

  const chosen = new Set<string>();
  const led = new Set<MuscleId>();
  const picked: SuggestedExercise[] = [];
  let totalSets = 0;
  let noRoom: NoRoom | null = null;
  let blockedByHeat = false;

  while (picked.length < params.maxExercises.fresh) {
    // Highest score first, then higher priority, then earlier in the muscle list. The last step is spelled
    // out so the order never depends on the sort being stable.
    const leaders = MUSCLE_IDS.filter((muscle) => !led.has(muscle) && scoreOf(muscle) > 0).sort(
      (first, second) =>
        scoreOf(second) - scoreOf(first) ||
        priorityOf(second) - priorityOf(first) ||
        MUSCLE_IDS.indexOf(first) - MUSCLE_IDS.indexOf(second),
    );
    let next: { lead: MuscleId; best: Candidate } | undefined;
    for (const lead of leaders) {
      const options = pool.filter(
        (candidate) => !chosen.has(candidate.exercise.id) && candidate.primary.includes(lead),
      );
      const eligible = options.filter((candidate) => !candidate.primary.some(isHot));
      if (options.length > eligible.length) {
        blockedByHeat = true;
      }
      const best = eligible
        .map((candidate) => ({
          candidate,
          score: roundedTo(
            candidate.primary.reduce((total, muscle) => total + scoreOf(muscle), 0),
            SCORE_SCALE,
          ),
        }))
        .sort(compare)[0];
      if (best !== undefined) {
        next = { lead, best: best.candidate };
        break;
      }
    }
    if (next === undefined) {
      break;
    }

    const minutesIfAdded = estimateSessionMinutes(
      { exercises: picked.length + 1, sets: totalSets + setsPerExercise },
      params.sessionTime,
    );
    if (minutesIfAdded > minutes) {
      noRoom = {
        muscle_id: next.lead,
        score: scoreOf(next.lead),
        minutes_if_added: minutesIfAdded,
      };
      break;
    }

    const { exercise, primary, credit } = next.best;
    const target = params.presets.exerciseTargets[goals.goal][exercise.mechanic];
    picked.push({
      exercise_id: exercise.id,
      sets: setsPerExercise,
      rep_min: target.repMin,
      rep_max: target.repMax,
      target_rir: target.targetRir,
      origin: "added",
      reasons: [next.lead, ...primary.filter((muscle) => muscle !== next.lead)]
        .map(reasonOf)
        .filter((reason) => reason.score > 0),
    });
    for (const [muscle, weight] of credit) {
      sets.set(muscle, roundedTo(setsOf(muscle) + weight * setsPerExercise, SETS_SCALE));
    }
    totalSets += setsPerExercise;
    chosen.add(exercise.id);
    led.add(next.lead);
  }

  if (picked.length > 0) {
    return {
      kind: "session",
      exercises: picked,
      sets: totalSets,
      minutes: estimateSessionMinutes(
        { exercises: picked.length, sets: totalSets },
        params.sessionTime,
      ),
      skipped,
      no_room: noRoom,
    };
  }
  if (noRoom !== null) {
    return { kind: "nothing", why: "no_room", skipped, no_room: noRoom };
  }
  return {
    kind: "nothing",
    why: otherNothingReason(scoredAtStart.length > 0, blockedByHeat),
    skipped,
    no_room: null,
  };
};

const otherNothingReason = (hasGap: boolean, blockedByHeat: boolean): OtherNothingReason => {
  if (!hasGap) {
    return "priorities_covered";
  }
  return blockedByHeat ? "all_hot" : "no_exercise";
};
