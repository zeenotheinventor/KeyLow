import { HISTORY_LOADING_NAME } from "@keylow/core/copy";

import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";

const ROW_COUNT = 3;

/** What the history shows while it loads, as the `history · loading` board draws it: a week's name over a card of rows in bones. */
export function HistoryLoading() {
  return (
    <Skeleton label={HISTORY_LOADING_NAME} className="flex flex-col gap-2">
      <SkeletonBone className="h-3 w-[160px]" />
      <Card padding="none" className="flex flex-col gap-4 p-3">
        {Array.from({ length: ROW_COUNT }, (_, index) => (
          <div
            // The rows are identical placeholders, so their position is their identity.
            key={index}
            className="flex gap-3"
          >
            <SkeletonBone className="h-11 w-10" />
            <div className="flex flex-1 flex-col gap-1.5">
              <SkeletonBone className="h-3.5 w-[90px]" />
              <SkeletonBone className="h-3 w-[170px]" />
            </div>
          </div>
        ))}
      </Card>
    </Skeleton>
  );
}
