import type { BodyCompositionChartAxis } from "./types";

// The margin left above the highest and below the lowest value before rounding out to a tick.
const AXIS_MARGIN = 0.5;
const MAX_TICK_COUNT = 4;
// The steps a tick can be apart, as 1, 2, 5, 10, 20, 50 and on, so a wide span still keeps to the tick count.
const STEP_DIGITS = [1, 2, 5];

/**
 * The y axis of one plot: whole number ticks at multiples of the smallest step (1, 2, 5, 10, 20 and so on)
 * that holds every value, with a margin of 0.5 each side, in at most 4 ticks. Null with no value. The axis
 * runs from the first tick to the last, so the plot is no larger than the labels say.
 */
export function buildAxis(values: readonly number[]): BodyCompositionChartAxis | null {
  if (values.length === 0) {
    return null;
  }
  const low = Math.min(...values) - AXIS_MARGIN;
  const high = Math.max(...values) + AXIS_MARGIN;

  // A wider step only ever has fewer ticks, so this ends.
  for (let magnitude = 1; ; magnitude *= 10) {
    for (const digit of STEP_DIGITS) {
      const step = digit * magnitude;
      const min = Math.floor(low / step) * step;
      const max = Math.ceil(high / step) * step;
      const tickCount = (max - min) / step + 1;
      if (tickCount <= MAX_TICK_COUNT) {
        return {
          min,
          max,
          ticks: Array.from({ length: tickCount }, (_, index) => min + index * step),
        };
      }
    }
  }
}
