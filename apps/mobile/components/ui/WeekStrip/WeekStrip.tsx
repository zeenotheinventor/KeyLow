import { WEEK_STRIP_DAY_NAMES, describeWeekStripName } from "@keylow/core/copy";
import { weekOf } from "@keylow/core/diary";
import { useRef } from "react";
import { View } from "react-native";

import { DayPill } from "./DayPill";

import type { WeekStripProps } from "./types";
import type { GestureResponderEvent } from "react-native";

// A swipe is a drag of at least this many points, at least twice as far across as it is down, so a
// scroll or a press that wanders does not turn the week.
const swipeDistance = 48;
const swipeDirectness = 2;

/**
 * The week on the diary: seven day pills, Monday to Sunday, each with a status row under it. It holds no
 * data. A swipe across it asks for the previous or the next week, and never for a week after today's.
 * The padding is the board's: 16 at the sides and 12 below.
 */
export function WeekStrip({
  days,
  selectedDate,
  today,
  onSelectDay,
  onWeekChange,
}: WeekStripProps) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const monday = days[0]?.localDate ?? today;
  const mondayOfThisWeek = weekOf(today)[0];
  const isThisWeek = monday === mondayOfThisWeek;
  const isAfterThisWeek = mondayOfThisWeek !== undefined && monday > mondayOfThisWeek;

  const rememberStart = ({ nativeEvent }: GestureResponderEvent) => {
    touchStart.current = { x: nativeEvent.pageX, y: nativeEvent.pageY };
  };

  const changeWeekOnSwipe = ({ nativeEvent }: GestureResponderEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (start === null) {
      return;
    }
    const across = nativeEvent.pageX - start.x;
    const down = nativeEvent.pageY - start.y;
    if (Math.abs(across) < swipeDistance || Math.abs(across) < Math.abs(down) * swipeDirectness) {
      return;
    }
    if (across > 0) {
      onWeekChange("previous");
    } else if (!isThisWeek && !isAfterThisWeek) {
      onWeekChange("next");
    }
  };

  return (
    <View
      aria-label={describeWeekStripName(monday, isThisWeek)}
      className="flex-row gap-[6px] px-4 pb-3"
      role="group"
      onTouchCancel={() => {
        touchStart.current = null;
      }}
      onTouchEnd={changeWeekOnSwipe}
      onTouchStart={rememberStart}
    >
      {days.map((day, index) => (
        <DayPill
          key={day.localDate}
          dateNumber={String(Number(day.localDate.slice(-2)))}
          dayName={WEEK_STRIP_DAY_NAMES[index] ?? ""}
          isFuture={day.localDate > today}
          state={{
            localDate: day.localDate,
            isToday: day.localDate === today,
            isSelected: day.localDate === selectedDate,
            isComplete: day.isComplete,
          }}
          onPress={() => {
            onSelectDay(day.localDate);
          }}
        />
      ))}
    </View>
  );
}
