import { TRAIN_HOME } from "@keylow/core/copy";
import { vars } from "nativewind";
import { View } from "react-native";

import type { SetsProgressBarProps } from "./types";

/**
 * The sets logged against the sets planned, as the in progress board draws it: a 6 point track on the
 * raised surface with an accent fill, 8 points under the line above it.
 */
export function SetsProgressBar({ setsLogged, setsPlanned }: SetsProgressBarProps) {
  const setsShown = Math.min(setsLogged, setsPlanned);

  return (
    <View
      accessible
      aria-label={TRAIN_HOME.setsProgressName}
      aria-valuemax={setsPlanned}
      aria-valuemin={0}
      aria-valuenow={setsShown}
      className="mt-2 h-[6px] overflow-hidden rounded-pill bg-surface-raised"
      role="progressbar"
    >
      {/* The fill's share of its track is a runtime number no class can name, so it goes through a variable. */}
      <View
        className="h-full w-[var(--sets-fill)] bg-accent"
        style={vars({ "--sets-fill": `${(setsShown / Math.max(setsPlanned, 1)) * 100}%` })}
      />
    </View>
  );
}
