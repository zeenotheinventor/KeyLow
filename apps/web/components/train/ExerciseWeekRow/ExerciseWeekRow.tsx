import { EXERCISE_PROGRESS } from "@keylow/core/copy";

import type { ExerciseWeekRowProps } from "./types";

import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

const changeTones = { up: "success", down: "danger" } as const;

// The row sits in a card that clips its corners, so the keyboard focus ring is drawn inside the row.
const rowClasses =
  "flex min-h-[56px] w-full items-center gap-3 px-3 py-2 text-left text-text-primary";
const pressableClasses =
  "cursor-pointer outline-none transition-colors duration-instant hover:bg-hover-overlay active:bg-press-overlay focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring";

/**
 * A week in the list beside the chart, as the `web-train · progress` board draws it: the Monday over the
 * value and its reps, and the change as a pill at the end, with its sign and words. A skipped week says
 * "Not trained" and is plain information. A week with a point is a button that selects the point on the
 * chart, and the selected one is raised. It is a `ListRow` of its own because `ListRow` drops its badge under
 * the subtitle at a phone width and has no selected look. Put it inside a `GroupedList`.
 */
export function ExerciseWeekRow({
  weekLabel,
  value,
  change,
  accessibleName,
  selected,
  onPress,
}: ExerciseWeekRowProps) {
  const contents = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body-strong">{weekLabel}</span>
        <span className="text-caption tabular-nums text-text-secondary">
          {value ?? EXERCISE_PROGRESS.notTrained}
        </span>
      </span>
      {change === null ? null : (
        <Badge tone={change.direction === null ? "neutral" : changeTones[change.direction]}>
          {change.text}
        </Badge>
      )}
    </>
  );

  return (
    <li>
      {onPress === undefined ? (
        <div className={rowClasses}>{contents}</div>
      ) : (
        <button
          aria-label={accessibleName}
          aria-pressed={selected}
          className={cn(rowClasses, pressableClasses, selected && "bg-surface-raised")}
          type="button"
          onClick={onPress}
        >
          {contents}
        </button>
      )}
    </li>
  );
}
