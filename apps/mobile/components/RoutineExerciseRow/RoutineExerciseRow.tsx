import { describeExerciseFieldNames, describeExerciseMenuName } from "@keylow/core/copy";
import { View } from "react-native";

import { FieldError, IconButton, NumericInput, Text } from "../ui";

import type { RoutineExerciseRowProps } from "./types";

/**
 * One exercise of a day in the routine editor, as the `routines · editor` board draws it: the name, then
 * the sets, the reps and the RIR in fields 36 points high, in a row of 48 under a hairline. The columns
 * (48, 84 and 48 points, 6 between) are the board's and line up with the column heads over the rows. The
 * board draws no way to take an exercise out or to move it, so a menu button ends the row (KEY-450 and
 * KEY-454 propose it): its menu holds Move up, Move down and Remove. Each field is named with its exercise,
 * because the column heads are not read. A field with a problem takes the danger border, and one line under
 * the row says them all, as the `routines · invalid` board draws it.
 */
export function RoutineExerciseRow({
  name,
  setsText,
  repsText,
  rirText,
  marks,
  rowRef,
  onChangeField,
  onOpenMenu,
}: RoutineExerciseRowProps) {
  const fieldNames = describeExerciseFieldNames(name);

  return (
    <View ref={rowRef}>
      <View className="min-h-[48px] flex-row items-center gap-[6px] border-t border-border px-3">
        <Text className="min-w-0 flex-1" numberOfLines={1} variant="body">
          {name}
        </Text>
        <View className="w-[48px]">
          <NumericInput
            align="center"
            keyboardType="number-pad"
            error={marks?.sets}
            errorShownElsewhere
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
            error={marks?.reps}
            errorShownElsewhere
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
            error={marks?.rir}
            errorShownElsewhere
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
          icon="Ellipsis"
          iconSize={18}
          label={describeExerciseMenuName(name)}
          size="sm"
          tone="secondary"
          variant="ghost"
          onPress={onOpenMenu}
        />
      </View>
      {marks === undefined ? null : <FieldError className="px-3 pb-2">{marks.line}</FieldError>}
    </View>
  );
}
