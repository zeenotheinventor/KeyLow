import { describeHeatStep, ROLE_VALUE_NAMES, VOLUME_STATUS_NAMES } from "@keylow/core/copy";
import { ROLE_FIGURE_VALUES, VOLUME_STATUSES } from "@keylow/core/training";

import type { BodyFigureScale } from "./types";
import type { RoleValue } from "@keylow/core/copy";
import type { BodyMapPalette } from "@keylow/tokens";

/*
 * What a value means on each scale: the colour a muscle is filled with and the word the screen reader
 * says. The order of each list is the encoding core pins in `bodyMapValues`: the heat step, the index
 * in `VOLUME_STATUSES` and the index in `GAP_VALUES`. The heat words are core's `HEAT_STEP_NAMES`, the
 * volume words are core's `VOLUME_STATUS_NAMES` and the gap words are the legend of the `tokens · body-map
 * scales` board. The role scale holds the values of core's `ROLE_FIGURE_VALUES`, and its words are core's
 * `ROLE_VALUE_NAMES`.
 */

const GAP_NAMES = ["Behind", "On plan", "Ahead", "Not in plan"] as const;

const PEAK_HEAT_STEP = 5;

export type MuscleReading = {
  fill: string;
  /** The value in words, such as "Hot". */
  valueName: string;
  /** Whether the muscle glows, which only the peak heat step does. */
  isPeak: boolean;
};

/** The heat step held to the ends of the scale, and 0 for a muscle with no value or a value that is no number. */
function heatStepOf(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(PEAK_HEAT_STEP, Math.round(value)));
}

/** The index of a status that the scale has, or the last one, which is the muscle that is not in play. */
function statusIndexOf(value: number | undefined, statusCount: number): number {
  return value !== undefined && Number.isInteger(value) && value >= 0 && value < statusCount - 1
    ? value
    : statusCount - 1;
}

/** The index of a volume status, or 0, not trained, for a muscle with no value or a value the scale does not have. */
function volumeIndexOf(value: number | undefined): number {
  return value !== undefined &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < VOLUME_STATUSES.length
    ? value
    : 0;
}

/** The role value the scale has, or 0, not worked, for a muscle with no value or a value the scale does not have. */
function roleValueOf(value: number | undefined): RoleValue {
  switch (value) {
    case ROLE_FIGURE_VALUES.stabiliser:
    case ROLE_FIGURE_VALUES.secondary:
    case ROLE_FIGURE_VALUES.primary:
      return value;
    default:
      return 0;
  }
}

function pick<Item>(items: readonly Item[], index: number, fallback: Item): Item {
  return items[index] ?? fallback;
}

/**
 * The fill and the spoken value of one muscle on one scale. A muscle with no value, or a value the scale
 * does not have, is drawn at rest on heat, not trained on volume, not in the plan on gap and not worked on role.
 */
export function readMuscle(
  scale: BodyFigureScale,
  value: number | undefined,
  palette: BodyMapPalette,
): MuscleReading {
  if (scale === "heat") {
    const step = heatStepOf(value);
    return {
      fill: pick(palette.heat, step, palette.heat[0]),
      valueName: describeHeatStep(step),
      isPeak: step === PEAK_HEAT_STEP,
    };
  }

  if (scale === "volume") {
    const status = VOLUME_STATUSES[volumeIndexOf(value)] ?? "not_trained";
    const fills = {
      not_trained: palette.volume.notTrained,
      maintaining: palette.volume.maintaining,
      growing: palette.volume.growing,
      productive: palette.volume.productive,
      high: palette.volume.high,
    };
    return { fill: fills[status], valueName: VOLUME_STATUS_NAMES[status], isPeak: false };
  }

  if (scale === "role") {
    const role = roleValueOf(value);
    const fills = {
      0: palette.heat[0],
      [ROLE_FIGURE_VALUES.stabiliser]: palette.role.assist,
      [ROLE_FIGURE_VALUES.secondary]: palette.role.secondary,
      [ROLE_FIGURE_VALUES.primary]: palette.role.primary,
    };
    return { fill: fills[role], valueName: ROLE_VALUE_NAMES[role], isPeak: false };
  }

  const fills = [palette.gap.behind, palette.gap.onPlan, palette.gap.ahead, palette.gap.notInPlan];
  const index = statusIndexOf(value, fills.length);
  return {
    fill: pick(fills, index, palette.gap.notInPlan),
    valueName: pick(GAP_NAMES, index, "Not in plan"),
    isPeak: false,
  };
}
