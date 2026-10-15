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
