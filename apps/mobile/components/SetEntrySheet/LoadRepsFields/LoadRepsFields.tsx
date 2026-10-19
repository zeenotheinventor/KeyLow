import { SET_ENTRY, describeLoadFieldLabel } from "@keylow/core/copy";
import { View } from "react-native";

import { NumericInput } from "../../ui";

import type { LoadRepsFieldsProps } from "./types";

/**
 * The load and the reps, side by side as 32 point numbers, as the set entry and the edit set boards draw
 * them. The load is typed and shown in the person's unit.
 */
export function LoadRepsFields({
  unit,
  load,
  reps,
  loadError,
  repsError,
  onChangeLoad,
  onChangeReps,
}: LoadRepsFieldsProps) {
  return (
    <View className="flex-row gap-3">
      <View className="flex-1">
        <NumericInput
          align="center"
          error={loadError}
          label={describeLoadFieldLabel(unit)}
          size="display"
          value={load}
          onChangeText={onChangeLoad}
        />
      </View>
      <View className="flex-1">
        <NumericInput
          align="center"
          error={repsError}
          keyboardType="number-pad"
          label={SET_ENTRY.repsLabel}
          size="display"
          value={reps}
          onChangeText={onChangeReps}
        />
      </View>
    </View>
  );
}
