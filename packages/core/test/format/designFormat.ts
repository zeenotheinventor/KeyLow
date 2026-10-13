/**
 * The design system's own `Format`, copied from `design-source/components/core/kl.js` with only
 * type annotations added. The parity test runs the core port against it, so the two cannot drift.
 * Do not tidy this file: it is a fixture and must keep the design's arithmetic.
 */
export const designFormat = {
  /** Calories: whole numbers, thousands separator. */
  calories(kcal: number): string {
    return Math.round(kcal).toLocaleString("en-GB");
  },
  /** Grams: one decimal only when under 10, otherwise whole. */
  grams(g: number): string {
    const a = Math.abs(g);
    return a < 10
      ? (Math.round(g * 10) / 10).toFixed(1).replace(/\.0$/, "")
      : String(Math.round(g));
  },
  /** Weight: one decimal in kg, lb or st. */
  weight(value: number, unit = "kg"): string {
    return `${(Math.round(value * 10) / 10).toFixed(1)} ${unit}`;
  },
  /** Signed over/under delta in grams. */
  deltaGrams(g: number): string {
    return `${g > 0 ? "+" : g < 0 ? "−" : ""}${designFormat.grams(Math.abs(g))} g`;
  },
};
