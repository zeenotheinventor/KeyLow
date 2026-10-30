import { TRAIN_HOME } from "@keylow/core/copy";

import type { SetsProgressBarProps } from "./types";

import { vars } from "@/lib/vars";

/**
 * The sets logged against the sets planned, as the in progress board draws it: a 6 px track on the raised
 * surface with an accent fill, 8 px under the line above it.
 */
export function SetsProgressBar({ setsLogged, setsPlanned }: SetsProgressBarProps) {
  const setsShown = Math.min(setsLogged, setsPlanned);

  return (
    <div
      role="meter"
      aria-label={TRAIN_HOME.setsProgressName}
      aria-valuemin={0}
      aria-valuemax={setsPlanned}
      aria-valuenow={setsShown}
      className="mt-2 h-1.5 overflow-hidden rounded-pill bg-surface-raised"
    >
      {/* The fill's share of its track is a runtime number no class can name, so it goes through a variable. */}
      <div
        className="h-full w-[var(--sets-fill)] bg-accent"
        style={vars({ "--sets-fill": `${(setsShown / Math.max(setsPlanned, 1)) * 100}%` })}
      />
    </div>
  );
}
