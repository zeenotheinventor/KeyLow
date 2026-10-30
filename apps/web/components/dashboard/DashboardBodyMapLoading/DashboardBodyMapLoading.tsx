import { BODY_MAP } from "@keylow/core/copy";

import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";

/**
 * What the body map card shows while it loads, after the 200 ms the skeleton waits. It is as tall as the
 * card it becomes so the cards under it do not jump: the title and the view, the two 100 by 220 figures
 * and the legend, and the two lines under a hairline. It loads on its own, so the cards above it are
 * already there when it is the slow one.
 */
export function DashboardBodyMapLoading() {
  return (
    <Skeleton label={BODY_MAP.dashboardCard.loadingLabel}>
      <Card padding="none" className="flex flex-col gap-2 py-3 pl-4 pr-3">
        <div className="flex min-h-touch-target flex-col justify-start gap-1.5">
          <SkeletonBone className="h-3 w-[72px]" />
          <SkeletonBone className="h-3.5 w-[104px]" />
        </div>
        <div className="flex items-end justify-center gap-7">
          <SkeletonBone className="h-[220px] w-[100px] shrink-0 rounded-medium" />
          <SkeletonBone className="h-[220px] w-[100px] shrink-0 rounded-medium" />
          <SkeletonBone className="mb-1.5 h-[120px] w-8" />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
          <SkeletonBone className="h-3 w-[60%]" />
          <SkeletonBone className="h-3 w-14" />
        </div>
      </Card>
    </Skeleton>
  );
}
