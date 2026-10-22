import { PLAN_STATUSES } from "./compareWeek";
import { MUSCLE_IDS } from "./muscles";
import { muscleParams, VOLUME_STATUSES, volumeStatusOf } from "./muscleState";
import { TRAINING_PARAMS_V1 } from "./params";

import type { MusclePlanComparison } from "./compareWeek";
import type { MuscleId } from "./muscles";
import type { MuscleState } from "./muscleState";
import type { TrainingParams } from "./params";

/*
 * The numbers the body map draws (ADR 0005, "The body map"): one `Record<MuscleId, number>` per scale,
 * so no maths lives in the UI. Pure under the ADR 0002 rule. Every record holds all the muscle ids.
 */

/** The two maps of the body map screen: what was logged, and the plan with what was logged in its place. */
export type BodyMapView = "actual" | "projected";

/**
 * What each value of `gapValues` means, by index: 0 behind the plan, 1 on plan, 2 ahead of it, and 3
 * not in the plan.
 */
export const GAP_VALUES = ["behind", "on_plan", "ahead", "not_in_plan"] as const;

const byMuscle = <Value>(valueOf: (muscle: MuscleId) => Value): Record<MuscleId, Value> =>
  // Every id of the list is mapped, so the entries make the full record.
  Object.fromEntries(MUSCLE_IDS.map((muscle) => [muscle, valueOf(muscle)])) as Record<
    MuscleId,
    Value
  >;

/**
 * The rounded percent of heat from which a muscle counts as loaded: where the map reaches step 4, "Very
 * hot". The training reminders read it too ("Take it easy"), so the map and the reminder cannot disagree.
 */
export const LOADED_HEAT_PERCENT = 60;

/**
 * The rounded percent of heat at which heat steps 1 to 5 start: under the first cut a muscle is at step
 * 0 (rested), and from the last it is at step 5 (peak). Pinned by a test, so a change is deliberate.
 */
export const HEAT_STEP_CUTS_V1 = [5, 20, 40, LOADED_HEAT_PERCENT, 80] as const;

const percentOf = (heat: number): number => Math.round(heat * 100);

/**
 * Each muscle's heat as a step from 0 to 5: the number of `HEAT_STEP_CUTS_V1` its rounded percent of
 * heat has reached.
 */
export const heatValues = (
  states: Readonly<Record<MuscleId, Pick<MuscleState, "heat">>>,
): Record<MuscleId, number> =>
  byMuscle((muscle) => {
    const percent = percentOf(states[muscle].heat);
    return HEAT_STEP_CUTS_V1.filter((cut) => percent >= cut).length;
  });

/**
 * Each muscle's volume status as its index in `VOLUME_STATUSES`: 0 under, 1 maintaining, 2 productive,
 * 3 over, 4 not targeted. The sets are the calendar week's (Monday to Sunday, Zee's ruling B on KEY-339)
 * that `compareWeek` counted, never the rolling window: `actualWeeklySets` for Actual and
 * `projectedWeeklySets` for Projected. Over starts above the MRV (ruling F).
 */
export const volumeValues = (
  comparison: Readonly<
    Record<MuscleId, Pick<MusclePlanComparison, "actualWeeklySets" | "projectedWeeklySets">>
  >,
  targeted: ReadonlySet<MuscleId>,
  view: BodyMapView,
  params: TrainingParams = TRAINING_PARAMS_V1,
): Record<MuscleId, number> =>
  byMuscle((muscle) => {
    const { actualWeeklySets, projectedWeeklySets } = comparison[muscle];
    const weeklySets = view === "actual" ? actualWeeklySets : projectedWeeklySets;
    return VOLUME_STATUSES.indexOf(
      volumeStatusOf(weeklySets, muscleParams(muscle, params), targeted.has(muscle)),
    );
  });

/**
 * Each muscle's place against the plan as an index in `GAP_VALUES`: `compareWeek`'s status, or 3 (not in
 * plan) for a muscle that is not targeted or has nothing planned and nothing done.
 */
export const gapValues = (
  comparison: Readonly<Record<MuscleId, MusclePlanComparison>>,
  targeted: ReadonlySet<MuscleId>,
): Record<MuscleId, number> =>
  byMuscle((muscle) => {
    const { actualWeeklySets, projectedWeeklySets, status } = comparison[muscle];
    const inPlan = targeted.has(muscle) && (actualWeeklySets > 0 || projectedWeeklySets > 0);
    return inPlan ? PLAN_STATUSES.indexOf(status) : GAP_VALUES.indexOf("not_in_plan");
  });

const DEFAULT_WARMEST_COUNT = 3;

/** A muscle and its heat as a rounded percent. */
export type WarmMuscle = { muscle: MuscleId; percent: number };

/**
 * The `count` muscles with the most heat, the warmest first, each with its heat as a rounded percent.
 * A tie goes in the order of the muscle list, and a muscle whose heat rounds to 0 % is left out, so
 * fewer than `count` come back when fewer are warm.
 */
export const warmestMuscles = (
  states: Readonly<Record<MuscleId, Pick<MuscleState, "heat">>>,
  count = DEFAULT_WARMEST_COUNT,
): WarmMuscle[] =>
  MUSCLE_IDS.filter((muscle) => percentOf(states[muscle].heat) > 0)
    // The sort is stable, so equal heat keeps the order of the muscle list.
    .sort((first, second) => states[second].heat - states[first].heat)
    .slice(0, count)
    .map((muscle) => ({ muscle, percent: percentOf(states[muscle].heat) }));
