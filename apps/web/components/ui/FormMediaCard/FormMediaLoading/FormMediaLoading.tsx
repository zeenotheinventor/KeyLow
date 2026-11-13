import { EXERCISE_FORM } from "@keylow/core/copy";

import { Card } from "../../Card";
import { Skeleton, SkeletonBone } from "../../Skeleton";

/**
 * The skeleton of the video card: the poster, a title of two lines and the channel, and the trailing line.
 * It draws nothing for the first 200 ms, like every skeleton, so a quick read never flickers.
 */
export function FormMediaLoading() {
  return (
    <Skeleton label={EXERCISE_FORM.loadingName}>
      <Card padding="none">
        <div className="flex items-start gap-3 p-3">
          <SkeletonBone className="h-[72px] w-[128px] shrink-0 rounded-medium" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <SkeletonBone className="h-[14px] w-[90%]" />
            <SkeletonBone className="h-[14px] w-[62%]" />
            <SkeletonBone className="mt-1 h-2.5 w-[38%]" />
          </div>
        </div>
        <div className="flex min-h-11 items-center border-t border-border px-3">
          <SkeletonBone className="h-3 w-[120px]" />
        </div>
      </Card>
    </Skeleton>
  );
}
