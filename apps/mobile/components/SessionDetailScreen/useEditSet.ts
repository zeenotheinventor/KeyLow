import { useProfileTimeZone, useSession, useUpdateSet, useWeightUnit } from "@keylow/api-client";
import { SET_ENTRY } from "@keylow/core/copy";
import { sessionExercises } from "@keylow/core/training";
import { onlineManager } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { useRemoveSetWithUndo } from "../SessionScreen";
import { useToast } from "../ui";

import type { EditSetOpening, EditSetSheetProps, SetChanges } from "../SetEntrySheet";
import type { SetPatch } from "@keylow/api-client";

type Opening = {
  setId: string;
  entry: EditSetOpening;
  isOpen: boolean;
  /** Counted up on every press of a row, so a form still on its way out never carries its numbers into the next. */
  openingId: number;
};

type EditSet = {
  /** Opens the sheet for the set. A set the session does not hold (it was removed meanwhile) opens nothing. */
  openSet: (setId: string) => void;
  /** The edit set sheet's props once a set has been opened, and null before. */
  sheet: EditSetSheetProps | null;
};

const patchOf = ({ loadKg, reps, rir }: SetChanges): SetPatch => ({
  ...(loadKg === undefined ? {} : { load_kg: loadKg }),
  ...(reps === undefined ? {} : { reps }),
  ...(rir === undefined ? {} : { rir }),
});

/**
 * What the session detail does with a set it is pressed on: opens the edit set sheet with the set's stored
 * numbers, saves what the person changed (`useUpdateSet`: the snapshot never changes) and deletes the set with
 * the session screen's Undo toast. The sheet holds the set as it was when it opened, since a deleted set
 * leaves the session while the sheet is still on its way out. Every write needs a connection: with none,
 * nothing is written and nothing is kept for later. A failure keeps the sheet and says the set did not save,
 * never what its numbers were. A write already on its way is not asked for twice.
 */
export function useEditSet(sessionId: string | undefined): EditSet {
  const enabled = useReadsEnabled();
  const session = useSession(sessionId, { enabled });
  const timeZone = useProfileTimeZone({ enabled });
  const unit = useWeightUnit({ enabled });
  const toast = useToast();
  const updateSet = useUpdateSet();
  const removeSetWithUndo = useRemoveSetWithUndo();
  const isSaving = useRef(false);
  const [opening, setOpening] = useState<Opening | null>(null);

  const sessionData = session.data;
  const zone = timeZone.data === undefined ? undefined : (timeZone.data ?? "UTC");

  function openSet(setId: string) {
    if (sessionData === undefined || sessionData === null || zone === undefined) {
      return;
    }
    const row = sessionExercises(null, sessionData.sets)
      .flatMap((exercise) => exercise.rows)
      .find(({ set }) => set?.id === setId);
    const set = row?.set;
    if (row === undefined || set === undefined || set === null) {
      return;
    }
    const { setType, setNumber } = row;
    setOpening((current) => ({
      setId,
      isOpen: true,
      openingId: (current?.openingId ?? 0) + 1,
      entry: {
        exerciseName: set.snapshot.name,
        setType,
        setNumber,
        performedAt: set.performed_at,
        tz: zone,
        loadKg: set.load_kg,
        reps: set.reps,
        rir: set.rir,
      },
    }));
  }

  async function save(changes: SetChanges, setId: string): Promise<boolean> {
    if (isSaving.current) {
      return false;
    }
    if (!onlineManager.isOnline()) {
      toast.show({ message: SET_ENTRY.saveFailed, tone: "danger", icon: "CircleAlert" });
      return false;
    }
    isSaving.current = true;
    try {
      await updateSet.mutateAsync({ id: setId, patch: patchOf(changes) });
      return true;
    } catch {
      toast.show({ message: SET_ENTRY.saveFailed, tone: "danger", icon: "CircleAlert" });
      return false;
    } finally {
      isSaving.current = false;
    }
  }

  const unitData = unit.data;
  const sheet: EditSetSheetProps | null =
    opening === null || unitData === undefined
      ? null
      : {
          mode: "edit",
          open: opening.isOpen,
          openingId: opening.openingId,
          unit: unitData,
          entry: opening.entry,
          // Closes this opening only: a save or delete still on its way from an earlier one must not close a newer sheet.
          onClose: () => {
            setOpening((current) =>
              current !== null && current.openingId === opening.openingId
                ? { ...current, isOpen: false }
                : current,
            );
          },
          onSave: (changes) => save(changes, opening.setId),
          onDelete: () => {
            const { exerciseName, setType, setNumber } = opening.entry;
            return removeSetWithUndo({ setId: opening.setId, exerciseName, setType, setNumber });
          },
        };

  return { openSet, sheet };
}
