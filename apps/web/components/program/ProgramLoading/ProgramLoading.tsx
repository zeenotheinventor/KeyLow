import { PROGRAM_SCREEN } from "@keylow/core/copy";

import { COLUMNS_CLASS_NAME } from "../ProgramScreen/columns";

import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";

const CARD_CLASS_NAME = "rounded-large border border-border bg-surface";
const BONE_ROW_CLASS_NAME =
  "flex min-h-[56px] items-center gap-3 border-t border-border px-3 py-2 first:border-t-0";

/**
 * What `program-loading` draws, as the board sizes it, its 1 px borders included: a shape for each part of the
 * page, the estimate, the targets with their three tiles and the chart in the first column, and Your programme
 * with its four rows and the two rows of its card in the second. It is named "Loading your programme".
 */
export function ProgramLoading() {
  return (
    <Skeleton label={PROGRAM_SCREEN.loadingName} className={COLUMNS_CLASS_NAME}>
      <div className="flex flex-col gap-4">
        <div className={`flex flex-col gap-2 p-4 ${CARD_CLASS_NAME}`}>
          <SkeletonBone className="h-3 w-40" />
          <SkeletonBone className="h-10 w-[220px]" />
          <SkeletonBone className="h-[14px] w-[60%]" />
          <SkeletonBone className="h-3 w-[40%]" />
        </div>
        <div className={`flex flex-col gap-2 p-4 ${CARD_CLASS_NAME}`}>
          <SkeletonBone className="h-3 w-40" />
          <SkeletonBone className="h-8 w-[180px]" />
          <SkeletonBone className="h-[14px] w-[60%]" />
          <div className="mt-1 flex gap-2">
            <SkeletonBone className="h-16 flex-1 rounded-medium" />
            <SkeletonBone className="h-16 flex-1 rounded-medium" />
            <SkeletonBone className="h-16 flex-1 rounded-medium" />
          </div>
          <SkeletonBone className="h-3 w-[40%]" />
        </div>
        <SkeletonBone className="h-[300px] rounded-large" />
      </div>
      <div className="flex flex-col gap-4">
        <SkeletonBone className="h-[18px] w-[140px]" />
        <div className={`overflow-hidden ${CARD_CLASS_NAME}`}>
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className={`justify-between ${BONE_ROW_CLASS_NAME}`}>
              <SkeletonBone className="h-3 w-[40%]" />
              <SkeletonBone className="h-[14px] w-[72px]" />
            </div>
          ))}
        </div>
        <div className={`overflow-hidden ${CARD_CLASS_NAME}`}>
          {[0, 1].map((row) => (
            <div key={row} className={BONE_ROW_CLASS_NAME}>
              <SkeletonBone className="size-9 shrink-0" />
              <SkeletonBone className="h-3 w-[40%]" />
            </div>
          ))}
        </div>
      </div>
    </Skeleton>
  );
}
