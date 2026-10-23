import { TREND_EXPLAINER } from "@keylow/core/copy";
import { TREND_SETTLED_OBS } from "@keylow/core/weight";
import { vars } from "nativewind";
import { View } from "react-native";

import type { SettlingProgressBarProps } from "./types";

/**
 * The accepted readings against the 7 a settled trend needs, as the trend-explainer board draws it inside the
 * warning banner: a 6 point track on the raised surface with a warning fill.
 */
export function SettlingProgressBar({ observationCount }: SettlingProgressBarProps) {
  // More than a settled trend needs holds the bar full.
  const countShown = Math.min(Math.max(observationCount, 0), TREND_SETTLED_OBS);

  return (
    <View
      accessible
      aria-label={TREND_EXPLAINER.progressName}
      aria-valuemax={TREND_SETTLED_OBS}
      aria-valuemin={0}
      aria-valuenow={countShown}
      className="h-[6px] overflow-hidden rounded-pill bg-surface-raised"
      role="progressbar"
    >
      {/* The fill's share of its track is a runtime number no class can name, so it goes through a variable. */}
      <View
        className="h-full w-[var(--settling-fill)] bg-warning"
        style={vars({ "--settling-fill": `${(countShown / TREND_SETTLED_OBS) * 100}%` })}
      />
    </View>
  );
}
