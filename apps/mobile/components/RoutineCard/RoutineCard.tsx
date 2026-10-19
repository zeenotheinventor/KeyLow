import { ROUTINES_SCREEN, describeActiveRoutine } from "@keylow/core/copy";
import { View } from "react-native";

import { Badge, Card, PressableSurface, Text } from "../ui";

import type { RoutineCardProps } from "./types";

// The classes are written out so Tailwind sees them. A day with a routine day on it sits on a raised tile.
const dayTileClassName = {
  planned: "bg-surface-raised",
  rest: "bg-transparent",
} as const;

/**
 * The active routine as the `routines · list` board draws it: the name beside the Active badge, the days,
 * sets and date it plans from, and the week as seven tiles, each with its weekday and the routine day on
 * it or Rest. The card has the accent border. It is a button only when `onPress` opens the editor: the
 * words are core's (`describeActiveRoutine`), and the week is hidden from a screen reader, because the
 * card's name already says which days are trained.
 */
export function RoutineCard({ onPress, ...routine }: RoutineCardProps) {
  const copy = describeActiveRoutine(routine);

  const contents = (
    <>
      <View className="flex-row items-center justify-between gap-2">
        <Text className="min-w-0 shrink" role="heading" variant="h2">
          {routine.name}
        </Text>
        <Badge dot tone="accent">
          {ROUTINES_SCREEN.activeLabel}
        </Badge>
      </View>
      <Text className="tabular-nums" tone="secondary" variant="caption">
        {copy.meta}
      </Text>
      <View aria-hidden className="mt-1 flex-row gap-1">
        {copy.week.map(({ weekday, label }, weekdayIndex) => {
          const isRest = !routine.days.some((day) => day.weekday === weekdayIndex);

          return (
            <View
              className={`min-w-0 flex-1 items-center gap-1 rounded-small py-[6px] ${dayTileClassName[isRest ? "rest" : "planned"]}`}
              key={weekday}
            >
              <Text tone="muted" variant="caption">
                {weekday}
              </Text>
              <Text
                className="font-semibold"
                numberOfLines={1}
                tone={isRest ? "muted" : "primary"}
                variant="caption"
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </>
  );

  return (
    <Card border="accent" padding={0}>
      {onPress === undefined ? (
        <View accessible aria-label={copy.readName} className="gap-2 p-4">
          {contents}
        </View>
      ) : (
        <PressableSurface className="gap-2 p-4" label={copy.accessibleName} onPress={onPress}>
          {contents}
        </PressableSurface>
      )}
    </Card>
  );
}
