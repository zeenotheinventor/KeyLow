import { DIARY_LOADING_LABEL } from "@keylow/core/copy";

import type { DiaryLoadingProps } from "./types";

import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";

const WEEK_PILLS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const BARS = ["calories", "protein", "carbs", "fat"];
const HOURS = ["a", "b", "c", "d", "e"];

/**
 * What the diary shows while a day loads, as the loading board draws it: pills for the week, the four
 * bars and a few hours with a card each. Until the first day has loaded the pills are drawn as well.
 * After that the week strip stays on screen and the skeleton is the bars and the log alone, so the person
 * can always pick another day.
 */
export function DiaryLoading({ includesWeek }: DiaryLoadingProps) {
  return (
    <Skeleton label={DIARY_LOADING_LABEL} className="flex flex-col gap-4 md:gap-5">
      {includesWeek && (
        <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] gap-2 md:grid-cols-[repeat(7,56px)]">
          {WEEK_PILLS.map((pill) => (
            <SkeletonBone key={pill} className="h-14 rounded-pill" />
          ))}
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] gap-2 md:grid-cols-[repeat(4,minmax(0,1fr))] md:gap-6">
        {BARS.map((bar) => (
          <span key={bar} className="flex flex-col gap-2">
            <SkeletonBone className="h-3 w-[70%]" />
            <SkeletonBone className="h-1" />
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-4">
        {HOURS.map((hour) => (
          <div key={hour} className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-3">
            <span aria-hidden className="ml-[9px] border-l border-border" />
            <span className="flex flex-col gap-2.5">
              <SkeletonBone className="h-7 w-16 rounded-pill" />
              <Card padding="none" className="flex flex-col gap-2 px-4 py-3">
                <SkeletonBone className="h-3 w-[55%]" />
                <SkeletonBone className="h-2.5 w-[30%]" />
              </Card>
            </span>
          </div>
        ))}
      </div>
    </Skeleton>
  );
}
