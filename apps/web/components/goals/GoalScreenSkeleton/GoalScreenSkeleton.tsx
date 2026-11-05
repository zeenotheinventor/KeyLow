"use client";

import { GOAL_SCREEN } from "@keylow/core/copy";

import { Skeleton } from "@/components/ui/Skeleton";

/**
 * The Goal page while the goal is being read: the card of six answer rows as bars, named as loading. The goal
 * flow draws it for every address under /goal, so no row and no question shows before the goal is known.
 */
export function GoalScreenSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[560px]">
      <Skeleton variant="rows" count={6} label={GOAL_SCREEN.loadingName} />
    </div>
  );
}
