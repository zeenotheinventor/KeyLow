/** Under this side the ring is compact, as the design system's card has it. */
export const compactBelowSize = 180;

export type RingNumbers = {
  /** How much of the ring the calories fill, from 0 to 1. */
  eatenFraction: number;
  /** How far the warning has gone round on top of a full ring, from 0 to 1. It stops at a full lap and never resets. */
  overFraction: number;
  /** The calories left, or past the target when `isOver`, always positive or zero. */
  remainingCalories: number;
  isOver: boolean;
};

/** Works from whole calories, because that is what is printed, so a day within half a calorie of the target is not over it. */
export function ringNumbers(eaten: number, target: number): RingNumbers {
  const wholeEaten = Math.round(eaten);
  const wholeTarget = Math.round(target);
  const ratio = wholeTarget > 0 ? wholeEaten / wholeTarget : 0;
  const remaining = wholeTarget - wholeEaten;

  return {
    eatenFraction: Math.min(1, ratio),
    overFraction: Math.max(0, Math.min(1, ratio - 1)),
    remainingCalories: Math.abs(remaining),
    isOver: remaining < 0,
  };
}

/** The ring's circle as an SVG path that starts at twelve o'clock and goes clockwise, so a trim from 0 fills from the top. */
export function ringPath(size: number, stroke: number): string {
  const centre = size / 2;
  const radius = (size - stroke) / 2;

  return [
    `M ${centre} ${centre - radius}`,
    `A ${radius} ${radius} 0 1 1 ${centre} ${centre + radius}`,
    `A ${radius} ${radius} 0 1 1 ${centre} ${centre - radius}`,
  ].join(" ");
}

export const ringCircumference = (size: number, stroke: number): number =>
  Math.PI * (size - stroke);
