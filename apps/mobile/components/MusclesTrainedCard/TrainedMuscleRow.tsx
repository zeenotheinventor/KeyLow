import { describeMuscleTrainedName } from "@keylow/core/copy";
import { View } from "react-native";

import { heatSwatchClassNames } from "../HeatSwatch";
import { Text } from "../ui";

import type { TrainedMuscleRowProps } from "./types";

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
