import { describeExerciseFieldNames, describeRemoveExercise } from "@keylow/core/copy";
import { View } from "react-native";

import { IconButton, NumericInput, Text } from "../ui";

import type { RoutineExerciseRowProps } from "./types";

/**
 * One exercise of a day in the routine editor, as the `routines · editor` board draws it: the name, then
 * the sets, the reps and the RIR in fields 36 points high, in a row of 48 under a hairline. The columns
 * (48, 84 and 48 points, 6 between) are the board's and line up with the column heads over the rows. The
 * board draws no way to take an exercise out, so a remove control ends the row (KEY-450 proposes it). Each
 * field is named with its exercise, because the column heads are not read.
 */
export function RoutineExerciseRow({
  name,
  setsText,
  repsText,
  rirText,
  onChangeField,
  onRemove,
}: RoutineExerciseRowProps) {
  const fieldNames = describeExerciseFieldNames(name);

  return (
    <View className="min-h-[48px] flex-row items-center gap-[6px] border-t border-border px-3">
      <Text className="min-w-0 flex-1" numberOfLines={1} variant="body">
        {name}
      </Text>
      <View className="w-[48px]">
        <NumericInput
          align="center"
          keyboardType="number-pad"
          label={fieldNames.sets}
          labelHidden
          placeholder=""
          size="cell"
          strongValue
          value={setsText}
          onChangeText={(text) => {
            onChangeField("sets", text);
          }}
        />
      </View>
      <View className="w-[84px]">
        <NumericInput
          align="center"
          keyboardType="numbers-and-punctuation"
          label={fieldNames.reps}
          labelHidden
          placeholder=""
          size="cell"
          strongValue
          value={repsText}
          onChangeText={(text) => {
            onChangeField("reps", text);
          }}
        />
      </View>
      <View className="w-[48px]">
        <NumericInput
          align="center"
          keyboardType="number-pad"
          label={fieldNames.rir}
          labelHidden
          placeholder=""
          size="cell"
          strongValue
          value={rirText}
          onChangeText={(text) => {
            onChangeField("rir", text);
          }}
        />
      </View>
      <IconButton
        icon="X"
        iconSize={18}
        label={describeRemoveExercise(name)}
        size="sm"
        tone="secondary"
        variant="ghost"
        onPress={onRemove}
      />
    </View>
  );
}
