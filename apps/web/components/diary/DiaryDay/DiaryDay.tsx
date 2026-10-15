import { useDiaryDay, useDiaryWeek, useTargets } from "@keylow/api-client";
import { DIARY_LOAD_FAILED } from "@keylow/core/copy";
import {
  clockHourOf,
  describeDiaryTitle,
  instantAtLocalTime,
  toLocalDate,
} from "@keylow/core/dates";
import { nextWeek, previousWeek, weekOf } from "@keylow/core/diary";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DayHeader } from "../DayHeader";
import { DiaryDayContent } from "../DiaryDayContent";
import { DiaryLoading } from "../DiaryLoading";
import { DiaryWeek } from "../DiaryWeek";
import { WeekStepper } from "../WeekStepper";

import type { DiaryDayProps } from "./types";
import type { WeekStripWeekChange } from "@/components/ui/WeekStrip";
import type { DiaryView } from "@/lib/diary";

import { ErrorState } from "@/components/ui/ErrorState";
import { WeekStrip } from "@/components/ui/WeekStrip";
import { diaryHref } from "@/lib/diary";
import { useFoodLogActions } from "@/lib/foodLogActions";
import { useNow } from "@/lib/useNow";

const NOON = 12;
const TARGETS_HREF = "/more/targets";

/**
 * One day of the diary and the week around it, once the profile's time zone is known: the header, the
 * week strip and, under it, the day. The day comes from the address, so it can be shared and the back
 * button steps through the days. Until the first day has loaded a skeleton stands in for the whole body.
 * After that the header and the strip stay on screen whatever the next day is doing, so a day that is
 * slow to load never leaves the person without a way to another day. The week view takes the body's place
 * and the day stepper takes the title's place, and reads the week alone.
 */
export function DiaryDay({ date, view, timeZone }: DiaryDayProps) {
  const router = useRouter();
  const { setViewedDate } = useFoodLogActions();
  const now = useNow();
  // null shows the week of the viewed day. A swipe moves the strip alone, leaving the viewed day as it is.
  const [shownWeekDate, setShownWeekDate] = useState<string | null>(null);
  const [hasLoadedADay, setHasLoadedADay] = useState(false);

  const today = toLocalDate(now, timeZone);
  const viewedDate = date !== undefined && date <= today ? date : today;
  const weekDays = weekOf(shownWeekDate ?? viewedDate);

  // The top bar's search adds food to the day on view, so it is told which, and told when the diary goes.
  useEffect(() => {
    setViewedDate(viewedDate);
    return () => {
      setViewedDate(undefined);
    };
  }, [viewedDate, setViewedDate]);

  // The week view reads the week and the targets itself, and has no use for the day.
  const dayQuery = useDiaryDay(viewedDate, { enabled: view === "day" });
  const weekQuery = useDiaryWeek(weekDays[0] ?? viewedDate, { enabled: view === "day" });
  const targetsQuery = useTargets({ enabled: view === "day" });

  const day = dayQuery.data;
  const targets = targetsQuery.data;
  // A refetch that fails while the data is on screen leaves the data where it is: the error replaces the
  // diary only when there is nothing to show.
  const isFailed =
    (dayQuery.isError && day === undefined) || (targetsQuery.isError && targets === undefined);

  if (day !== undefined && !hasLoadedADay) {
    setHasLoadedADay(true);
  }

  function go(nextDate: string, nextView: DiaryView) {
    router.push(diaryHref({ date: nextDate === today ? undefined : nextDate, view: nextView }));
  }

  function changeWeek(direction: WeekStripWeekChange) {
    const anchor = weekDays[0] ?? viewedDate;
    const week = direction === "previous" ? previousWeek(anchor) : nextWeek(anchor);
    setShownWeekDate(week[0] ?? anchor);
  }

  function retry() {
    void Promise.all([
      dayQuery.isError ? dayQuery.refetch() : undefined,
      targetsQuery.isError ? targetsQuery.refetch() : undefined,
    ]);
  }

  function renderBody() {
    if (isFailed) {
      return (
        <ErrorState
          title={DIARY_LOAD_FAILED.title}
          body={DIARY_LOAD_FAILED.body}
          retryLabel={DIARY_LOAD_FAILED.action}
          onRetry={retry}
          className="min-h-[480px] justify-center border-0 bg-transparent py-0"
        />
      );
    }
    if (!hasLoadedADay) {
      return <DiaryLoading includesWeek />;
    }

    return (
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
            setShownWeekDate(null);
            go(localDate, "day");
          }}
          onWeekChange={changeWeek}
        />
        {day === undefined || targets === undefined ? (
          <DiaryLoading includesWeek={false} />
        ) : (
          <DiaryDayContent
            currentHour={clockHourOf(now, timeZone)}
            day={day}
            isToday={viewedDate === today}
            targets={targets}
            timeZone={timeZone}
            onOpenTargets={() => {
              router.push(TARGETS_HREF);
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <DayHeader
        selectedDate={viewedDate}
        title={describeDiaryTitle(instantAtLocalTime(viewedDate, NOON, 0, timeZone), now, timeZone)}
        today={today}
        view={view}
        weekStepper={
          <WeekStepper
            selectedDate={viewedDate}
            today={today}
            now={now}
            timeZone={timeZone}
            onSelectDate={(localDate) => {
              go(localDate, "week");
            }}
          />
        }
        onSelectDate={(localDate) => {
          go(localDate, "day");
        }}
        onViewChange={(nextView) => {
          go(viewedDate, nextView);
        }}
      />
      {view === "day" ? (
        <div className="flex flex-col gap-4 md:gap-5">{renderBody()}</div>
      ) : (
        <DiaryWeek viewedDate={viewedDate} today={today} timeZone={timeZone} />
      )}
    </>
  );
}
