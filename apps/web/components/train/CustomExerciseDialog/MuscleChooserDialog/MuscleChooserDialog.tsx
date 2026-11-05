import { CUSTOM_EXERCISE, MUSCLE_GROUP_NAMES, MUSCLE_NAMES } from "@keylow/core/copy";
import { MUSCLE_GROUPS, MUSCLE_IDS, MUSCLES } from "@keylow/core/training";

import type { MuscleChooserDialogProps } from "./types";

import { Dialog } from "@/components/ui/Dialog";
import { GroupedList } from "@/components/ui/GroupedList";
import { ListRow } from "@/components/ui/ListRow";

// The same size as the dialogs under it, so the three read as one stack.
const PANEL_CLASSES = "min-[700px]:h-[min(720px,calc(100%-theme(spacing.12)))]";

/**
 * The Add a muscle list of the New exercise form: the 22 muscles in their 7 groups, each a row to press,
 * without the muscles the exercise already has. No board draws it. It is a dialog over the form, so
 * Escape and Close step back to the form with the draft as it was, and focus returns to Add a muscle.
 */
export function MuscleChooserDialog({
  chosenMuscles,
  onChoose,
  onClose,
}: MuscleChooserDialogProps) {
  return (
    <Dialog
      open
      title={CUSTOM_EXERCISE.addMuscleAction}
      onClose={onClose}
      className={PANEL_CLASSES}
    >
      <div className="flex flex-col gap-4">
        {MUSCLE_GROUPS.map((group) => {
          const offered = MUSCLE_IDS.filter(
            (muscle) => MUSCLES[muscle].group === group && !chosenMuscles.includes(muscle),
          );
          if (offered.length === 0) {
            return null;
          }
          return (
            <GroupedList key={group} title={MUSCLE_GROUP_NAMES[group]}>
              {offered.map((muscle) => (
                <ListRow
                  key={muscle}
                  title={MUSCLE_NAMES[muscle]}
                  chevron={false}
                  onClick={() => {
                    onChoose(muscle);
                  }}
                />
              ))}
            </GroupedList>
          );
        })}
      </div>
    </Dialog>
  );
}
