import { themes } from "./theme";

import type { ThemeScheme } from "./theme";

export type BodyMapPalette = {
  /** Rested, ready, warm, hot, very hot and peak, in that order. */
  heat: [string, string, string, string, string, string];
  heatGlow: string;
  volume: {
    under: string;
    maintaining: string;
    productive: string;
    over: string;
    notTargeted: string;
  };
  gap: { behind: string; onPlan: string; ahead: string; notInPlan: string };
  silhouette: string;
  separator: string;
};

/**
 * The body map's colours for one theme as concrete colour strings, because `react-native-svg` fills
 * cannot read CSS variables. The values are the Ki-Lo training additions in `src/source/training.css`.
 * The gap scale draws "not in plan" as the volume scale's "not targeted", as the canvas does.
 */
export const bodyMapPalette = (scheme: ThemeScheme): BodyMapPalette => {
  const colors = themes[scheme];
  return {
    heat: [
      colors["heat-0"],
      colors["heat-1"],
      colors["heat-2"],
      colors["heat-3"],
      colors["heat-4"],
      colors["heat-5"],
    ],
    heatGlow: colors["heat-glow"],
    volume: {
      under: colors["volume-under"],
      maintaining: colors["volume-maintaining"],
      productive: colors["volume-productive"],
      over: colors["volume-over"],
      notTargeted: colors["volume-not-targeted"],
    },
    gap: {
      behind: colors["gap-behind"],
      onPlan: colors["gap-on-plan"],
      ahead: colors["gap-ahead"],
      notInPlan: colors["volume-not-targeted"],
    },
    silhouette: colors["body-silhouette"],
    separator: colors["body-separator"],
  };
};
