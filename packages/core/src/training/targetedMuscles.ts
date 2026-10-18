import { isMuscleId, MUSCLE_IDS } from "./muscles";

import type { PlanRoutine } from "./expandPlan";
import type { MuscleId } from "./muscles";

/*
 * Which muscles the plan and the goal train (ADR 0005, "The heat model" and "Goals and suggestions", Zee's
 * ruling E on KEY-339 and his confirmation on KEY-356). Pure under the ADR 0002 rule: it reads only its
 * input, and nothing in it is a tunable, so it needs no params version.
 */

export type TargetedMusclesInput = Readonly<{
  /** The active routine, or null when the user has none. */
  routine: PlanRoutine | null;
  /** The current goal's `training_goals.muscle_priority`, or null or left out when there is no goal. */
  priority?: Readonly<Partial<Record<MuscleId, number>>> | null;
}>;

/** The muscles the goal ranks above 0, or a `RangeError` naming the rule for a priority that breaks it. */
const rankedMuscles = (priority: TargetedMusclesInput["priority"]): MuscleId[] => {
  const ranked: MuscleId[] = [];
  for (const [muscle, value] of Object.entries(priority ?? {})) {
    if (!isMuscleId(muscle)) {
      throw new RangeError("A muscle priority must name a muscle of the list");
    }
    if (!Number.isFinite(value)) {
      throw new RangeError("A muscle priority must be a finite number");
    }
    if (value > 0) {
      ranked.push(muscle);
    }
  }
  return ranked;
};

/**
 * The muscles that are targeted: those some exercise of the routine's days holds in its muscle map with a
 * weight above 0 (any role, any day, a day with no weekday included, so a day `expandPlan` places no sets
 * for still counts), together with those the goal gives a priority above 0. A priority of 0 or below, or
 * none, does not target a muscle.
 *
 * With no such muscle at all (no routine, or a routine with no exercises, and no priority above 0), every
 * muscle is targeted, because there is then no basis to call any muscle outside the plan.
 *
 * Throws a `RangeError` naming the rule when a priority is for a muscle not in the list or is not a
 * finite number.
 */
export const targetedMuscles = ({
  routine,
  priority,
}: TargetedMusclesInput): ReadonlySet<MuscleId> => {
  const targeted = new Set<MuscleId>();
  for (const day of routine?.days ?? []) {
    for (const exercise of day.exercises) {
      for (const { muscle_id, weight } of exercise.muscles) {
        if (weight > 0) {
          targeted.add(muscle_id);
        }
      }
    }
  }
  for (const muscle of rankedMuscles(priority)) {
    targeted.add(muscle);
  }
  return targeted.size === 0 ? new Set(MUSCLE_IDS) : targeted;
};
