import { useRef } from "react";
import { ScrollView, View } from "react-native";

import { DayCompleteToggle, FoodRow, HourRow } from "../../ui";
import { EmptyDayCard } from "../EmptyDayCard";
import { entryRowProps } from "../entryRowProps";

import type { FoodLogProps } from "./types";

// The board puts the hour it scrolls to 8 points under the top of the log, which is the log's own padding.
const SCROLL_MARGIN = 8;
const HOURS_PER_DAY = 24;

/**
 * The hour-by-hour log: all 24 hours from 00:00, each an `HourRow` with that hour's foods as diary rows,
 * and the Mark day complete toggle after 23:00. The rows sit directly in the list with no gap, no margin
 * and no separator between them, because each row draws its own piece of the guide line and a gap would
 * break it. On a day with nothing logged the Nothing logged yet card sits above 00:00. When the hours have
 * all been measured the log scrolls once so the first food's hour, or the current hour when the day is
 * empty, is near the top. Key it by the day, so a new day scrolls again.
 */
export function FoodLog({
  hours,
  timeZone,
  currentHour,
  isToday,
  isOnline,
  isComplete,
  isYesterdayEmpty,
  onAddFood,
}: FoodLogProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const listTop = useRef<number | null>(null);
  const hourTops = useRef(new Map<number, number>());
  const hasScrolled = useRef(false);

  const isEmpty = hours.every((group) => group.entries.length === 0);
  const startHour = hours.find((group) => group.entries.length > 0)?.hour ?? currentHour;

  function scrollToStartHour() {
    const top = hourTops.current.get(startHour);
    if (
      hasScrolled.current ||
      listTop.current === null ||
      top === undefined ||
      hourTops.current.size < HOURS_PER_DAY
    ) {
      return;
    }

    hasScrolled.current = true;
    scrollViewRef.current?.scrollTo({
      y: Math.max(0, listTop.current + top - SCROLL_MARGIN),
      animated: false,
    });
  }

  return (
    <ScrollView ref={scrollViewRef} className="flex-1" contentContainerClassName="px-4 pb-6 pt-2">
      {isEmpty ? <EmptyDayCard isYesterdayEmpty={isYesterdayEmpty} /> : null}
      <View
        role="list"
        onLayout={(event) => {
          listTop.current = event.nativeEvent.layout.y;
          scrollToStartHour();
        }}
      >
        {hours.map((group) => (
          <HourRow
            key={group.hour}
            addDisabled={!isOnline}
            hour={group.hour}
            isNow={isToday && group.hour === currentHour}
            label={group.label}
            onAdd={onAddFood}
            onLayout={(event) => {
              hourTops.current.set(group.hour, event.nativeEvent.layout.y);
              scrollToStartHour();
            }}
          >
            {group.entries.map((entry) => (
              // Tapping a food is wired with the entry screen, which has no route yet.
              <FoodRow
                key={entry.id}
                {...entryRowProps(entry, timeZone)}
                layout="diary"
                onPress={() => undefined}
              />
            ))}
          </HourRow>
        ))}
      </View>
      {/* Pressing the toggle is wired with the food log interactions. */}
      <DayCompleteToggle className="mt-4" complete={isComplete} disabled={!isOnline} />
    </ScrollView>
  );
}
