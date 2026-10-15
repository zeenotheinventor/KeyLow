import { WEEK_STRIP_DAY_NAMES, describeWeekStripName } from "@keylow/core/copy";
import { weekOf } from "@keylow/core/diary";
import { useRef } from "react";

import { DayPill } from "./DayPill";

import type { WeekStripProps } from "./types";
import type { TouchEvent } from "react";

import { cn } from "@/lib/utils";

// A swipe is a drag of at least this many pixels, at least twice as far across as it is down, so a
// scroll or a touch that wanders does not turn the week.
const swipeDistance = 48;
const swipeDirectness = 2;

// Seven columns that share the width on a phone, and seven of 56 px, left aligned, on a wide screen.
const stripClassName =
  "grid touch-pan-y grid-cols-[repeat(7,minmax(0,1fr))] gap-2 md:grid-cols-[repeat(7,56px)]";

/**
 * The week on the diary: seven day pills, Monday to Sunday, each with a status row under it. It holds no
 * data. On a touch screen a swipe across it asks for the previous or the next week, and never for a week
 * after today's. On a wide screen it draws no week control: the screen can add one, because the strip
 * reports the change through `onWeekChange`.
 */
export function WeekStrip({
  days,
  selectedDate,
  today,
  onSelectDay,
  onWeekChange,
  className,
}: WeekStripProps) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const monday = days[0]?.localDate ?? today;
  const mondayOfThisWeek = weekOf(today)[0] ?? today;
  const canShowNextWeek = monday < mondayOfThisWeek;

  const rememberStart = ({ touches }: TouchEvent) => {
    const touch = touches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const changeWeekOnSwipe = ({ changedTouches }: TouchEvent) => {
    const start = touchStart.current;
    const end = changedTouches[0];
    touchStart.current = null;
    if (!start || !end) {
      return;
    }
    const across = end.clientX - start.x;
    const down = end.clientY - start.y;
    if (Math.abs(across) < swipeDistance || Math.abs(across) < Math.abs(down) * swipeDirectness) {
      return;
    }
    if (across > 0) {
      onWeekChange("previous");
    } else if (canShowNextWeek) {
      onWeekChange("next");
    }
  };

  return (
    <div
      role="group"
      aria-label={describeWeekStripName(monday, monday === mondayOfThisWeek)}
      className={cn(stripClassName, className)}
      onTouchStart={rememberStart}
      onTouchEnd={changeWeekOnSwipe}
      onTouchCancel={() => {
        touchStart.current = null;
      }}
    >
      {days.map((day, index) => (
        <DayPill
          key={day.localDate}
          localDate={day.localDate}
          dateNumber={String(Number(day.localDate.slice(-2)))}
          dayName={WEEK_STRIP_DAY_NAMES[index] ?? ""}
          isToday={day.localDate === today}
          isSelected={day.localDate === selectedDate}
          isComplete={day.isComplete}
          isFuture={day.localDate > today}
          onPress={() => {
            onSelectDay(day.localDate);
          }}
        />
      ))}
    </div>
  );
}
