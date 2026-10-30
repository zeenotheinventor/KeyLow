import { BODY_MAP } from "@keylow/core/copy";

import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";

/**
 * What the body map shows while it loads, after the 200 ms the skeleton waits: the card's label, the two
 * figures at the size the card draws them, and the legend card beside or under it, so nothing jumps when
 * the map arrives.
 */
export function BodyMapLoading() {
  return (
    <Skeleton
      label={BODY_MAP.dashboardCard.loadingLabel}
      className="flex flex-col gap-3 xl:flex-row xl:items-start xl:gap-5"
    >
      <Card padding="none" className="flex flex-col gap-3 p-3 xl:w-[680px] xl:shrink-0 xl:p-5">
        <div className="flex flex-col gap-1.5">
          <SkeletonBone className="h-3.5 w-[72px]" />
          <SkeletonBone className="h-3 w-[150px]" />
        </div>
        <div className="flex justify-center gap-10 xl:gap-16">
          <SkeletonBone className="h-[308px] w-[140px] rounded-medium xl:h-[440px] xl:w-[200px]" />
          <SkeletonBone className="h-[308px] w-[140px] rounded-medium xl:h-[440px] xl:w-[200px]" />
        </div>
      </Card>
      <Card padding="none" className="flex flex-col gap-2 p-4 xl:flex-1">
        <SkeletonBone className="h-3.5 w-[56px]" />
        <SkeletonBone className="h-[10px] w-full" />
        <SkeletonBone className="h-3 w-[90%]" />
      </Card>
    </Skeleton>
  );
}
