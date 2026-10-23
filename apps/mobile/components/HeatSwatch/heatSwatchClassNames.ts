// The colour of each heat step, from Rested (0) up to Peak (5), written out so Tailwind sees them. Only the
// peak glows. The legend, the Muscles trained rows and the muscle list share them, so a step can never be
// drawn in two colours.
export const heatSwatchClassNames = [
  "bg-heat-0",
  "bg-heat-1",
  "bg-heat-2",
  "bg-heat-3",
  "bg-heat-4",
  "bg-heat-5 shadow-[0_0_8px_0] shadow-heat-glow",
] as const;
