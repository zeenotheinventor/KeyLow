import { muscleState } from "../muscleState";
import { TRAINING_PARAMS_V2 } from "../params";

import type { MuscleId } from "../muscles";
import type { HeatSet, MuscleState } from "../muscleState";

/**
 * Each muscle's heat, ready time, weekly sets and volume status at `now`, an ISO timestamp with a zone,
 * from the sets read for the heat window, under the training parameters in use. The body map, the
 * suggestion and the assistant's reads all work the muscles out here, so they cannot disagree.
 */
export const currentMuscleState = (
  sets: readonly HeatSet[],
  now: string,
): Record<MuscleId, MuscleState> => muscleState(sets, now, TRAINING_PARAMS_V2);
