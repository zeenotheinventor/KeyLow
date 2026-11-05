import { SET_ENTRY } from "@keylow/core/copy";
import { sessionExercises } from "@keylow/core/training";
import { onlineManager } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { useProfileTimeZone } from "./useProfileTimeZone";
import { useRemoveSetWithUndo } from "./useRemoveSetWithUndo";
import { useSession } from "./useSession";
import { useUpdateSet } from "./useUpdateSet";
import { useWeightUnit } from "./useWeightUnit";

import type { SetNotices } from "./useRemoveSetWithUndo";
import type { SetPatch } from "../repos/setWrites";
import type { LoadUnit, SetType } from "@keylow/core/training";

/** The logged set the edit opens with: what it holds now, and what its heading says. */
export type EditSetOpening = {
  /** The exercise's name as the set's snapshot holds it. */
  exerciseName: string;
  setType: SetType;
  /** Its number among the exercise's working sets. */
  setNumber: number;
  /** When the set was performed, an ISO timestamp with a zone. */
  performedAt: string;
  /** The person's IANA time zone: the moment is written in it. */
  tz: string;
  /** The stored load in kilograms, or null for a set done without one. */
  loadKg: number | null;
  reps: number;
  rir: number | null;
};

/** What the person changed on a set: only the fields they touched. The load is in kilograms, to the gram. */
export type SetChanges = {
  loadKg?: number | null;
  reps?: number;
  rir?: number | null;
};

/** One opening of the edit, which a screen draws as its sheet or dialog. */
export type EditSetOpeningState = {
  /** False while the form is on its way out: it keeps its numbers until then. */
  isOpen: boolean;
  /** Counted up on every press of a row, so a form still on its way out never carries its numbers into the next. */
  openingId: number;
  /** The unit the person trains in: the load is typed and shown in it, and stored in kilograms. */
  unit: LoadUnit;
  entry: EditSetOpening;
  /** Closes this opening only: a save or delete still on its way from an earlier one must not close a newer one. */
  close: () => void;
  /** Stores the changes. Resolves to whether they were stored. */
  save: (changes: SetChanges) => Promise<boolean>;
  /** Deletes the set with the Undo. Resolves to whether it was deleted. */
  remove: () => Promise<boolean>;
};

export type EditSet = {
  /** Opens the edit for the set. A set the session does not hold (it was removed meanwhile) opens nothing. */
  openSet: (setId: string) => void;
  /** The current opening once a set has been opened, and null before. */
  edit: EditSetOpeningState | null;
};

type Opening = {
  setId: string;
  entry: EditSetOpening;
  isOpen: boolean;
  openingId: number;
};

const patchOf = ({ loadKg, reps, rir }: SetChanges): SetPatch => ({
  ...(loadKg === undefined ? {} : { load_kg: loadKg }),
  ...(reps === undefined ? {} : { reps }),
  ...(rir === undefined ? {} : { rir }),
});

/**
 * What a session detail does with a set it is pressed on: opens the edit with the set's stored numbers, saves
 * what the person changed (`useUpdateSet`: the snapshot never changes) and deletes the set with the Undo
 * (`useRemoveSetWithUndo`). The opening holds the set as it was when it opened, since a deleted set leaves the
 * session while the form is still on its way out. Every write needs a connection: with none, nothing is
 * written and nothing is kept for later. A failure says the set did not save through `notices`, never what its
 * numbers were. A write already on its way is not asked for twice. The screen passes how it tells the person
 * (`notices`) and whether it may read yet (`enabled`).
 */
export function useEditSet(
  sessionId: string | undefined,
  { notices, enabled }: { notices: SetNotices; enabled: boolean },
): EditSet {
  const session = useSession(sessionId, { enabled });
  const timeZone = useProfileTimeZone({ enabled });
  const unit = useWeightUnit({ enabled });
  const updateSet = useUpdateSet();
  const removeSetWithUndo = useRemoveSetWithUndo(notices);
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
      notices.onFailure(SET_ENTRY.saveFailed);
      return false;
    }
    isSaving.current = true;
    try {
      await updateSet.mutateAsync({ id: setId, patch: patchOf(changes) });
      return true;
    } catch {
      notices.onFailure(SET_ENTRY.saveFailed);
      return false;
    } finally {
      isSaving.current = false;
    }
  }

  const unitData = unit.data;
  const edit: EditSetOpeningState | null =
    opening === null || unitData === undefined
      ? null
      : {
          isOpen: opening.isOpen,
          openingId: opening.openingId,
          unit: unitData,
          entry: opening.entry,
          close: () => {
            setOpening((current) =>
              current !== null && current.openingId === opening.openingId
                ? { ...current, isOpen: false }
                : current,
            );
          },
          save: (changes) => save(changes, opening.setId),
          remove: () => {
            const { exerciseName, setType, setNumber } = opening.entry;
            return removeSetWithUndo({ setId: opening.setId, exerciseName, setType, setNumber });
          },
        };

  return { openSet, edit };
}
