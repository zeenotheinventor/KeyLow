import { buildCalorieRingSvg } from "@keylow/core/widgets";
import { SvgWidget } from "react-native-android-widget";

import type { CalorieRingProps } from "./types";

// The sides of the two rings core draws, which is also how large the board shows them.
const RING_DIMENSIONS = { compact: 92, regular: 112 } as const;

export function CalorieRing({ ring, size, theme, dimension }: CalorieRingProps) {
  const drawn = dimension ?? RING_DIMENSIONS[size];

  return (
    <SvgWidget
      svg={buildCalorieRingSvg({ ring, size, palette: theme.palette })}
      style={{ width: drawn, height: drawn }}
    />
  );
}
