import { HISTORY_SESSION_LOADING_NAME } from "@keylow/core/copy";

import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";

const STAT_COUNT = 3;
const EXERCISE_COUNT = 2;

/** What the session detail shows while it loads: the three cards and two exercises, in bones. No board draws it. */
export function SessionDetailLoading() {
  return (
    <Skeleton label={HISTORY_SESSION_LOADING_NAME} className="flex flex-col gap-3">
      <SkeletonBone className="mx-auto h-3 w-[200px]" />
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: STAT_COUNT }, (_, index) => (
          <Card
            // The cards are identical placeholders, so their position is their identity.
            key={index}
            padding="none"
            className="flex flex-col gap-1.5 p-3"
          >
            <SkeletonBone className="h-3 w-10" />
            <SkeletonBone className="h-5 w-14" />
          </Card>
        ))}
      </div>
      {Array.from({ length: EXERCISE_COUNT }, (_, index) => (
        <Card
          // The cards are identical placeholders, so their position is their identity.
          key={index}
          padding="none"
          className="flex flex-col gap-3 p-3"
        >
          <SkeletonBone className="h-3.5 w-[140px]" />
          <SkeletonBone className="h-3 w-full" />
          <SkeletonBone className="h-3 w-full" />
        </Card>
      ))}
    </Skeleton>
  );
}
