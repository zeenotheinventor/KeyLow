import { View } from "react-native";

import { Icon } from "../../Icon";
import { PressableSurface } from "../../PressableSurface";
import { Text } from "../../Text";

import type { RoutineDayRowProps } from "./types";

/**
 * One day of a routine inside an `AssistantActionCard`: the day's name, its summary as a caption and a
 * chevron that turns over when the day is open. Pressing it shows or hides the day's exercises in place,
 * each as a name over its detail. Every word is the caller's and is drawn exactly as given. The row is the
 * card's own and is not part of the kit's public surface.
 */
export function RoutineDayRow({ day, isOpen, onPress }: RoutineDayRowProps) {
  return (
    <View className="border-t border-border">
      <PressableSurface
        className="min-h-control-lg flex-row items-center gap-3 px-3 py-[6px]"
        expanded={isOpen}
        label={`${day.name}, ${day.summary}`}
        onPress={onPress}
      >
        <View className="min-w-0 flex-1">
          <Text variant="body-strong">{day.name}</Text>
          <Text tone="secondary" variant="caption">
            {day.summary}
          </Text>
        </View>
        {/* The chevron turning over is the up glyph, as the routine editor's day card draws it. */}
        <Icon name={isOpen ? "ChevronUp" : "ChevronDown"} size="sm" tone="muted" />
      </PressableSurface>
      {isOpen ? (
        <View className="gap-2 px-3 pb-3">
          {day.exercises.map((exercise, index) => (
            <View key={`${index}-${exercise.name}`}>
              <Text>{exercise.name}</Text>
              <Text tone="muted" variant="caption">
                {exercise.detail}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
