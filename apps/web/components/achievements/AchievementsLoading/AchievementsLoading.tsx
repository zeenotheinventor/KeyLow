import { WEB_ACHIEVEMENTS } from "@keylow/core/copy";

import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";

/** The loading board: the heading, the three summary cards and two categories, as bones. */
export function AchievementsLoading() {
  return (
    <Skeleton label={WEB_ACHIEVEMENTS.loadingLabel} className="flex flex-col gap-5">
      <SkeletonBone className="h-9 w-[200px]" />
      <div className="grid gap-4 lg:grid-cols-3">
        <SkeletonBone className="h-[134px] rounded-large" />
        <SkeletonBone className="h-[134px] rounded-large" />
        <SkeletonBone className="h-[134px] rounded-large" />
      </div>
      <SkeletonBone className="h-[206px] rounded-large" />
      <SkeletonBone className="h-[206px] rounded-large" />
    </Skeleton>
  );
}
