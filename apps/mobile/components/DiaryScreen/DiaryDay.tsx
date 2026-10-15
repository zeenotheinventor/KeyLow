import { useDiaryDay, useDiaryWeek, useTargets } from "@keylow/api-client";
import {
  DIARY_LOAD_FAILED,
  DIARY_MORE_LABEL,
  NO_TARGET_BANNER,
  OFFLINE_BANNER,
} from "@keylow/core/copy";
import {
  describeDiaryTitle,
  formatClockTime,
  instantAtLocalTime,
  addDays,
  toLocalDate,
} from "@keylow/core/dates";
import {
  groupEntriesByHour,
  nextWeek,
  previousWeek,
  progressBars,
  sumEntries,
  weekOf,
} from "@keylow/core/diary";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { DiaryFrame } from "./DiaryFrame";
import { FoodLog } from "./FoodLog";
import { useIsOnline } from "../../lib/connectivity";
import { foodSearchHref } from "../../lib/navigation";
import { useNow } from "../../lib/useNow";
import { setViewedDay } from "../../lib/viewedDay";
import { Banner, ErrorState, MacroProgressStrip, Skeleton, WeekStrip } from "../ui";

import type { DiaryDayProps } from "./types";
import type { WeekStripWeekChange } from "../ui";

const NOON = 12;

const dayBefore = (localDate: string, timeZone: string): string =>
  toLocalDate(addDays(instantAtLocalTime(localDate, NOON, 0, timeZone), -1, timeZone), timeZone);

/**
 * One day of the diary and the week around it, once the profile's time zone is known: the header, the
 * week strip, the four progress bars, the banners and the hour-by-hour log. Nothing is read while
 * `isReadEnabled` is false, because the terms gate is up over the app.
 */
export function DiaryDay({ timeZone, isReadEnabled }: DiaryDayProps) {
  const router = useRouter();
  const isOnline = useIsOnline();
  const now = useNow();
  // null follows today. A chosen day is kept until another is chosen.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // null shows the week of the viewed day. A swipe moves the strip alone, leaving the viewed day as it is.
  const [shownWeekDate, setShownWeekDate] = useState<string | null>(null);

  const today = toLocalDate(now, timeZone);
  const viewedDate = selectedDate ?? today;
  const weekDays = weekOf(shownWeekDate ?? viewedDate);

  useEffect(() => {
    setViewedDay(viewedDate);
  }, [viewedDate]);

  const dayQuery = useDiaryDay(viewedDate, { enabled: isReadEnabled });
  const weekQuery = useDiaryWeek(weekDays[0] ?? viewedDate, { enabled: isReadEnabled });
  const targetsQuery = useTargets({ enabled: isReadEnabled });

  const day = dayQuery.data;
  const targets = targetsQuery.data;
  const isDayEmpty = day !== undefined && day.entries.length === 0;
  // Only an empty day offers to copy yesterday, so only then is yesterday read.
  const previousDayQuery = useDiaryDay(dayBefore(viewedDate, timeZone), {
    enabled: isReadEnabled && isDayEmpty,
  });

  const title = describeDiaryTitle(
    instantAtLocalTime(viewedDate, NOON, 0, timeZone),
    now,
    timeZone,
  );
  const isFailed = dayQuery.isError || targetsQuery.isError;
  const isLoading = !isFailed && (day === undefined || targets === undefined);

  function changeWeek(direction: WeekStripWeekChange) {
    const anchor = weekDays[0] ?? viewedDate;
    const week = direction === "previous" ? previousWeek(anchor) : nextWeek(anchor);
    setShownWeekDate(week[0] ?? anchor);
  }

  function renderContent() {
    if (isFailed) {
      return (
        <ErrorState
          body={DIARY_LOAD_FAILED.body}
          retry={{
            label: DIARY_LOAD_FAILED.action,
            onPress: () => {
              void Promise.all([
                dayQuery.isError ? dayQuery.refetch() : undefined,
                targetsQuery.isError ? targetsQuery.refetch() : undefined,
              ]);
            },
          }}
          title={DIARY_LOAD_FAILED.title}
        />
      );
    }
    if (day === undefined || targets === undefined) {
      return null;
    }

    return (
      <>
        <MacroProgressStrip
          bars={progressBars(sumEntries(day.entries), targets)}
          onPress={() => {
            router.push("/targets");
          }}
        />
        <View className="gap-2 px-4">
          {targets.kcal === null ? (
            <Banner
              action={{
                label: NO_TARGET_BANNER.action,
                onPress: () => {
                  router.push("/targets");
                },
              }}
              body={NO_TARGET_BANNER.body}
              title={NO_TARGET_BANNER.title}
              variant="info"
            />
          ) : null}
          {isOnline ? null : (
            <Banner body={OFFLINE_BANNER.body} title={OFFLINE_BANNER.title} variant="offline" />
          )}
        </View>
        <FoodLog
          key={viewedDate}
          currentHour={Number(formatClockTime(now, timeZone).slice(0, 2))}
          hours={groupEntriesByHour(day.entries, timeZone)}
          isComplete={day.dayLog?.is_complete ?? false}
          isOnline={isOnline}
          isToday={viewedDate === today}
          isYesterdayEmpty={
            previousDayQuery.isSuccess && previousDayQuery.data.entries.length === 0
          }
          timeZone={timeZone}
          onAddFood={(hour) => {
            if (isOnline) {
              router.push(foodSearchHref({ day: viewedDate, hour }));
            }
          }}
        />
      </>
    );
  }

  return (
    <DiaryFrame moreLabel={DIARY_MORE_LABEL} title={title}>
      {isLoading ? (
        <>
          {isOnline ? null : (
            <View className="px-4 pb-3">
              <Banner body={OFFLINE_BANNER.body} title={OFFLINE_BANNER.title} variant="offline" />
            </View>
          )}
          <Skeleton variant="diary" />
        </>
      ) : (
        <>
          <WeekStrip
            days={weekDays.map((localDate) => ({
              localDate,
              isComplete:
                weekQuery.data?.find((weekDay) => weekDay.localDate === localDate)?.dayLog
                  ?.is_complete ?? false,
            }))}
            selectedDate={viewedDate}
            today={today}
            onSelectDay={(localDate) => {
              setSelectedDate(localDate === today ? null : localDate);
              setShownWeekDate(null);
            }}
            onWeekChange={changeWeek}
          />
          {renderContent()}
        </>
      )}
    </DiaryFrame>
  );
}
