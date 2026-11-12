import { pageColumnsClassName } from "../columnClassNames";

import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";

// The strip's four placeholder columns hold its place while the day, its targets and the time zone are
// read, so the rows under it do not move when the bars arrive. A column is a 16 px line of numbers, 6 px and
// a 4 px bar, which is 26 px, and the dialog's strip slot adds 24 px of padding and a hairline: 51 px.
const placeholderColumns = ["calories", "protein", "carbs", "fat"] as const;

/** The place of the page's strip while it is read: four columns of the strip's own height, 26 px. */
export function MacroProgressStripSkeleton() {
  return (
    <Skeleton label="Loading" className={`grid min-h-[26px] items-start ${pageColumnsClassName}`}>
      {placeholderColumns.map((column) => (
        <div key={column} className="flex flex-col gap-1.5">
          <SkeletonBone className="my-0.5 h-3 w-[70%]" />
          <SkeletonBone className="h-1 rounded-pill" />
        </div>
      ))}
    </Skeleton>
  );
}
