import { SET_ENTRY } from "@keylow/core/copy";
import { addedSetTime, isFullSessionRefusal, prefillNextSet } from "@keylow/core/training";
import { onlineManager, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { useAddSet } from "./useAddSet";
import { useSession } from "./useSession";
import { useWeightUnit } from "./useWeightUnit";
import { getLastPerformance } from "../repos/trainingSessions";

import type { SetNotices } from "./useRemoveSetWithUndo";
import type {
  LastPerformanceSet,
  LoadUnit,
  SetDraft,
  SetPrefill,
  SetType,
} from "@keylow/core/training";

/** The exercise a person picked: the id and name are all the entry needs. */
export type PickedExercise = { id: string; name: string };

/** The set the entry is opened for, and what it opens with. */
export type AddSetEntry = {
  exerciseId: string;
  exerciseName: string;
  /** The slot's own type, which the chosen type starts as. */
  setType: SetType;
  /** Its number among the exercise's working sets in the session, or the one it would have as one. */
  setNumber: number;
  /** An exercise added to a past session has no plan. */
  plan: null;
  /** The numbers the fields open with, and where they came from: `prefillNextSet`'s. */
  prefill: SetPrefill;
  /** The same set of the exercise's most recent earlier session: a past session draws none. */
  lastWeek: null;
};

/** A set to store, as the form holds it: the text of its numbers and the unit the load was typed in. */
export type SetLogRequest = {
  draft: SetDraft;
  unit: LoadUnit;
};

/** One opening of the entry, which a screen draws as its sheet or dialog. */
export type AddToPastSessionOpening = {
  /** False while the form is on its way out: it keeps its numbers until then. */
  isOpen: boolean;
  /** Counted up on every opening, so a form still on its way out never carries its numbers into the next. */
  openingId: number;
  /** The unit the person trains in: the load is typed and shown in it, and stored in kilograms. */
  unit: LoadUnit;
  entry: AddSetEntry;
  /** The type the set will be logged with: the entry's own at first, then the one `changeSetType` chose. A change leaves `openingId` as it is. */
  setType: SetType;
  changeSetType: (setType: SetType) => void;
  /** Closes this opening only: a write still on its way from an earlier one must not close a newer one. */
  close: () => void;
  /** Stores the set in the session. Resolves to whether it was stored. */
  logSet: (request: SetLogRequest) => Promise<boolean>;
};

export type AddToPastSession = {
  /** Opens the entry for the next set of an exercise the session holds, filled from the exercise's last set in it. */
  openAddSet: (exerciseId: string, exerciseName: string) => void;
  /** Opens the entry for the first set of a picked exercise, filled from the last time it was done, blank if that read fails. */
  chooseExercise: (exercise: PickedExercise) => Promise<void>;
  /** The current opening once a set has been opened and the person's unit is known, and null before. */
  add: AddToPastSessionOpening | null;
};

type Opening = {
  entry: AddSetEntry;
  setType: SetType;
  isOpen: boolean;
  openingId: number;
};

/** The sentence for a failed write: the full session has its own, and any other failure is the generic one, whatever it said. */
const messageOf = (error: unknown): string =>
  isFullSessionRefusal(error) ? SET_ENTRY.sessionFull : SET_ENTRY.saveFailed;

/**
 * What a session detail does to add to a past session: Add set opens the entry for the next set of an
 * exercise, filled from the exercise's last set in the session, and a picked exercise opens the entry for its
 * first set, filled from the last time it was done. A session holds sets and no exercises, so the picked
 * exercise exists once its first set is logged, and there is nothing to hold for it before.
 *
 * The set is stored inside the session, not at the press: `addedSetTime` puts it after the session's last set
 * and no later than the session's end, so the body map, the week and the history count it on the day of the
 * session. Every write needs a connection: with none, nothing is written and nothing is kept for later. A
 * failure keeps the entry and its numbers, and says through `notices` that the set did not save, or the rule
 * that refused it (a full session), never what its numbers were. A second press while a write is on its way
 * is answered by the form, which holds Log set until the first is, and by `useAddSet`, which joins it. The
 * screen passes how it tells the person (`notices`) and whether it may read yet (`enabled`).
 */
export function useAddToPastSession(
  sessionId: string | undefined,
  { notices, enabled }: { notices: Pick<SetNotices, "onFailure">; enabled: boolean },
): AddToPastSession {
  const session = useSession(sessionId, { enabled });
  const unit = useWeightUnit({ enabled });
  const client = useSupabase();
  const queryClient = useQueryClient();
  const addSet = useAddSet();
  const [opening, setOpening] = useState<Opening | null>(null);
  // Counted up on every pick and every Add set, so a last-time read that comes back after a later one began is dropped.
  const latestPick = useRef(0);

  const sessionData = session.data;
  const unitData = unit.data;

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

  async function chooseExercise({ id, name }: PickedExercise) {
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
      notices.onFailure(SET_ENTRY.saveFailed);
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
      notices.onFailure(messageOf(error));
      return false;
    }
  }

  const add: AddToPastSessionOpening | null =
    opening === null || unitData === undefined
      ? null
      : {
          isOpen: opening.isOpen,
          openingId: opening.openingId,
          unit: unitData,
          entry: opening.entry,
          setType: opening.setType,
          changeSetType: (setType) => {
            setOpening((current) =>
              current !== null && current.openingId === opening.openingId
                ? { ...current, setType }
                : current,
            );
          },
          close: () => {
            setOpening((current) =>
              current !== null && current.openingId === opening.openingId
                ? { ...current, isOpen: false }
                : current,
            );
          },
          logSet: (request) => logSet(opening.entry.exerciseId, request),
        };

  return {
    openAddSet: (exerciseId, exerciseName) => {
      latestPick.current += 1;
      open(exerciseId, exerciseName, []);
    },
    chooseExercise,
    add,
  };
}
