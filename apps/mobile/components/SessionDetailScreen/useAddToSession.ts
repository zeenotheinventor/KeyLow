import { useAddToPastSession, useSession } from "@keylow/api-client";
import { useState } from "react";

import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { useSetNotices } from "../SessionScreen/useSetNotices";

import type { AddExerciseSheetProps } from "../AddExerciseSheet";
import type { SetEntrySheetProps } from "../SetEntrySheet";

type AddToSession = {
  /** Opens the set entry for the next set of an exercise the session holds. */
  openAddSet: (exerciseId: string, exerciseName: string) => void;
  /** Opens the Add exercise picker. */
  openPicker: () => void;
  /** The picker's props, always the session mode. */
  picker: AddExerciseSheetProps;
  /** The set entry sheet's props once a set has been opened, and null before. */
  sheet: SetEntrySheetProps | null;
};

/**
 * What the session detail does to add to a past session: Add set opens the set entry for the next set of an
 * exercise, filled from the exercise's last set in the session, and Add exercise opens the picker, whose pick
 * opens the entry for the exercise's first set. The rules (where the set is stamped, what a failure says) are
 * `@keylow/api-client`'s `useAddToPastSession`, shared with the web. The toast is the phone's.
 */
export function useAddToSession(sessionId: string | undefined): AddToSession {
  const enabled = useReadsEnabled();
  const session = useSession(sessionId, { enabled });
  const { openAddSet, chooseExercise, add } = useAddToPastSession(sessionId, {
    notices: useSetNotices(),
    enabled,
  });
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  return {
    openAddSet,
    openPicker: () => {
      setIsPickerOpen(true);
    },
    picker: {
      mode: "session",
      dayName: session.data?.routine_day_name ?? null,
      open: isPickerOpen,
      onAddToSession: (exercise) => {
        void chooseExercise(exercise);
      },
      onClose: () => {
        setIsPickerOpen(false);
      },
    },
    sheet:
      add === null || sessionId === undefined
        ? null
        : {
            open: add.isOpen,
            openingId: add.openingId,
            sessionId,
            unit: add.unit,
            entry: add.entry,
            setType: add.setType,
            onChangeSetType: add.changeSetType,
            onClose: add.close,
            onLogSet: add.logSet,
          },
  };
}
