"use client";

import { SETUP_SHELL } from "@keylow/core/copy";

import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";

/**
 * The wizard's card while the saved answers are first read, as `web-setup · loading` draws it: a caption,
 * the empty progress bar, the question, the helper, three answers and the button, named as loading. It
 * stands for every address under /setup, so no step shows before its answers are known.
 */
export function SetupScreenSkeleton() {
  return (
    <Card asChild padding="none">
      <section className="mx-auto w-full max-w-[560px] p-4 min-[700px]:p-8">
        <Skeleton label={SETUP_SHELL.loadingName} className="flex flex-col gap-3">
          <SkeletonBone className="h-3 w-2/5" />
          <div className="h-1 rounded-[2px] bg-surface-raised" />
          <SkeletonBone className="mt-2 h-7 w-[70%]" />
          <SkeletonBone className="h-3.5 w-full" />
          <div className="flex flex-col gap-2">
            <SkeletonBone className="h-16 rounded-medium" />
            <SkeletonBone className="h-16 rounded-medium" />
            <SkeletonBone className="h-16 rounded-medium" />
          </div>
          <div className="mt-2 flex justify-end">
            <SkeletonBone className="h-control-md w-28 rounded-medium" />
          </div>
        </Skeleton>
      </section>
    </Card>
  );
}
