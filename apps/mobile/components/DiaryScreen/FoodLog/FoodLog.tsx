import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
 * empty, is near the top. A link can ask for another hour (`showHour`), which it scrolls to the same way,
 * also when it has already scrolled, once for each request. Key it by the day, so a new day scrolls
 * again, and so the day complete switch, which belongs to the day, is a new one for it.
 */
export function FoodLog({
  hours,
  timeZone,
  currentHour,
  isToday,
  isOnline,
  isComplete,
  isYesterdayEmpty,
  isCopying,
  showHour,
  onHourShown,
  onAddFood,
  onDeleteEntry,
  onCopyYesterday,
  onCompleteChange,
}: FoodLogProps) {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const listTop = useRef<number | null>(null);
  const hourTops = useRef(new Map<number, number>());
  const hasScrolled = useRef(false);
  // The switch is made new after each save that failed, so a press that was never answered is forgotten.
  const [failedSaves, setFailedSaves] = useState(0);

  const isEmpty = hours.every((group) => group.entries.length === 0);
  const startHour = hours.find((group) => group.entries.length > 0)?.hour ?? currentHour;

  // A requested hour comes first, and is scrolled to whenever it is asked for. Without one the log scrolls
  // once, to the first food's hour. The first scroll of either kind is the log's one scroll to a start.
  const scrollToWantedHour = useCallback(() => {
    const wantedHour = showHour ?? (hasScrolled.current ? undefined : startHour);
    const top = wantedHour === undefined ? undefined : hourTops.current.get(wantedHour);
    if (top === undefined || listTop.current === null || hourTops.current.size < HOURS_PER_DAY) {
      return;
    }

    hasScrolled.current = true;
    scrollViewRef.current?.scrollTo({
      y: Math.max(0, listTop.current + top - SCROLL_MARGIN),
      animated: false,
    });
    if (showHour !== undefined) {
      onHourShown?.();
    }
  }, [showHour, startHour, onHourShown]);

  // A request that arrives when the hours are already measured has no layout event to wait for.
  useEffect(() => {
    if (showHour !== undefined) {
      scrollToWantedHour();
    }
  }, [showHour, scrollToWantedHour]);

  return (
    <ScrollView ref={scrollViewRef} className="flex-1" contentContainerClassName="px-4 pb-6 pt-2">
      {isEmpty ? (
        <EmptyDayCard
          isCopying={isCopying}
          isOnline={isOnline}
          isYesterdayEmpty={isYesterdayEmpty}
          onCopyYesterday={onCopyYesterday}
        />
      ) : null}
      <View
        role="list"
        onLayout={(event) => {
          listTop.current = event.nativeEvent.layout.y;
          scrollToWantedHour();
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
              scrollToWantedHour();
            }}
          >
            {group.entries.map((entry) => (
              <FoodRow
                key={entry.id}
                {...entryRowProps(entry, timeZone)}
                layout="diary"
                // A change needs a connection, so a row offers no delete offline.
                onDelete={
                  isOnline
                    ? () => {
                        onDeleteEntry(entry);
                      }
                    : undefined
                }
                // An entry can be read offline, where the entry screen turns its changes off.
                onPress={() => {
                  router.push(`/entry/${entry.id}`);
                }}
              />
            ))}
          </HourRow>
        ))}
      </View>
      <DayCompleteToggle
        key={failedSaves}
        className="mt-4"
        complete={isComplete}
        disabled={!isOnline}
        onChange={(complete) => {
          onCompleteChange(complete).catch(() => {
            setFailedSaves((count) => count + 1);
          });
        }}
      />
    </ScrollView>
  );
}
