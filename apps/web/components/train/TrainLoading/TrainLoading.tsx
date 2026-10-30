import { TRAIN_LOADING_NAME } from "@keylow/core/copy";

import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";

/** What the Train home shows while it loads: the shape of the Today card in bones, after the 200 ms the skeleton waits. */
export function TrainLoading() {
  return (
    <Skeleton label={TRAIN_LOADING_NAME}>
      <Card padding="none" className="flex flex-col gap-2 p-5">
        <SkeletonBone className="h-3 w-[160px]" />
        <SkeletonBone className="h-6 w-[96px]" />
        <SkeletonBone className="h-3 w-[200px]" />
        <SkeletonBone className="mt-3 h-control-md w-full rounded-medium md:w-[140px]" />
      </Card>
    </Skeleton>
  );
}
