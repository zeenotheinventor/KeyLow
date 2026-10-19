import { MUSCLE_IDS } from "../muscles";
import { estimateSessionMinutes } from "../sessionTime";
import { nothingOf, pickExercises, skippedMusclesOf } from "./pickExercises";
import { createSuggestContext } from "./suggestContext";
import { suggestOnPlannedDay } from "./suggestPlannedDay";

import type { SuggestParams } from "./suggestParams";
import type {
  SuggestConstraints,
  SuggestExercise,
  SuggestGoals,
  SuggestState,
  Suggestion,
} from "./suggestTypes";

/*
 * `suggestSession` (ADR 0005, "Goals and suggestions", and the numbers Zee agreed on KEY-396, Part 3 and
 * Part 4). Pure under the ADR 0002 rule: no clock, no randomness and no IO, so the same inputs always give
 * the same output, whatever order the library and the state keys come in.
 *
 * The rules, one muscle at a time. A muscle scores `priority × max(0, MAV low − sets) × (1 − heat)`. The
 * muscle with the highest score that has an eligible exercise leads the next pick (a muscle leads at most
 * one exercise), and the best of its exercises is added with its sets credited to every muscle it works,
 * so the next score sees them. It stops at the exercise cap, when no muscle can lead, or when one more
 * exercise would read longer than the minutes. On a planned day the plan is kept and counted first, and
 * only added to (see `suggestOnPlannedDay`).
 */

/**
 * A fresh session for a user with no routine for the day, the planned day kept with what is
 * added when `constraints.plannedDay` is given, or `nothing`. The goal's equipment and minutes are used
 * unless `constraints` narrows them. Reasons and skipped muscles are data (muscle ids and the numbers
 * behind each pick), never names or sentences.
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
  const context = createSuggestContext(state, goals, library, equipment, params);

  if (constraints.plannedDay !== undefined) {
    return suggestOnPlannedDay(context, params, goals, constraints.plannedDay, minutes);
  }

  const hasGap = MUSCLE_IDS.some((muscle) => context.scoreOf(muscle) > 0);
  const skipped = skippedMusclesOf(context, new Set());
  const picked = pickExercises(context, params, goals, {
    cap: params.maxExercises.fresh,
    exercises: 0,
    sets: 0,
    minutes,
    taken: new Set(),
  });

  if (picked.exercises.length > 0) {
    return {
      kind: "session",
      exercises: picked.exercises,
      sets: picked.sets,
      minutes: estimateSessionMinutes(
        { exercises: picked.exercises.length, sets: picked.sets },
        params.sessionTime,
      ),
      skipped,
      no_room: picked.noRoom,
    };
  }
  return nothingOf(skipped, picked, hasGap);
};
