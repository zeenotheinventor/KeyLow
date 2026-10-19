import { MUSCLE_IDS } from "../muscles";
import { estimateSessionMinutes } from "../sessionTime";
import { setEffort } from "../setEffort";
import { nothingOf, pickExercises, skippedMusclesOf } from "./pickExercises";
import { creditOf } from "./suggestContext";

import type { PlanRoutineDay } from "../expandPlan";
import type { SuggestContext } from "./suggestContext";
import type { SuggestParams } from "./suggestParams";
import type { KeptExercise, NothingToSuggest, PlanAdjusted, SuggestGoals } from "./suggestTypes";

/*
 * `suggestSession` on a planned routine day (KEY-401, and the numbers Zee agreed on KEY-396, Part 4, case
 * a). The plan is kept: every planned exercise stays, in its place, with its planned sets, and counts as
 * done for the score and for the length. Core only adds (KEY-396, Assumption 16: no swaps in v1), so a
 * planned exercise with a hot primary muscle, or with equipment the user lacks, is kept and credited like
 * any other. Then the greedy pick runs on what is left.
 */

export const suggestOnPlannedDay = (
  context: SuggestContext,
  params: SuggestParams,
  goals: SuggestGoals,
  plannedDay: PlanRoutineDay,
  minutes: number,
): PlanAdjusted | NothingToSuggest => {
  const plannedSets = plannedDay.exercises.reduce((total, each) => total + each.target_sets, 0);
  const plannedMinutes = estimateSessionMinutes(
    { exercises: plannedDay.exercises.length, sets: plannedSets },
    params.sessionTime,
  );

  // A planned set counts at its effort, as the plan's own sets do (a set with no target RIR counts in full).
  for (const plan of plannedDay.exercises) {
    context.creditSets(
      creditOf(plan.muscles),
      plan.target_sets *
        setEffort({ set_type: "working", rir: plan.target_rir, rpe: null }, params.training),
    );
  }
  const kept: KeptExercise[] = plannedDay.exercises.map((plan) => ({
    origin: "plan",
    routine_exercise_id: plan.id,
    exercise_id: plan.exercise_id,
    sets: plan.target_sets,
    target_rir: plan.target_rir,
  }));

  const hasGap = MUSCLE_IDS.some((muscle) => context.scoreOf(muscle) > 0);
  const skipped = skippedMusclesOf(context, new Set());
  const picked = pickExercises(context, params, goals, {
    cap: params.maxExercises.addedToPlannedDay,
    exercises: plannedDay.exercises.length,
    sets: plannedSets,
    minutes,
    taken: new Set(plannedDay.exercises.map((each) => each.exercise_id)),
  });

  if (picked.exercises.length === 0) {
    return nothingOf(skipped, picked, hasGap);
  }
  const exercises = [...kept, ...picked.exercises];
  const sets = plannedSets + picked.sets;
  return {
    kind: "plan_adjusted",
    exercises,
    added: picked.exercises.length,
    sets,
    minutes: estimateSessionMinutes({ exercises: exercises.length, sets }, params.sessionTime),
    planned: { sets: plannedSets, minutes: plannedMinutes },
    skipped,
    no_room: picked.noRoom,
  };
};
