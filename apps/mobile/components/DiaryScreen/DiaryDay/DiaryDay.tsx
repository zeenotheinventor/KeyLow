import { useDiaryDay, useDiaryWeek, useSetDayComplete, useTargets } from "@keylow/api-client";
import { DIARY_LOAD_FAILED, DIARY_MORE_LABEL } from "@keylow/core/copy";
import {
  clockHourOf,
  describeDiaryTitle,
  instantAtLocalTime,
  previousCalendarDay,
  toLocalDate,
} from "@keylow/core/dates";
import { nextWeek, previousWeek, weekOf } from "@keylow/core/diary";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";

import { useIsOnline } from "../../../lib/connectivity";
import { foodSearchHref } from "../../../lib/navigation";
import { useNow } from "../../../lib/useNow";
import { setViewedDay } from "../../../lib/viewedDay";
import { ErrorState, WeekStrip } from "../../ui";
import { DatePickerSheet } from "../DatePickerSheet";
import { DiaryDayContent } from "../DiaryDayContent";
import { DiaryFrame } from "../DiaryFrame";
import { DiaryLoading } from "../DiaryLoading";
import { DiaryMoreSheet } from "../DiaryMoreSheet";
import { useCopyYesterday } from "../useCopyYesterday";
import { useDeleteEntryWithUndo } from "../useDeleteEntryWithUndo";

import type { DiaryDayProps } from "./types";
import type { WeekStripWeekChange } from "../../ui";

const NOON = 12;

/**
 * One day of the diary and the week around it, once the profile's time zone is known: the header, the
 * week strip and, under it, the day, with the sheets the header opens (the date picker, and the menu
 * with Copy yesterday) and the actions on the day (delete with Undo, copy, and marking it complete).
 * Nothing is read while `isReadEnabled` is false, because the terms gate is up over the app. Until the
 * first day has loaded a skeleton stands in for the whole body. After that the header and the strip stay
 * on screen whatever the next day is doing, so a day that is slow to load, or waiting for a connection,
 * never leaves the person without a way to another day.
 */
export function DiaryDay({ timeZone, isReadEnabled }: DiaryDayProps) {
  const router = useRouter();
  const isOnline = useIsOnline();
  const now = useNow();
  // null follows today. A chosen day is kept until another is chosen.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // null shows the week of the viewed day. A swipe moves the strip alone, leaving the viewed day as it is.
  const [shownWeekDate, setShownWeekDate] = useState<string | null>(null);
  const [hasLoadedADay, setHasLoadedADay] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const today = toLocalDate(now, timeZone);
  const viewedDate = selectedDate ?? today;
  const weekDays = weekOf(shownWeekDate ?? viewedDate);

  useEffect(() => {
    setViewedDay(viewedDate);
  }, [viewedDate]);

  const dayQuery = useDiaryDay(viewedDate, { enabled: isReadEnabled });
  const weekQuery = useDiaryWeek(weekDays[0] ?? viewedDate, { enabled: isReadEnabled });
  const targetsQuery = useTargets({ enabled: isReadEnabled });
  const setDayComplete = useSetDayComplete();
  const deleteEntry = useDeleteEntryWithUndo();
  const { copyYesterday, isCopying, hasCopyFailed } = useCopyYesterday(viewedDate, timeZone);

  const day = dayQuery.data;
  const targets = targetsQuery.data;
  // Only an empty day, or the open menu, offers to copy yesterday, so only then is yesterday read.
  const previousDayQuery = useDiaryDay(previousCalendarDay(viewedDate), {
    enabled: isReadEnabled && (day?.entries.length === 0 || isMenuOpen),
  });
  const isYesterdayEmpty = previousDayQuery.isSuccess && previousDayQuery.data.entries.length === 0;

  if (day !== undefined && !hasLoadedADay) {
    setHasLoadedADay(true);
  }

  const title = describeDiaryTitle(
    instantAtLocalTime(viewedDate, NOON, 0, timeZone),
    now,
    timeZone,
  );
  const isFailed = dayQuery.isError || targetsQuery.isError;

  function selectDay(localDate: string) {
    setSelectedDate(localDate === today ? null : localDate);
    setShownWeekDate(null);
  }

  function changeWeek(direction: WeekStripWeekChange) {
    const anchor = weekDays[0] ?? viewedDate;
    const week = direction === "previous" ? previousWeek(anchor) : nextWeek(anchor);
    setShownWeekDate(week[0] ?? anchor);
  }

  function openTargets() {
    router.push("/targets");
  }

  function retry() {
    void Promise.all([
      dayQuery.isError ? dayQuery.refetch() : undefined,
      targetsQuery.isError ? targetsQuery.refetch() : undefined,
    ]);
  }

  function renderDay() {
    if (isFailed) {
      return (
        <ErrorState
          body={DIARY_LOAD_FAILED.body}
          retry={{ label: DIARY_LOAD_FAILED.action, onPress: retry }}
          title={DIARY_LOAD_FAILED.title}
        />
      );
    }
    if (day === undefined || targets === undefined) {
      return <DiaryLoading includesWeek={false} isOnline={isOnline} />;
    }

    return (
      <DiaryDayContent
        currentHour={clockHourOf(now, timeZone)}
        day={day}
        isOnline={isOnline}
        isToday={viewedDate === today}
        isCopying={isCopying}
        isYesterdayEmpty={isYesterdayEmpty}
        hasCopyFailed={hasCopyFailed}
        targets={targets}
        timeZone={timeZone}
        onAddFood={(hour) => {
          if (isOnline) {
            router.push(foodSearchHref({ day: viewedDate, hour }));
          }
        }}
        onCompleteChange={(complete) =>
          setDayComplete.mutateAsync({ localDate: viewedDate, complete })
        }
        onCopyYesterday={copyYesterday}
        onDeleteEntry={deleteEntry}
        onOpenTargets={openTargets}
      />
    );
  }

  return (
    <DiaryFrame
      moreLabel={DIARY_MORE_LABEL}
      title={title}
      onChooseDate={() => {
        setIsPickerOpen(true);
      }}
      onMore={() => {
        setIsMenuOpen(true);
      }}
    >
      {!hasLoadedADay && !isFailed ? (
        <DiaryLoading includesWeek isOnline={isOnline} />
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
            onSelectDay={selectDay}
            onWeekChange={changeWeek}
          />
          {renderDay()}
        </>
      )}
      <DatePickerSheet
        isReadEnabled={isReadEnabled}
        open={isPickerOpen}
        selectedDate={viewedDate}
        today={today}
        onClose={() => {
          setIsPickerOpen(false);
        }}
        onSelect={(localDate) => {
          selectDay(localDate);
          setIsPickerOpen(false);
        }}
      />
      <DiaryMoreSheet
        isCopyDisabled={!isOnline || isCopying || previousDayQuery.isPending}
        isYesterdayEmpty={isYesterdayEmpty}
        open={isMenuOpen}
        onClose={() => {
          setIsMenuOpen(false);
        }}
        onCopyYesterday={() => {
          setIsMenuOpen(false);
          copyYesterday();
        }}
      />
    </DiaryFrame>
  );
}
