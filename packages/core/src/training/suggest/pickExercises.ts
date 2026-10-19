import { MUSCLE_IDS } from "../muscles";
import { estimateSessionMinutes } from "../sessionTime";

import type { MuscleId } from "../muscles";
import type { Candidate, SuggestContext } from "./suggestContext";
import type { SuggestParams } from "./suggestParams";
import type {
  NoRoom,
  NothingToSuggest,
  OtherNothingReason,
  SkippedMuscle,
  SuggestedExercise,
  SuggestGoals,
} from "./suggestTypes";

/*
 * The greedy pick of ADR 0005, "Goals and suggestions", shared by the fresh session and the planned day:
 * the muscle with the highest score that has an eligible exercise leads the next pick (a muscle leads at
 * most one exercise), and the best of its exercises is added with its sets credited to every muscle it
 * works, so the next score sees them. It stops at the exercise cap, when no muscle can lead, or when one
 * more exercise would read longer than the minutes.
 */

export type PickStart = Readonly<{
  /** The most exercises this pick adds. */
  cap: number;
  /** The exercises and sets already in the session, which the minutes count. */
  exercises: number;
  sets: number;
  minutes: number;
  /** The ids already in the session, which are never picked again. */
  taken: ReadonlySet<string>;
}>;

export type Picked = Readonly<{
  exercises: readonly SuggestedExercise[];
  /** The sets of the exercises picked. */
  sets: number;
  noRoom: NoRoom | null;
  /** An exercise for a muscle that scored was left out because one of its primary muscles is hot. */
  blockedByHeat: boolean;
}>;

export const pickExercises = (
  context: SuggestContext,
  params: SuggestParams,
  goals: SuggestGoals,
  start: PickStart,
): Picked => {
  const { scoreOf, priorityOf, isHot, reasonOf, setsPerExercise } = context;
  const chosen = new Set(start.taken);
  const led = new Set<MuscleId>();
  const picked: SuggestedExercise[] = [];
  let totalSets = 0;
  let noRoom: NoRoom | null = null;
  let blockedByHeat = false;

  while (picked.length < start.cap) {
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
      const options = context.pool.filter(
        (candidate) => !chosen.has(candidate.exercise.id) && candidate.primary.includes(lead),
      );
      const eligible = options.filter((candidate) => !candidate.primary.some(isHot));
      if (options.length > eligible.length) {
        blockedByHeat = true;
      }
      const best = context.bestOf(eligible);
      if (best !== undefined) {
        next = { lead, best };
        break;
      }
    }
    if (next === undefined) {
      break;
    }

    const minutesIfAdded = estimateSessionMinutes(
      {
        exercises: start.exercises + picked.length + 1,
        sets: start.sets + totalSets + setsPerExercise,
      },
      params.sessionTime,
    );
    if (minutesIfAdded > start.minutes) {
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
    context.creditSets(credit, setsPerExercise);
    totalSets += setsPerExercise;
    chosen.add(exercise.id);
    led.add(next.lead);
  }

  return { exercises: picked, sets: totalSets, noRoom, blockedByHeat };
};

/**
 * The muscles whose heat is above the threshold and whose score is above 0 (or that are named in
 * `alsoSkipped`), in the muscle list order. Read before the first pick, while the scores stand as they
 * were at the start.
 */
export const skippedMusclesOf = (
  context: SuggestContext,
  alsoSkipped: ReadonlySet<MuscleId>,
): SkippedMuscle[] =>
  MUSCLE_IDS.filter(
    (muscle) => context.isHot(muscle) && (context.scoreOf(muscle) > 0 || alsoSkipped.has(muscle)),
  ).map((muscle) => ({ muscle_id: muscle, heat: context.heatOf(muscle) }));

const otherNothingReason = (hasGap: boolean, blockedByHeat: boolean): OtherNothingReason => {
  if (!hasGap) {
    return "priorities_covered";
  }
  return blockedByHeat ? "all_hot" : "no_exercise";
};

/** Why nothing is suggested: the first exercise does not fit the minutes, or one of the other reasons. */
export const nothingOf = (
  skipped: readonly SkippedMuscle[],
  picked: Picked,
  hasGap: boolean,
): NothingToSuggest =>
  picked.noRoom === null
    ? {
        kind: "nothing",
        why: otherNothingReason(hasGap, picked.blockedByHeat),
        skipped,
        no_room: null,
      }
    : { kind: "nothing", why: "no_room", skipped, no_room: picked.noRoom };
