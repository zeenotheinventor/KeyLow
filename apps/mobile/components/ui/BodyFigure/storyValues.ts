import { MUSCLE_IDS, ROLE_FIGURE_VALUES } from "@keylow/core/training";

import type { BodyFigureValues } from "./types";

/** Every muscle takes the next value of the scale in turn, so each step or status appears on a side. */
export function inTurn(valueCount: number): BodyFigureValues {
  return Object.fromEntries(MUSCLE_IDS.map((muscle, index) => [muscle, index % valueCount]));
}

/** Heat steps 0 to 5 from rested to peak, in turn: the golden pattern both figures' stories are checked against. */
export const heatSteps = inTurn(6);

/** The Leg Press on the role scale: quads primary, glutes (glute_max) and hamstrings secondary, calves assisting, as the exercise library has it. */
export const legPressRoles: BodyFigureValues = {
  quads: ROLE_FIGURE_VALUES.primary,
  glute_max: ROLE_FIGURE_VALUES.secondary,
  hamstrings: ROLE_FIGURE_VALUES.secondary,
  calves: ROLE_FIGURE_VALUES.stabiliser,
};
