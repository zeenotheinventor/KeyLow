import {
  TRAIN_HOME,
  describeOpenSessionName,
  describeTrainWeekCaption,
  describeTrainWeekDay,
} from "@keylow/core/copy";
import { latestFinishedSession, weekCaption } from "@keylow/core/training";
import { View } from "react-native";

import { Card, Text } from "../ui";
import { WeekDay } from "./WeekDay";
import { weekDayLookOf } from "./weekDayLook";

import type { PlanWeekStripProps } from "./types";

/**
 * The Train home's "This week" card, as the `train · today` board draws it: the caption with the week's range
 * and how many of the routine's days are done, and the seven days from Monday, each with its mark and the name
 * of what it holds. A logged day (a routine day done, or a session that is no part of the plan) opens its
 * session when the strip is given what to do (`onViewSession`); a day made up later in the week opens the
 * session that made it up (KEY-531); the other days only inform. Every word is
 * core's. The diary's `WeekStrip` does not fit here: it carries day totals and swipes between weeks.
 */
export function PlanWeekStrip({ week, weekStart, onViewSession }: PlanWeekStripProps) {
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
            const isLogged = day.status === "logged" || day.status === "extra";
            // A day made up later opens the session that made it up, since none was logged on its own date.
            const sessionToView =
              day.madeUpBy ?? (isLogged ? latestFinishedSession(day.sessions) : null);
            const openSession =
              onViewSession === undefined || sessionToView === null
                ? undefined
                : () => {
                    onViewSession(sessionToView.id);
                  };

            return (
              <WeekDay
                key={day.date}
                accessibleName={
                  openSession === undefined
                    ? copy.accessibleName
                    : describeOpenSessionName(copy.accessibleName)
                }
                isToday={day.isToday}
                label={copy.label}
                look={weekDayLookOf(day, hasRoutine)}
                weekday={copy.weekday}
                onPress={openSession}
              />
            );
          })}
        </View>
      </View>
    </Card>
  );
}
