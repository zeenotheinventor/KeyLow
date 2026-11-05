import { CUSTOM_EXERCISE_ROLES, MUSCLE_NAMES, describeMuscleRowNames } from "@keylow/core/copy";
import { MUSCLE_ROLES } from "@keylow/core/training";
import { View } from "react-native";

import { IconButton, SegmentedControl, Text, useGroupedRowPosition } from "../../ui";

import type { CustomExerciseMuscleRowProps } from "./types";

const ROLE_OPTIONS = MUSCLE_ROLES.map((role) => ({
  value: role,
  label: CUSTOM_EXERCISE_ROLES[role].label,
}));

/**
 * One muscle of the New exercise form, as the `session · custom-exercise` board draws it: the muscle's name
 * over what its role counts for, the Primary / Second / Assist control and a button to remove it. The help
 * line follows the chosen role, so the weight is never only a colour. A row in a `GroupedList` has the
 * hairline above it, except the first.
 */
export function CustomExerciseMuscleRow({
  muscle,
  role,
  onChangeRole,
  onRemove,
}: CustomExerciseMuscleRowProps) {
  const { isFirst } = useGroupedRowPosition();
  const name = MUSCLE_NAMES[muscle];
  const names = describeMuscleRowNames(name);

  return (
    <View
      className={`min-h-[60px] flex-row items-center gap-3 py-2 pl-3 pr-1 ${isFirst ? "" : "border-t border-border"}`}
    >
      <View className="flex-1 gap-0.5">
        <Text variant="body">{name}</Text>
        <Text tone="secondary" variant="caption">
          {CUSTOM_EXERCISE_ROLES[role].help}
        </Text>
      </View>
      <View className="w-[156px]">
        <SegmentedControl
          label={names.role}
          options={ROLE_OPTIONS}
          size="sm"
          value={role}
          onChange={onChangeRole}
        />
      </View>
      <IconButton icon="X" label={names.remove} variant="ghost" onPress={onRemove} />
    </View>
  );
}
