import {
  ROUTINE_DAY_CONTROLS,
  describeDayMenuName,
  describeDayNameFieldName,
  describeEditorDay,
} from "@keylow/core/copy";
import { Text as NativeText, View } from "react-native";

import { Card, IconButton, Input, PressableSurface, Text } from "../ui";

import type { RoutineDayCardProps } from "./types";

/**
 * One day of the routine editor, as the `routines · editor` board draws its header: the name over the
 * exercises and sets, the weekday as a chip, and the control that opens or closes the card. The weekday chip
 * opens the sheet that picks it. The body is where the day's exercises go (the next ticket); until then it
 * holds the day's name field and its menu, which no board draws. The words are core's (`describeEditorDay`).
 */
export function RoutineDayCard({
  name,
  weekday,
  exerciseCount,
  setCount,
  isOpen,
  onToggle,
  onOpenWeekday,
  onOpenMenu,
  onRename,
}: RoutineDayCardProps) {
  const copy = describeEditorDay({ name, weekday, exerciseCount, setCount, isOpen });

  return (
    <Card padding={0}>
      <View className="min-h-[56px] flex-row items-center gap-2 pl-3 pr-1">
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} variant="body-strong">
            {name}
          </Text>
          <Text tone="secondary" variant="caption">
            {copy.meta}
          </Text>
        </View>
        {/* The chip is 32 points, the board's, and reaches the 44 point touch target through its hit slop. */}
        <PressableSurface
          className="h-[32px] items-center justify-center rounded-pill border border-border bg-surface-raised px-3"
          hitSlop={{ top: 6, bottom: 6 }}
          label={copy.weekdayAccessibleName}
          onPress={onOpenWeekday}
        >
          {/* Capped as the kit's chips are, so the line stays inside the 32 point chip at large text. */}
          <NativeText
            className="text-[14px] font-normal leading-[24px] text-text-primary tabular-nums"
            maxFontSizeMultiplier={1.2}
            numberOfLines={1}
          >
            {copy.weekdayLabel}
          </NativeText>
        </PressableSurface>
        <IconButton
          icon={isOpen ? "ChevronUp" : "ChevronDown"}
          iconSize={18}
          label={copy.toggleAccessibleName}
          tone="secondary"
          variant="ghost"
          onPress={onToggle}
        />
      </View>
      {isOpen ? (
        <View className="flex-row items-end gap-2 border-t border-border p-3">
          <View className="min-w-0 flex-1">
            <Input
              accessibilityLabel={describeDayNameFieldName(name)}
              density="compact"
              label={ROUTINE_DAY_CONTROLS.dayNameLabel}
              value={name}
              onChangeText={onRename}
            />
          </View>
          <IconButton
            icon="Ellipsis"
            label={describeDayMenuName(name)}
            tone="secondary"
            variant="ghost"
            onPress={onOpenMenu}
          />
        </View>
      ) : null}
    </Card>
  );
}
