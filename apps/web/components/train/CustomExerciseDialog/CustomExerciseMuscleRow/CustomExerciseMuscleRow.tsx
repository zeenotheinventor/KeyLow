import { CUSTOM_EXERCISE_ROLES, MUSCLE_NAMES, describeMuscleRowNames } from "@keylow/core/copy";
import { MUSCLE_ROLES } from "@keylow/core/training";
import { X } from "lucide-react";

import type { CustomExerciseMuscleRowProps } from "./types";

import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const ROLE_OPTIONS = MUSCLE_ROLES.map((role) => ({
  value: role,
  label: CUSTOM_EXERCISE_ROLES[role].label,
}));

/**
 * One muscle of the New exercise form, as the `session · custom-exercise` board draws it: the muscle's name
 * over what its role counts for, the Primary / Second / Assist control and a button to remove it. The help
 * line follows the chosen role, so the weight is never only a colour. Put it inside a list.
 */
export function CustomExerciseMuscleRow({
  muscle,
  role,
  onChangeRole,
  onRemove,
}: CustomExerciseMuscleRowProps) {
  const name = MUSCLE_NAMES[muscle];
  const names = describeMuscleRowNames(name);

  return (
    <li className="flex min-h-[60px] items-center gap-3 py-2 pl-3 pr-1">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body">{name}</span>
        <span className="text-caption text-text-secondary">{CUSTOM_EXERCISE_ROLES[role].help}</span>
      </span>
      <SegmentedControl
        label={names.role}
        options={ROLE_OPTIONS}
        size="sm"
        value={role}
        onChange={onChangeRole}
        className="w-[156px] shrink-0"
      />
      <IconButton icon={X} label={names.remove} onClick={onRemove} />
    </li>
  );
}
