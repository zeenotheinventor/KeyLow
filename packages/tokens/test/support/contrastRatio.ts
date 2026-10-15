const channelLuminance = (channel: number): number => {
  const fraction = channel / 255;
  return fraction <= 0.03928 ? fraction / 12.92 : ((fraction + 0.055) / 1.055) ** 2.4;
};

const luminanceOf = (hex: string): number => {
  const [red = 0, green = 0, blue = 0] = [1, 3, 5].map((start) =>
    channelLuminance(parseInt(hex.slice(start, start + 2), 16)),
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

/** The WCAG 2 contrast ratio between two solid `#RRGGBB` colours, from 1 to 21. */
export const contrastRatio = (first: string, second: string): number => {
  const [lighter = 0, darker = 0] = [luminanceOf(first), luminanceOf(second)].sort(
    (left, right) => right - left,
  );
  return (lighter + 0.05) / (darker + 0.05);
};
