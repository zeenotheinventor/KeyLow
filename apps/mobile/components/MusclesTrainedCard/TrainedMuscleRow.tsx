import { describeMuscleTrainedName } from "@keylow/core/copy";
import { View } from "react-native";

import { Text } from "../ui";

import type { TrainedMuscleRowProps } from "./types";

// The swatches are the heat step's colours, from rested up to peak, as the figures are filled, and only the
// peak glows, as the legend's does. The classes are written out so Tailwind sees them.
const heatSwatchClassNames = [
  "bg-heat-0",
  "bg-heat-1",
  "bg-heat-2",
  "bg-heat-3",
  "bg-heat-4",
  "bg-heat-5 shadow-[0_0_8px_0] shadow-heat-glow",
];

/**
 * One muscle of the Muscles trained card: its heat step as a swatch, its name and its effective sets. The
 * row is one element named in words ("Hamstrings, 5.5 sets, Hot"), so the swatch's colour is never the only
 * way to read the heat.
 */
export function TrainedMuscleRow({ name, value, heatStep }: TrainedMuscleRowProps) {
  return (
    <View
      accessible
      aria-label={describeMuscleTrainedName({ name, value, heatStep })}
      className="min-h-[22px] flex-row items-center gap-2"
      role="listitem"
    >
      <View
        aria-hidden
        className={`h-[10px] w-[10px] rounded-[3px] ${heatSwatchClassNames[heatStep]}`}
      />
      <Text className="flex-1" variant="caption">
        {name}
      </Text>
      <Text tone="secondary" variant="caption">
        {value}
      </Text>
    </View>
  );
}
