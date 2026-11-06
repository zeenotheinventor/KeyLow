import { EXERCISE_PROGRESS } from "@keylow/core/copy";

import { ProgressColumns } from "./ProgressColumns";

import type * as React from "react";

import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";

/**
 * What the `web-train · progress-loading` board draws: the Range control stays, a block stands in for the
 * chart, and a heading and rows for the weeks, six rows from the large breakpoint and three under it, so the
 * columns do not jump when the read lands. The rows are decoration, the chart's block names the wait.
 */
export function ProgressLoading({ range }: { range: React.ReactNode }) {
  return (
    <ProgressColumns
      main={
        <>
          {range}
          <Skeleton label={EXERCISE_PROGRESS.loadingName}>
            <div className="rounded-large border border-border bg-surface p-3">
              <SkeletonBone className="h-[220px] rounded-medium lg:h-[280px]" />
            </div>
          </Skeleton>
        </>
      }
      weeks={
        <div aria-hidden className="flex flex-col gap-2">
          <div className="flex min-h-[32px] items-center px-1">
            <SkeletonBone className="h-3 w-[88px]" />
          </div>
          <Skeleton variant="rows" count={3} className="lg:hidden" />
          <Skeleton variant="rows" count={6} className="max-lg:hidden" />
        </div>
      }
    />
  );
}
