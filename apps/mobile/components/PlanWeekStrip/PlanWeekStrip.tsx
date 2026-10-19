import { TRAIN_HOME, describeTrainWeekCaption, describeTrainWeekDay } from "@keylow/core/copy";
import { weekCaption } from "@keylow/core/training";
import { View } from "react-native";

import { Card, Text } from "../ui";
import { WeekDay } from "./WeekDay";
import { weekDayLookOf } from "./weekDayLook";

import type { PlanWeekStripProps } from "./types";

/**
 * The Train home's "This week" card, as the `train · today` board draws it: the caption with the week's range
 * and how many of the routine's days are done, and the seven days from Monday, each with its mark and the name
 * of what it holds. The days only inform, so none is pressable. Every word is core's. The diary's `WeekStrip`
 * does not fit here: it carries day totals and swipes between weeks.
 */
export function PlanWeekStrip({ week, weekStart }: PlanWeekStripProps) {
  const hasRoutine = week.routineDayCount > 0;

  return (
    <Card aria-label={TRAIN_HOME.weekSectionName} padding={3} role="region">
      <View className="gap-2">
        <View className="flex-row items-baseline justify-between">
          <Text role="heading" variant="body-strong">
            {TRAIN_HOME.weekSectionName}
          </Text>
          <Text className="min-w-0 shrink" tone="secondary" variant="caption">
            {describeTrainWeekCaption(weekStart, weekCaption(week))}
          </Text>
        </View>
        <View className="flex-row gap-1">
          {week.days.map((day) => {
            const copy = describeTrainWeekDay(day, hasRoutine);

            return (
              <WeekDay
                key={day.date}
                accessibleName={copy.accessibleName}
                isToday={day.isToday}
                label={copy.label}
                look={weekDayLookOf(day, hasRoutine)}
                weekday={copy.weekday}
              />
            );
          })}
        </View>
      </View>
    </Card>
  );
}
