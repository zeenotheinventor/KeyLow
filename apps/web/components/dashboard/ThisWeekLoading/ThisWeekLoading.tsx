import { WEEK_CARD } from "@keylow/core/copy";

import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";

const DAY_BONES = ["mo", "tu", "we", "th", "fr", "sa", "su"];

/**
 * What the This week card shows while it loads, as the loading board draws it: the title, a value line,
 * the 8 px bar, a caption line and seven small circles, after the 200 ms the skeleton waits. It loads
 * on its own, so the Today card is already there when it is the one that is slow.
 */
export function ThisWeekLoading() {
  return (
    <Skeleton label={WEEK_CARD.loadingLabel}>
      <Card padding="none" className="flex flex-col gap-3 px-4 py-4 sm:px-5">
        <SkeletonBone className="h-5 w-[104px]" />
        <SkeletonBone className="h-3 w-[60%]" />
        <SkeletonBone className="h-2 rounded-pill" />
        <SkeletonBone className="h-3 w-[45%]" />
        <div className="grid grid-cols-7 justify-items-center pt-2">
          {DAY_BONES.map((day) => (
            <SkeletonBone key={day} className="size-5 rounded-full" />
          ))}
        </div>
      </Card>
    </Skeleton>
  );
}
