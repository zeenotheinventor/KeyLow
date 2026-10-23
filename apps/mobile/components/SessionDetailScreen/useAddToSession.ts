import {
  getLastPerformance,
  keys,
  useAddSet,
  useSession,
  useSupabase,
  useWeightUnit,
} from "@keylow/api-client";
import { SET_ENTRY } from "@keylow/core/copy";
import { addedSetTime, isFullSessionRefusal, prefillNextSet } from "@keylow/core/training";
import { onlineManager, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { useToast } from "../ui";

import type { AddExerciseSheetProps, ChosenExercise } from "../AddExerciseSheet";
import type { SetEntrySheetProps, SetLogRequest } from "../SetEntrySheet";
import type { LastPerformanceSet } from "@keylow/api-client";
import type { SetType } from "@keylow/core/training";

type Opening = {
  /** The set entry the sheet was opened with, kept while the sheet closes so it does not change under its exit. */
  entry: SetEntrySheetProps["entry"];
  /** The type the set will be logged with: the entry's own at first, then the Set type control's. A change leaves `openingId` as it is. */
  setType: SetType;
  isOpen: boolean;
  /** Counted up on every opening, so a form still on its way out never carries its numbers into the next. */
  openingId: number;
};

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

/** The sentence for a failed write: the full session has its own, and any other failure is the generic one, whatever it said. */
const messageOf = (error: unknown): string =>
  isFullSessionRefusal(error) ? SET_ENTRY.sessionFull : SET_ENTRY.saveFailed;

/**
 * What the session detail does to add to a past session: Add set opens the set entry for the next set of an
 * exercise, filled from the exercise's last set in the session, and Add exercise opens the picker, whose pick
 * opens the entry for the exercise's first set, filled from the last time it was done. A session holds sets
 * and no exercises, so the picked exercise exists once its first set is logged, and there is nothing to hold
 * for it before.
 *
 * The set is stored inside the session, not at the press: `addedSetTime` puts it after the session's last set
 * and no later than the session's end, so the body map, the week and the history count it on the day of the
 * session. Every write needs a connection: with none, nothing is written and nothing is kept for later. A
 * failure keeps the sheet and its numbers, and says the set did not save, or the rule that refused it (a
 * full session), never what its numbers were. A second press while a write is on its way is answered by
 * the form, which holds Log set until the first is, and by `useAddSet`, which joins it.
 */
export function useAddToSession(sessionId: string | undefined): AddToSession {
  const enabled = useReadsEnabled();
  const session = useSession(sessionId, { enabled });
  const unit = useWeightUnit({ enabled });
  const client = useSupabase();
  const queryClient = useQueryClient();
  const toast = useToast();
  const addSet = useAddSet();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [opening, setOpening] = useState<Opening | null>(null);
  // Counted up on every pick and every Add set, so a last-time read that comes back after a later one began is dropped.
  const latestPick = useRef(0);

  const sessionData = session.data;
  const unitData = unit.data;

  const showFailure = (message: string = SET_ENTRY.saveFailed) => {
    toast.show({ message, tone: "danger", icon: "CircleAlert" });
  };

  function open(
    exerciseId: string,
    exerciseName: string,
    previousSets: readonly LastPerformanceSet[],
  ) {
    if (sessionData === undefined || sessionData === null) {
      return;
    }
    const workingSetsHeld = sessionData.sets.filter(
      (set) => set.exercise_id === exerciseId && set.set_type !== "warmup",
    ).length;
    setOpening((current) => ({
      isOpen: true,
      openingId: (current?.openingId ?? 0) + 1,
      setType: "working",
      entry: {
        exerciseId,
        exerciseName,
        setType: "working",
        setNumber: workingSetsHeld + 1,
        plan: null,
        prefill: prefillNextSet(exerciseId, sessionData.sets, previousSets),
        lastWeek: null,
      },
    }));
  }

  async function chooseExercise({ id, name }: ChosenExercise) {
    latestPick.current += 1;
    const thisPick = latestPick.current;
    // The last time is a read for the prefill alone, so with no connection (or if it fails) the entry opens blank.
    let previousSets: readonly LastPerformanceSet[] = [];
    if (onlineManager.isOnline() && sessionId !== undefined) {
      try {
        const [latest] = await queryClient.query({
          queryKey: keys.training.lastPerformance(id, sessionId),
          queryFn: () =>
            getLastPerformance(client, id, { excludeSessionId: sessionId, sessions: 2 }),
        });
        previousSets = latest?.sets ?? [];
      } catch {
        previousSets = [];
      }
    }
    if (thisPick === latestPick.current) {
      open(id, name, previousSets);
    }
  }

  async function logSet(exerciseId: string, { draft, unit: typedUnit }: SetLogRequest) {
    if (
      !onlineManager.isOnline() ||
      sessionId === undefined ||
      sessionData === undefined ||
      sessionData === null
    ) {
      showFailure();
      return false;
    }
    try {
      await addSet.mutateAsync({
        sessionId,
        exerciseId,
        draft,
        unit: typedUnit,
        effortMode: "rir",
        now: addedSetTime(sessionData, sessionData.sets, new Date()),
      });
      return true;
    } catch (error) {
      showFailure(messageOf(error));
      return false;
    }
  }

  const sheet: SetEntrySheetProps | null =
    opening === null || sessionId === undefined || unitData === undefined
      ? null
      : {
          open: opening.isOpen,
          openingId: opening.openingId,
          sessionId,
          unit: unitData,
          entry: opening.entry,
          setType: opening.setType,
          // A change of type keeps the opening, so what was typed stays. There is no set number to press here, so the control is the only way.
          onChangeSetType: (setType) => {
            setOpening((current) =>
              current !== null && current.openingId === opening.openingId
                ? { ...current, setType }
                : current,
            );
          },
          // Closes this opening only: a write still on its way from an earlier one must not close a newer sheet.
          onClose: () => {
            setOpening((current) =>
              current !== null && current.openingId === opening.openingId
                ? { ...current, isOpen: false }
                : current,
            );
          },
          onLogSet: (request) => logSet(opening.entry.exerciseId, request),
        };

  return {
    openAddSet: (exerciseId, exerciseName) => {
      latestPick.current += 1;
      open(exerciseId, exerciseName, []);
    },
    openPicker: () => {
      setIsPickerOpen(true);
    },
    picker: {
      mode: "session",
      open: isPickerOpen,
      onAddToSession: (exercise) => {
        void chooseExercise(exercise);
      },
      onClose: () => {
        setIsPickerOpen(false);
      },
    },
    sheet,
  };
}
