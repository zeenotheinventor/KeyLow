import { useCopyDay, useDiaryDay, useSetDayComplete, useUndoCopyDay } from "@keylow/api-client";
import {
  GENERIC_ERROR,
  OFFLINE_BANNER,
  UNDO_LABEL,
  describeCopiedFromYesterday,
} from "@keylow/core/copy";
import { joinClockTime, previousCalendarDay } from "@keylow/core/dates";
import { groupEntriesByHour, progressBars, sumEntries } from "@keylow/core/diary";
import { Copy, WifiOff } from "lucide-react";
import { useState } from "react";

import { FoodLog } from "../FoodLog";

import type { DiaryDayContentProps } from "./types";

import { Banner } from "@/components/ui/Banner";
import { MacroProgressStrip } from "@/components/ui/MacroProgressStrip";
import { useToast } from "@/components/ui/Toast";
import { useFoodLogActions } from "@/lib/foodLogActions";
import { useDeleteEntryWithUndo } from "@/lib/foodLogActions/useDeleteEntryWithUndo";
import { useIsOnline } from "@/lib/useIsOnline";

/**
 * A loaded day under the week strip: the four progress bars (one button to Targets) and the
 * hour-by-hour log, and everything that changes the day, which waits for a connection: offline, the notice
 * says so and the hour plus, Delete, Copy yesterday and the complete switch are off. The bars add up the entries on screen with
 * core's `sumEntries`, so they always agree with the rows. Delete is immediate and offers Undo. Copy
 * yesterday copies the whole day and offers Undo too. The complete switch marks the day at once. An
 * hour's plus opens the add dialog at that hour, and a row's Edit opens the edit dialog.
 */
export function DiaryDayContent({
  day,
  targets,
  timeZone,
  currentHour,
  isToday,
  onOpenTargets,
}: DiaryDayContentProps) {
  const toast = useToast();
  const isOnline = useIsOnline();
  const { openAddFood, openEditEntry } = useFoodLogActions();
  const remove = useDeleteEntryWithUndo();
  const copyDay = useCopyDay();
  const undoCopyDay = useUndoCopyDay();
  const setDayComplete = useSetDayComplete();
  const [hasCopyFailed, setHasCopyFailed] = useState(false);

  const isEmpty = day.entries.length === 0;
  const yesterday = previousCalendarDay(day.localDate);
  // Only an empty day offers to copy yesterday, so only then is yesterday read.
  const yesterdayQuery = useDiaryDay(yesterday, { enabled: isEmpty });

  function showFailure() {
    toast.show({ message: GENERIC_ERROR, tone: "danger" });
  }

  function copyYesterday() {
    setHasCopyFailed(false);
    copyDay.mutate(
      { from: yesterday, to: day.localDate, timeZone },
      {
        onSuccess: (copied) => {
          toast.show({
            message: describeCopiedFromYesterday(copied.count),
            icon: Copy,
            actionLabel: UNDO_LABEL,
            onAction: () => {
              undoCopyDay.mutate(copied, { onError: showFailure });
            },
          });
        },
        onError: () => {
          setHasCopyFailed(true);
        },
      },
    );
  }

  return (
    <>
      {isOnline ? null : (
        <Banner title={OFFLINE_BANNER.title} icon={WifiOff}>
          {OFFLINE_BANNER.body}
        </Banner>
      )}
      <MacroProgressStrip
        bars={progressBars(sumEntries(day.entries), targets)}
        onPress={onOpenTargets}
      />
      <FoodLog
        // A new day is a new log, so it scrolls to its own first food.
        key={day.localDate}
        currentHour={currentHour}
        hasCopyFailed={hasCopyFailed}
        hours={groupEntriesByHour(day.entries, timeZone)}
        isComplete={day.dayLog?.is_complete ?? false}
        isOnline={isOnline}
        isCopying={copyDay.isPending}
        isToday={isToday}
        isYesterdayEmpty={yesterdayQuery.isSuccess && yesterdayQuery.data.entries.length === 0}
        timeZone={timeZone}
        onCompleteChange={(isComplete) => {
          setDayComplete.mutate({ localDate: day.localDate, complete: isComplete });
        }}
        onAddFood={(hour) => {
          openAddFood({ date: day.localDate, time: joinClockTime(hour, 0) });
        }}
        onCopyYesterday={copyYesterday}
        onDelete={remove}
        onEdit={(entry) => {
          openEditEntry(entry.id);
        }}
      />
    </>
  );
}
