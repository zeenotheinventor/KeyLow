import { PROGRAM_SCREEN } from "@keylow/core/copy";

import { COLUMNS_CLASS_NAME } from "../columns";

import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";

function OptionBones() {
  return (
    <div className="flex flex-col gap-2">
      <SkeletonBone className="h-[18px] w-[140px]" />
      <SkeletonBone className="h-[72px] rounded-medium" />
      <SkeletonBone className="h-[72px] rounded-medium" />
      <SkeletonBone className="h-[72px] rounded-medium" />
    </div>
  );
}

/** What `program-edit-loading` draws: a heading and three option shapes for each column, named "Loading your programme". */
export function ProgramEditLoading() {
  return (
    <Skeleton label={PROGRAM_SCREEN.loadingName} className={COLUMNS_CLASS_NAME}>
      <OptionBones />
      <OptionBones />
    </Skeleton>
  );
}
