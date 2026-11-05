import { StatTile } from "../StatTile";

import type { HeatTileProps } from "./types";

// One swatch for each heat step, written out so Tailwind sees the classes.
const swatchClassNames = [
  "bg-heat-0",
  "bg-heat-1",
  "bg-heat-2",
  "bg-heat-3",
  "bg-heat-4",
  "bg-heat-5",
] as const;

/** The Heat tile: the percentage, with the step's name after a swatch of its colour. */
export function HeatTile({ heat, step }: HeatTileProps) {
  return (
    <StatTile
      caption={heat.stepName}
      label={heat.label}
      swatchClassName={swatchClassNames[step] ?? swatchClassNames[0]}
      value={heat.value}
    />
  );
}
