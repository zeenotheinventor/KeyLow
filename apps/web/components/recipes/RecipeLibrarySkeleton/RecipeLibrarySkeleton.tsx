import type { RecipeLibrarySkeletonProps } from "./types";

import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

// The title bar of each of the board's five rows. The classes are written out so Tailwind sees them.
const TITLE_WIDTH_CLASSES = ["w-[40%]", "w-[32%]", "w-[48%]", "w-[36%]", "w-[44%]"] as const;

/**
 * The rows of the library while it loads, as the boards draw them: a card of five rows, each a tile, a
 * title and a shorter caption, and at the wide width a long bar where the values will be. Like every
 * `Skeleton` it shows nothing for the first 200 ms.
 */
export function RecipeLibrarySkeleton({ label }: RecipeLibrarySkeletonProps) {
  return (
    <Skeleton label={label}>
      <Card padding="none">
        {TITLE_WIDTH_CLASSES.map((titleWidthClassName) => (
          <div
            key={titleWidthClassName}
            className="flex min-h-[64px] items-center gap-3 border-t border-border px-4 py-2 first:border-t-0"
          >
            <SkeletonBone className="size-9 shrink-0" />
            <div className="flex flex-1 flex-col gap-2">
              <SkeletonBone className={cn("h-[14px]", titleWidthClassName)} />
              <SkeletonBone className="h-[10px] w-[30%]" />
            </div>
            <SkeletonBone className="hidden h-3 w-[360px] md:block" />
          </div>
        ))}
      </Card>
    </Skeleton>
  );
}
