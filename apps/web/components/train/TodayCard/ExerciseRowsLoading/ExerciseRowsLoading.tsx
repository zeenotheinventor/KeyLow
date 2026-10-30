import { TRAIN_HOME } from "@keylow/core/copy";

import type { ExerciseRowsLoadingProps } from "./types";

import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";
import { vars } from "@/lib/vars";

const ROWS_WHEN_UNKNOWN = 3;

/**
 * The exercise list's place while its rows load, one row for each exercise of the plan, each as tall as a
 * list row (36 px and its 1 px line). The kit's skeleton shows nothing for its first 200 ms, so the wrapper
 * holds the height from the first frame and the card does not move when the list arrives.
 */
export function ExerciseRowsLoading({ count }: ExerciseRowsLoadingProps) {
  const rows = count > 0 ? count : ROWS_WHEN_UNKNOWN;

  return (
    // The height is a runtime number of rows, which no class can name, so it goes through a variable.
    <div className="mt-2 min-h-[calc(var(--rows)*37px)]" style={vars({ "--rows": String(rows) })}>
      <Skeleton label={TRAIN_HOME.exercisesLoadingName}>
        {Array.from({ length: rows }, (_, index) => (
          <div
            // The rows are identical placeholders, so their position is their identity.
            key={index}
            className="box-content flex min-h-9 items-center justify-between gap-3 border-t border-border"
          >
            <SkeletonBone className="h-3 w-[40%]" />
            <SkeletonBone className="h-3 w-[20%]" />
          </div>
        ))}
      </Skeleton>
    </div>
  );
}
