/** The cap is at most this share of the bar, however far over the target the day is. */
export const longestCapFraction = 0.35;

export type BarNumbers = {
  /** How much of the bar the macro colour fills, from 0 to 1. A bar that is over is full. */
  fillFraction: number;
  /** How much of the bar the warning cap covers, from 0 to 0.35. */
  capFraction: number;
  isOver: boolean;
  /** Grams past the target when `isOver`. */
  overGrams: number;
};

/** With no target (zero) the bar stays empty and the day is never over. */
export function barNumbers(eaten: number, target: number): BarNumbers {
  const ratio = target > 0 ? eaten / target : 0;
  const isOver = target > 0 && eaten > target;

  return {
    fillFraction: Math.min(1, ratio),
    capFraction: isOver ? Math.min(longestCapFraction, ratio - 1) : 0,
    isOver,
    overGrams: isOver ? eaten - target : 0,
  };
}
