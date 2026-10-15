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
import { useRef, useState } from "react";

import { FoodLog } from "../FoodLog";

import type { DiaryDayContentProps } from "./types";

import { Banner } from "@/components/ui/Banner";
import { MacroProgressStrip } from "@/components/ui/MacroProgressStrip";
import { useToast } from "@/components/ui/Toast";
import { useFoodLogActions } from "@/lib/foodLogActions";
import { useDeleteEntryWithUndo } from "@/lib/foodLogActions/useDeleteEntryWithUndo";
import { firstControlIn, useKeyboardUndo } from "@/lib/keyboardUndo";
import { useIsOnline } from "@/lib/useIsOnline";

/**
 * A loaded day under the week strip: the four progress bars (one button to Targets) and the hour-by-hour
 * log, and everything that changes the day. The bars add up the entries on screen with core's `sumEntries`,
 * so they always agree with the rows. Delete is immediate and offers Undo. Copy yesterday copies the whole
 * day and offers Undo too, which a keyboard user reaches by focus. The complete switch marks the day at
 * once. An hour's plus opens the add dialog at that hour, and a row's Edit opens the edit dialog. All of
 * these need a connection: offline, a notice says so and they are off.
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
  const keyboardUndo = useKeyboardUndo();
  const logElement = useRef<HTMLDivElement>(null);
  const isCopyUndone = useRef(false);
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

  // Where a keyboard user's focus goes when the Undo toast of Copy yesterday closes. The button they pressed is
  // on the empty day's card, which goes when the copy fills the day, so this is asked for when the toast
  // closes: the first control of the first copied food, which is what the person is about to read, else the
  // day's complete switch, which is on the screen before the copy, after it and after Undo. After Undo the
  // copied foods are going, so it is the switch.
  function focusAfterCopy(): HTMLElement | null {
    const log = logElement.current;
    const completeSwitch = log?.querySelector<HTMLElement>('[role="switch"]') ?? null;
    if (isCopyUndone.current) {
      return completeSwitch;
    }
    // The foods of an hour are the one card an hour's group holds. The empty day's card is not in a group.
    const firstFoods = log?.querySelector('[role="group"] section') ?? null;

    return firstControlIn(firstFoods) ?? completeSwitch;
  }

  function copyYesterday() {
    isCopyUndone.current = false;
    // Asked as the press arrives, while focus is still on the button, and settled when the copy is done.
    const keyboardRoute = keyboardUndo.afterPressingButton({ returnTo: focusAfterCopy });
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
              isCopyUndone.current = true;
              undoCopyDay.mutate(copied, { onError: showFailure });
            },
            ...keyboardRoute(),
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
        ref={logElement}
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
