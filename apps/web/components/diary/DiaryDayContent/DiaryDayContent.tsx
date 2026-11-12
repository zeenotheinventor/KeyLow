import { useSetDayComplete } from "@keylow/api-client";
import { OFFLINE_BANNER } from "@keylow/core/copy";
import { joinClockTime } from "@keylow/core/dates";
import { groupEntriesByHour, progressBars, sumEntries } from "@keylow/core/diary";
import { WifiOff } from "lucide-react";

import { FoodLog } from "../FoodLog";

import type { DiaryDayContentProps } from "./types";

import { Banner } from "@/components/ui/Banner";
import { MacroProgressStrip } from "@/components/ui/MacroProgressStrip";
import { useFoodLogActions } from "@/lib/foodLogActions";
import { useDeleteEntryWithUndo } from "@/lib/foodLogActions/useDeleteEntryWithUndo";
import { useIsOnline } from "@/lib/useIsOnline";

/**
 * A loaded day under the week strip: the four progress bars (one button to Targets) and the hour-by-hour
 * log, and everything that changes the day. The bars add up the entries on screen with core's `sumEntries`,
 * so they always agree with the rows. Delete is immediate and offers Undo once it is saved. Copy yesterday
 * is the screen's `useCopyYesterday`, which the empty day's card draws a button for. The complete switch marks the day at
 * once. An hour's plus opens the add dialog at that hour, and a row's Edit opens the edit dialog. All of
 * these need a connection: offline, a notice says so and they are off.
 */
export function DiaryDayContent({
  day,
  targets,
  timeZone,
  currentHour,
  isToday,
  copy,
  logElement,
  onOpenTargets,
}: DiaryDayContentProps) {
  const isOnline = useIsOnline();
  const { openAddFood, openEditEntry } = useFoodLogActions();
  const remove = useDeleteEntryWithUndo();
  const setDayComplete = useSetDayComplete();

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
        hasCopyFailed={copy.hasCopyFailed}
        hours={groupEntriesByHour(day.entries, timeZone)}
        isComplete={day.dayLog?.is_complete ?? false}
        isOnline={isOnline}
        isCopying={copy.isCopying}
        isToday={isToday}
        isYesterdayEmpty={copy.isYesterdayEmpty}
        timeZone={timeZone}
        onCompleteChange={(isComplete) => {
          setDayComplete.mutate({ localDate: day.localDate, complete: isComplete });
        }}
        onAddFood={(hour) => {
          openAddFood({ date: day.localDate, time: joinClockTime(hour, 0) });
        }}
        onCopyYesterday={copy.copyYesterday}
        onDelete={remove}
        onEdit={(entry) => {
          openEditEntry(entry.id);
        }}
      />
    </>
  );
}
