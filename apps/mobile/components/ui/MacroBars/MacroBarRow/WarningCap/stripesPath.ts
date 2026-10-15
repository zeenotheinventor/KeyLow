// The design hatches the cap with 1 point stripes 4 points apart, measured across the stripe. Across
// the bar that is 4 times the square root of 2.
const stripeGap = 4 * Math.SQRT2;

/** Rising diagonal stripes across a box of this width and height, as an SVG path. */
export function stripesPath(width: number, height: number): string {
  const stripes: string[] = [];
  for (let left = -height; left < width; left += stripeGap) {
    stripes.push(`M ${left} ${height} L ${left + height} 0`);
  }
  return stripes.join(" ");
}
