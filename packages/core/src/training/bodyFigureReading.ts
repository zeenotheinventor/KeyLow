import { GAP_VALUES } from "./bodyMapValues";
import { ROLE_FIGURE_VALUES } from "./exerciseRoles";
import { VOLUME_STATUSES } from "./muscleState";
import { describeHeatStep, GAP_VALUE_NAMES, VOLUME_STATUS_NAMES } from "../copy/bodyMap";
import { ROLE_VALUE_NAMES } from "../copy/exerciseMuscles";

import type { RoleValue } from "../copy/exerciseMuscles";

/*
 * What a value means on each scale of the body figure: the colour token a muscle is filled with, the word
 * the screen reader says and whether the muscle glows. The order of each list is the encoding of
 * `bodyMapValues`: the heat step, the index in `VOLUME_STATUSES` and the index in `GAP_VALUES`. The role
 * scale holds the values of `ROLE_FIGURE_VALUES`. A token name is shared by the platforms, because mobile
 * fills with the token's colour string and web with the token's class.
 */

/**
 * Which colour scale the figure is drawn in: the body map's three, and the role of each muscle in an
 * exercise, which only the "Muscles it works" sheet uses.
 */
export type BodyFigureScale = "heat" | "volume" | "gap" | "role";

const HEAT_TONES = ["heat-0", "heat-1", "heat-2", "heat-3", "heat-4", "heat-5"] as const;

/** The colour token of a muscle's fill. The gap scale draws "not in plan" as `volume-not-trained`, and the role scale draws "not worked" as `heat-0`. */
export type BodyFigureTone =
  | (typeof HEAT_TONES)[number]
  | "volume-not-trained"
  | "volume-maintaining"
  | "volume-growing"
  | "volume-productive"
  | "volume-high"
  | "gap-behind"
  | "gap-on-plan"
  | "gap-ahead"
  | "role-primary"
  | "role-secondary"
  | "role-assist";

export type MuscleValueReading = {
  tone: BodyFigureTone;
  /** The value in words, such as "Hot". */
  valueName: string;
  /** Whether the muscle glows, which only the peak heat step does. */
  isPeak: boolean;
};

const PEAK_HEAT_STEP = 5;

const VOLUME_TONES = {
  not_trained: "volume-not-trained",
  maintaining: "volume-maintaining",
  growing: "volume-growing",
  productive: "volume-productive",
  high: "volume-high",
} as const satisfies Record<(typeof VOLUME_STATUSES)[number], BodyFigureTone>;

const GAP_TONES = {
  behind: "gap-behind",
  on_plan: "gap-on-plan",
  ahead: "gap-ahead",
  not_in_plan: "volume-not-trained",
} as const satisfies Record<(typeof GAP_VALUES)[number], BodyFigureTone>;

const ROLE_TONES = {
  0: "heat-0",
  [ROLE_FIGURE_VALUES.stabiliser]: "role-assist",
  [ROLE_FIGURE_VALUES.secondary]: "role-secondary",
  [ROLE_FIGURE_VALUES.primary]: "role-primary",
} as const satisfies Record<RoleValue, BodyFigureTone>;

/** The heat step held to the ends of the scale, and 0 for a muscle with no value or a value that is no number. */
function heatStepFromValue(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(PEAK_HEAT_STEP, Math.round(value)));
}

/** The index of a status that the scale has, or the last one, which is the muscle that is not in play. */
function lastStatusIndexFromValue(value: number | undefined, statusCount: number): number {
  return value !== undefined && Number.isInteger(value) && value >= 0 && value < statusCount - 1
    ? value
    : statusCount - 1;
}

/** The index of a volume status, or 0, not trained, for a muscle with no value or a value the scale does not have. */
function volumeIndexFromValue(value: number | undefined): number {
  return value !== undefined &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < VOLUME_STATUSES.length
    ? value
    : 0;
}

/** The role value the scale has, or 0, not worked, for a muscle with no value or a value the scale does not have. */
function roleValueFromValue(value: number | undefined): RoleValue {
  switch (value) {
    case ROLE_FIGURE_VALUES.stabiliser:
    case ROLE_FIGURE_VALUES.secondary:
    case ROLE_FIGURE_VALUES.primary:
      return value;
    default:
      return 0;
  }
}

/**
 * The colour token and the spoken value of one muscle on one scale. A muscle with no value, or a value the
 * scale does not have, is read at rest on heat, not trained on volume, not in the plan on gap and not worked
 * on role.
 */
export function readMuscleValue(
  scale: BodyFigureScale,
  value: number | undefined,
): MuscleValueReading {
  if (scale === "heat") {
    const step = heatStepFromValue(value);
    return {
      tone: HEAT_TONES[step] ?? HEAT_TONES[0],
      valueName: describeHeatStep(step),
      isPeak: step === PEAK_HEAT_STEP,
    };
  }

  if (scale === "volume") {
    const status = VOLUME_STATUSES[volumeIndexFromValue(value)] ?? "not_trained";
    return { tone: VOLUME_TONES[status], valueName: VOLUME_STATUS_NAMES[status], isPeak: false };
  }

  if (scale === "role") {
    const role = roleValueFromValue(value);
    return { tone: ROLE_TONES[role], valueName: ROLE_VALUE_NAMES[role], isPeak: false };
  }

  const gap = GAP_VALUES[lastStatusIndexFromValue(value, GAP_VALUES.length)] ?? "not_in_plan";
  return { tone: GAP_TONES[gap], valueName: GAP_VALUE_NAMES[gap], isPeak: false };
}
