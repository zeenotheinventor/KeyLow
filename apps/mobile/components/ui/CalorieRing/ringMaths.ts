// The over-target outline is a 1 point gap, then a 1.5 point ring, on each side of the stroke (ruling 17).
const outlineGap = 1;
export const outlineWidth = 1.5;

/**
 * How many points the canvas is larger than the ring on every side. The outer outline of a 14 point stroke
 * reaches 2.5 points past the ring's box, and the canvas clips at its edge, so it is given 3.
 */
export const canvasOutset = 3;

/** A circle as an SVG path that starts at twelve o'clock and goes clockwise, so a trim from 0 fills from the top. */
function circlePath(side: number, radius: number): string {
  const centre = side / 2;

  return [
    `M ${centre} ${centre - radius}`,
    `A ${radius} ${radius} 0 1 1 ${centre} ${centre + radius}`,
    `A ${radius} ${radius} 0 1 1 ${centre} ${centre - radius}`,
  ].join(" ");
}

export type RingPaths = {
  /** The circle the track and the fill are stroked along. */
  ring: string;
  /** The circle of the outline outside the stroke, drawn over target. */
  outerOutline: string;
  /** The circle of the outline inside the stroke, drawn over target. */
  innerOutline: string;
};

/** The circles of a ring of `size` points and `stroke` line width, in a canvas that is `canvasOutset` larger on every side. */
export function ringPaths(size: number, stroke: number): RingPaths {
  const side = size + 2 * canvasOutset;
  const radius = (size - stroke) / 2;
  const outlineReach = stroke / 2 + outlineGap + outlineWidth / 2;

  return {
    ring: circlePath(side, radius),
    outerOutline: circlePath(side, radius + outlineReach),
    innerOutline: circlePath(side, radius - outlineReach),
  };
}
