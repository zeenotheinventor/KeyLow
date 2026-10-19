import {
  ADD_EXERCISE,
  describeExerciseRowName,
  EQUIPMENT_OPTIONS,
  MUSCLE_NAMES,
} from "@keylow/core/copy";
import { Text as NativeText, View } from "react-native";

import { Icon, PressableSurface, Text, useGroupedRowPosition } from "../ui";

import type { ExerciseRowProps } from "./types";

const MAX_MUSCLE_CHIPS = 2;

/**
 * An exercise of the Add exercise sheet as the `session · add-exercise` board draws it: the name with a
 * Custom pill for the person's own, then the equipment and up to two muscle chips, the primary solid and the
 * secondary quiet, and the add mark. The whole row is one button named for the exercise, its equipment and
 * Custom, so the board's separate add button is this row's mark and the touch target is the row.
 */
export function ExerciseRow({
  name,
  equipment,
  isCustom,
  primaryMuscles,
  secondaryMuscles,
  onPress,
}: ExerciseRowProps) {
  const { isFirst } = useGroupedRowPosition();
  const chips = [
    ...primaryMuscles.map((muscle) => ({ muscle, isPrimary: true })),
    ...secondaryMuscles.map((muscle) => ({ muscle, isPrimary: false })),
  ].slice(0, MAX_MUSCLE_CHIPS);

  return (
    <PressableSurface
      className={`min-h-16 flex-row items-center gap-2 py-2 pl-3 pr-1 ${isFirst ? "" : "border-t border-border"}`}
      label={describeExerciseRowName({ name, equipment, isCustom })}
      onPress={onPress}
    >
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Text className="shrink" variant="body">
            {name}
          </Text>
          {isCustom ? (
            // The board's pill: raised fill, hairline, 12 points semibold, 20 high. The kit's Badge is
            // sheet filled and medium weight, so it does not match.
            <View className="h-5 justify-center rounded-pill border border-border bg-surface-raised px-2">
              <NativeText className="text-caption font-semibold tabular-nums text-text-secondary">
                {ADD_EXERCISE.customPill}
              </NativeText>
            </View>
          ) : null}
        </View>
        <View className="flex-row flex-wrap items-center gap-[6px]">
          <Text tone="muted" variant="caption">
            {chips.length === 0
              ? EQUIPMENT_OPTIONS[equipment].label
              : `${EQUIPMENT_OPTIONS[equipment].label} ·`}
          </Text>
          {chips.map(({ muscle, isPrimary }) => (
            <View
              className={`h-[22px] justify-center rounded-pill border px-2 ${isPrimary ? "border-border-strong bg-surface-sheet" : "border-border"}`}
              key={muscle}
            >
              {isPrimary ? (
                // 12 points semibold, which the kit's text styles have none of (caption is medium).
                <NativeText className="text-caption font-semibold tabular-nums text-text-primary">
                  {MUSCLE_NAMES[muscle]}
                </NativeText>
              ) : (
                <Text tone="secondary" variant="caption">
                  {MUSCLE_NAMES[muscle]}
                </Text>
              )}
            </View>
          ))}
        </View>
      </View>
      <View aria-hidden className="h-touch-target w-touch-target items-center justify-center">
        <Icon name="Plus" tone="secondary" />
      </View>
    </PressableSurface>
  );
}
