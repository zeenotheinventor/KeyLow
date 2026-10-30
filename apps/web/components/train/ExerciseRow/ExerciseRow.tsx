import {
  ADD_EXERCISE,
  describeAddExerciseName,
  EQUIPMENT_OPTIONS,
  MUSCLE_NAMES,
} from "@keylow/core/copy";
import { Plus } from "lucide-react";

import type { ExerciseRowProps } from "./types";

import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/utils";

const MAX_MUSCLE_CHIPS = 2;

/**
 * An exercise of the Add exercise dialog as the `session · add-exercise` board draws it: the name with a
 * Custom pill for the person's own, then the equipment and up to two muscle chips, the primary solid and the
 * secondary quiet, and the add button named for the exercise. It is a list item, so it goes inside a
 * `GroupedList`.
 */
export function ExerciseRow({
  name,
  equipment,
  isCustom,
  primaryMuscles,
  secondaryMuscles,
  onAdd,
}: ExerciseRowProps) {
  const chips = [
    ...primaryMuscles.map((muscle) => ({ muscle, isPrimary: true })),
    ...secondaryMuscles.map((muscle) => ({ muscle, isPrimary: false })),
  ].slice(0, MAX_MUSCLE_CHIPS);

  return (
    <li className="flex min-h-16 items-center gap-2 py-2 pl-3 pr-1">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2 text-body">
          <span className="min-w-0 truncate">{name}</span>
          {isCustom && (
            // The board's pill: raised fill, hairline, 12 px semibold, 20 high.
            <span className="inline-flex h-5 shrink-0 items-center rounded-pill border border-border bg-surface-raised px-2 text-caption font-semibold text-text-secondary">
              {ADD_EXERCISE.customPill}
            </span>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-[6px]">
          <span className="text-caption text-text-muted">
            {EQUIPMENT_OPTIONS[equipment].label}
            {chips.length > 0 && " ·"}
          </span>
          {chips.map(({ muscle, isPrimary }) => (
            <span
              key={muscle}
              className={cn(
                "inline-flex h-[22px] items-center rounded-pill border px-2 text-caption",
                isPrimary
                  ? "border-border-strong bg-surface-sheet font-semibold text-text-primary"
                  : "border-border text-text-secondary",
              )}
            >
              {MUSCLE_NAMES[muscle]}
            </span>
          ))}
        </span>
      </div>
      <IconButton icon={Plus} label={describeAddExerciseName(name)} onClick={onAdd} />
    </li>
  );
}
