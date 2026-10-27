import { themes } from "./theme";

import type { ThemeScheme } from "./theme";

export type BodyMapPalette = {
  /** Rested, ready, warm, hot, very hot and peak, in that order. */
  heat: [string, string, string, string, string, string];
  heatGlow: string;
  /** Not trained, maintaining, growing, productive and high: the five volume bands. */
  volume: {
    notTrained: string;
    maintaining: string;
    growing: string;
    productive: string;
    high: string;
  };
  gap: { behind: string; onPlan: string; ahead: string; notInPlan: string };
  /** A muscle's role in an exercise, as the "Muscles it works" sheet draws it. */
  role: { primary: string; secondary: string; assist: string };
  silhouette: string;
  separator: string;
  /** The 3D body's see-through skin, the dark core under the muscles, the clay head and the muscles that have no id. */
  skin: string;
  core: string;
  clay: string;
  otherMuscle: string;
};

/**
 * The body map's colours for one theme as concrete colour strings, because `react-native-svg` fills
 * cannot read CSS variables. The values are the Ki-Lo training additions in `src/source/training.css`.
 * The gap scale draws "not in plan" as the volume scale's "not trained", as the canvas does.
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
      notTrained: colors["volume-not-trained"],
      maintaining: colors["volume-maintaining"],
      growing: colors["volume-growing"],
      productive: colors["volume-productive"],
      high: colors["volume-high"],
    },
    gap: {
      behind: colors["gap-behind"],
      onPlan: colors["gap-on-plan"],
      ahead: colors["gap-ahead"],
      notInPlan: colors["volume-not-trained"],
    },
    role: {
      primary: colors["role-primary"],
      secondary: colors["role-secondary"],
      assist: colors["role-assist"],
    },
    silhouette: colors["body-silhouette"],
    separator: colors["body-separator"],
    skin: colors["body-skin"],
    core: colors["body-core"],
    clay: colors["body-clay"],
    otherMuscle: colors["body-other-muscle"],
  };
};
