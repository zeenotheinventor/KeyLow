import { MUSCLE_IDS } from "@keylow/core/training";

import type { BodyFigureValues } from "./types";

/** Every muscle takes the next value of the scale in turn, so each step or status appears on a side. */
export function inTurn(valueCount: number): BodyFigureValues {
  return Object.fromEntries(MUSCLE_IDS.map((muscle, index) => [muscle, index % valueCount]));
}

/** Heat steps 0 to 5 from rested to peak, in turn: the golden pattern both figures' stories are checked against. */
export const heatSteps = inTurn(6);
