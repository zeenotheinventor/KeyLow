import { useCopyDay, useDiaryWeek, useTargets, useUndoCopyDay } from "@keylow/api-client";
import {
  DIARY_LOAD_FAILED,
  DIARY_LOADING_LABEL,
  GENERIC_ERROR,
  UNDO_LABEL,
  describeCopiedEntriesToToday,
  describeWeekGridTitle,
} from "@keylow/core/copy";
import { weekOf } from "@keylow/core/diary";
import { Copy } from "lucide-react";

import type { DiaryWeekProps } from "./types";
import type { WeekGridDay } from "@/components/ui/WeekGrid";

import { takeBackPartialCopy } from "@/components/diary/takeBackPartialCopy";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { WeekGrid } from "@/components/ui/WeekGrid";
import { diaryHref, weekDayTotals } from "@/lib/diary";
import { useKeyboardUndo } from "@/lib/keyboardUndo";
import { useIsOnline } from "@/lib/useIsOnline";

const WEEK_ROWS = 8;

/**
 * The week view: the week that holds the day on view, as a heading and the week grid, Monday to Sunday
 * and their Average. A day's date opens it in the day view. Copy to today copies a past day, whole,
 * into today, and offers Undo, which a keyboard user reaches by focus, and a copy that fails part way takes
 * back what it wrote. The header, with the day stepper, is the screen's. A refresh that fails while the week
 * is on screen leaves the week where it is.
 */
export function DiaryWeek({ viewedDate, today, timeZone }: DiaryWeekProps) {
  const toast = useToast();
  const keyboardUndo = useKeyboardUndo();
  const isOnline = useIsOnline();
  const copyDay = useCopyDay();
  const undoCopyDay = useUndoCopyDay();
  const monday = weekOf(viewedDate)[0] ?? viewedDate;
  const weekQuery = useDiaryWeek(monday);
  const targetsQuery = useTargets();
  const week = weekQuery.data;
  const targets = targetsQuery.data;

  function showFailure() {
    toast.show({ message: GENERIC_ERROR, tone: "danger" });
  }

  function copyToToday(from: string) {
    // Asked as the press arrives, while focus is still on its button, and settled when the copy is done.
    const keyboardRoute = keyboardUndo.afterPressingButton();
    copyDay.mutate(
      { from, to: today, timeZone },
      {
        onSuccess: (copied) => {
          // The day had nothing to copy, and the grid offers Copy to today only on a day with entries.
          if (copied.count > 0) {
            toast.show({
              message: describeCopiedEntriesToToday(copied.count),
              icon: Copy,
              actionLabel: UNDO_LABEL,
              onAction: () => {
                undoCopyDay.mutate(copied, { onError: showFailure });
              },
              ...keyboardRoute(),
            });
          }
        },
        onError: (error) => {
          showFailure();
          takeBackPartialCopy(error, today, undoCopyDay.mutate);
        },
      },
    );
  }

  if (
    (weekQuery.isError && week === undefined) ||
    (targetsQuery.isError && targets === undefined)
  ) {
    return (
      <ErrorState
        title={DIARY_LOAD_FAILED.title}
        body={DIARY_LOAD_FAILED.body}
        retryLabel={DIARY_LOAD_FAILED.action}
        onRetry={() => {
          void Promise.all([
            weekQuery.isError ? weekQuery.refetch() : undefined,
            targetsQuery.isError ? targetsQuery.refetch() : undefined,
          ]);
        }}
        className="min-h-[480px] justify-center border-0 bg-transparent py-0"
      />
    );
  }
  if (week === undefined || targets === undefined) {
    return <Skeleton variant="rows" count={WEEK_ROWS} label={DIARY_LOADING_LABEL} />;
  }

  const days: WeekGridDay[] = week.map((day) => ({
    localDate: day.localDate,
    totals: weekDayTotals(day.totals),
    isComplete: day.dayLog?.is_complete ?? false,
  }));
  const title = describeWeekGridTitle(monday);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h2">{title}</h1>
      <WeekGrid
        label={title}
        days={days}
        today={today}
        calorieTarget={targets.kcal}
        dayHref={(localDate) =>
          diaryHref({ date: localDate === today ? undefined : localDate, view: "day" })
        }
        copyDisabled={!isOnline}
        isCopying={copyDay.isPending}
        onCopyToToday={copyToToday}
      />
    </div>
  );
}
