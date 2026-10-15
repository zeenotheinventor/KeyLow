import { COPY_FAILED_BANNER, NO_TARGET_BANNER, OFFLINE_BANNER } from "@keylow/core/copy";
import { groupEntriesByHour, progressBars, sumEntries } from "@keylow/core/diary";
import { View } from "react-native";

import { Banner, MacroProgressStrip } from "../../ui";
import { FoodLog } from "../FoodLog";

import type { DiaryDayContentProps } from "./types";

/**
 * A loaded day under the week strip: the four progress bars (one button to Targets), the banners for no
 * target, for offline and for a copy that failed, and the hour-by-hour log. The bars add up the entries on screen with core's
 * `sumEntries`, so they always agree with the rows.
 */
export function DiaryDayContent({
  day,
  targets,
  timeZone,
  currentHour,
  isToday,
  isOnline,
  isYesterdayEmpty,
  isCopying,
  hasCopyFailed,
  onOpenTargets,
  onAddFood,
  onDeleteEntry,
  onCopyYesterday,
  onCompleteChange,
}: DiaryDayContentProps) {
  return (
    <>
      <MacroProgressStrip
        bars={progressBars(sumEntries(day.entries), targets)}
        onPress={onOpenTargets}
      />
      <View className="gap-2 px-4">
        {targets.kcal === null ? (
          <Banner
            action={{ label: NO_TARGET_BANNER.action, onPress: onOpenTargets }}
            body={NO_TARGET_BANNER.body}
            title={NO_TARGET_BANNER.title}
            variant="info"
          />
        ) : null}
        {isOnline ? null : (
          <Banner body={OFFLINE_BANNER.body} title={OFFLINE_BANNER.title} variant="offline" />
        )}
        {hasCopyFailed ? <Banner sentence title={COPY_FAILED_BANNER} variant="error" /> : null}
      </View>
      <FoodLog
        // A new day is a new log, so it scrolls to its own first food.
        key={day.localDate}
        currentHour={currentHour}
        hours={groupEntriesByHour(day.entries, timeZone)}
        isComplete={day.dayLog?.is_complete ?? false}
        isCopying={isCopying}
        isOnline={isOnline}
        isToday={isToday}
        isYesterdayEmpty={isYesterdayEmpty}
        timeZone={timeZone}
        onAddFood={onAddFood}
        onCompleteChange={onCompleteChange}
        onCopyYesterday={onCopyYesterday}
        onDeleteEntry={onDeleteEntry}
      />
    </>
  );
}
