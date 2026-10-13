const toLinear = (channel: number): number => {
  const fraction = channel / 255;
  return fraction <= 0.03928 ? fraction / 12.92 : ((fraction + 0.055) / 1.055) ** 2.4;
};

const parseHex = (hex: string): [number, number, number] => {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (match?.[1] === undefined || match[2] === undefined || match[3] === undefined) {
    throw new Error(`Expected a #RRGGBB colour: ${hex}`);
  }
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
};

export const relativeLuminance = (hex: string): number => {
  const [red, green, blue] = parseHex(hex);
  return 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue);
};

/** The WCAG 2.x contrast ratio between two opaque colours, from 1 to 21. */
export const contrastRatio = (foregroundHex: string, backgroundHex: string): number => {
  const [lighter, darker] = [
    relativeLuminance(foregroundHex),
    relativeLuminance(backgroundHex),
  ].sort((first, second) => second - first);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
};
