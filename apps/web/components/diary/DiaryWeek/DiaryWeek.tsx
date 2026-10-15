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

import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { WeekGrid } from "@/components/ui/WeekGrid";
import { diaryHref } from "@/lib/diary";
import { useKeyboardUndo } from "@/lib/keyboardUndo";
import { useIsOnline } from "@/lib/useIsOnline";

const WEEK_ROWS = 8;

/**
 * The week view: the week that holds the day on view, as a heading and the week grid, Monday to Sunday
 * and their Average. A day's date opens it in the day view. Copy to today copies a past day, whole,
 * into today, and offers Undo, which a keyboard user reaches by focus. The header, with the day
 * stepper, is the screen's. A refresh that fails while the week is on screen leaves the week where it is.
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
          toast.show({
            message: describeCopiedEntriesToToday(copied.count),
            icon: Copy,
            actionLabel: UNDO_LABEL,
            onAction: () => {
              undoCopyDay.mutate(copied, { onError: showFailure });
            },
            ...keyboardRoute(),
          });
        },
        onError: showFailure,
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

  // A nutrient no entry gave a value for reads as 0, as it does on the day's bars.
  const days: WeekGridDay[] = week.map((day) => ({
    localDate: day.localDate,
    totals:
      day.totals === null
        ? null
        : {
            kcal: day.totals.kcal ?? 0,
            protein_g: day.totals.protein_g ?? 0,
            carbs_g: day.totals.carbs_g ?? 0,
            fat_g: day.totals.fat_g ?? 0,
          },
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
