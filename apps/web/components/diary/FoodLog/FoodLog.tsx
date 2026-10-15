import { useEffect, useRef } from "react";

import { EmptyDayCard } from "../EmptyDayCard";
import { HourFoods } from "../HourFoods";

import type { FoodLogProps } from "./types";

import { DayCompleteToggle } from "@/components/ui/DayCompleteToggle";
import { HourRow } from "@/components/ui/HourRow";

/**
 * The hour-by-hour log: all 24 hours from 00:00, each an `HourRow` with a plus to add food at that hour
 * and that hour's foods, and the Mark day complete switch after 23:00. The hours sit directly in one container with nothing between them,
 * because each draws its own piece of the guide line. On a day with nothing logged the Nothing logged
 * yet card sits above 00:00. When it first appears the page scrolls once, so the first food's hour, or
 * the current hour when the day is empty, is near the top. Key it by the day, so a new day scrolls again,
 * and so the switch is a new one (it belongs to the day) that plays no moment for a day that is already complete.
 */
export function FoodLog({
  hours,
  timeZone,
  currentHour,
  isToday,
  isComplete,
  isYesterdayEmpty,
  isCopying,
  hasCopyFailed,
  onAddFood,
  onEdit,
  onDelete,
  onCopyYesterday,
  onCompleteChange,
}: FoodLogProps) {
  const startHourRef = useRef<HTMLDivElement>(null);
  const isEmpty = hours.every((group) => group.entries.length === 0);
  const startHour = hours.find((group) => group.entries.length > 0)?.hour ?? currentHour;

  useEffect(() => {
    startHourRef.current?.scrollIntoView({ block: "start" });
  }, []);

  return (
    <div className="flex flex-col">
      {isEmpty && (
        <EmptyDayCard
          isYesterdayEmpty={isYesterdayEmpty}
          isCopying={isCopying}
          hasCopyFailed={hasCopyFailed}
          onCopyYesterday={onCopyYesterday}
        />
      )}
      <div>
        {hours.map((group) => (
          <HourRow
            key={group.hour}
            ref={group.hour === startHour ? startHourRef : undefined}
            hour={group.hour}
            label={group.label}
            foodCount={group.entries.length}
            isNow={isToday && group.hour === currentHour}
            onAdd={onAddFood}
          >
            <HourFoods
              label={group.label}
              entries={group.entries}
              timeZone={timeZone}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </HourRow>
        ))}
      </div>
      <div className="pl-8 pt-3">
        <DayCompleteToggle
          complete={isComplete}
          className="md:max-w-[520px]"
          onChange={onCompleteChange}
        />
      </div>
    </div>
  );
}
