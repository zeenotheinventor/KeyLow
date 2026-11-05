import { describeMuscleTrainedName } from "@keylow/core/copy";

import type { TrainedMuscleRowProps } from "./types";

// The colour of each heat step from Rested (0) to Peak (5), written out so Tailwind sees them. Only the peak glows.
const heatSwatchClassNames = [
  "bg-heat-0",
  "bg-heat-1",
  "bg-heat-2",
  "bg-heat-3",
  "bg-heat-4",
  "bg-heat-5 shadow-[0_0_6px_0] shadow-heat-glow",
] as const;

/**
 * One muscle of the card: its name and its effective sets, with the swatch of its heat step when asked. The
 * row is named in words ("Hamstrings, 5.5 sets, Hot"), so the swatch's colour is never the only way to read
 * the heat, and a row without a swatch says it too.
 */
export function TrainedMuscleRow({ name, value, heatStep, hasSwatch }: TrainedMuscleRowProps) {
  return (
    <li
      aria-label={describeMuscleTrainedName({ name, value, heatStep })}
      className={`flex items-center gap-2 text-caption ${hasSwatch ? "min-h-[22px]" : ""}`}
    >
      {hasSwatch ? (
        <span
          aria-hidden
          className={`block h-[10px] w-[10px] shrink-0 rounded-[3px] ${heatSwatchClassNames[heatStep]}`}
        />
      ) : null}
      <span className="min-w-0 flex-1">{name}</span>
      <span className="tabular-nums text-text-secondary">{value}</span>
    </li>
  );
}
