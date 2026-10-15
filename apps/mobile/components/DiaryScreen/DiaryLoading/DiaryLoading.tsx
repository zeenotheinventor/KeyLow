import { OFFLINE_BANNER } from "@keylow/core/copy";
import { View } from "react-native";

import { Banner, Skeleton } from "../../ui";

import type { DiaryLoadingProps } from "./types";

/**
 * What the diary shows while a day loads: the offline notice when the phone is offline (a load then waits
 * for the connection, and the notice says why), over the skeleton. Until the first day has loaded the
 * skeleton draws the week as well. After that the week strip stays on screen and the skeleton is the bars
 * and the log alone, so the person can always pick another day.
 */
export function DiaryLoading({ isOnline, includesWeek }: DiaryLoadingProps) {
  return (
    <>
      {isOnline ? null : (
        <View className="px-4 pb-3">
          <Banner body={OFFLINE_BANNER.body} title={OFFLINE_BANNER.title} variant="offline" />
        </View>
      )}
      <Skeleton variant={includesWeek ? "diary" : "diaryDay"} />
    </>
  );
}
