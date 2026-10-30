import { useLastPerformance } from "@keylow/api-client";
import {
  describeSetColumns,
  describeSetEntryName,
  describeSetRow,
  describeSetTypeSheet,
} from "@keylow/core/copy";
import {
  exerciseSetRows,
  prefillNextSet,
  sameAgain,
  setValuesOfPrefill,
} from "@keylow/core/training";
import { useState } from "react";

import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { ExerciseCard } from "../ExerciseCard";

import type { SessionExerciseCardProps } from "./types";
import type { ExerciseCardRow } from "../ExerciseCard";
import type { SetRowEntry } from "@keylow/core/copy";
import type { SetPrefill, SetType, SetValues } from "@keylow/core/training";

/** The prefill that opens the set entry with the numbers a row shows: the inverse of `setValuesOfPrefill`. The row's own type travels separately, as the type the entry starts on. */
function prefillOfValues({ loadKg, reps, rir, rpe }: SetValues): SetPrefill {
  return {
    load_kg: loadKg,
    reps,
    rir,
    rpe,
    set_type: "working",
    source: "session",
  };
}

/**
 * One exercise of the session in progress: its card, with the Previous column read from the exercise's latest
 * earlier session. That read is not saved on the phone, so with no connection (or until it arrives, or if it
 * fails) every Previous is an en dash and the rest of the card is unchanged. The cells of a set still to do
 * open the set entry, which the screen hosts, for the exercise's next free slot and with the numbers it is
 * filled from. The cells of an added row (see below) open it the same way, but with the numbers and the type
 * the row shows, so they can be changed before the set is logged.
 *
 * The mark of a logged set opens the set types sheet, which the screen hosts, for that set: its number is the
 * one it has among the working sets, or would have as one. A set still being saved has no stored id, so its
 * mark does nothing until it is stored, as its check does, and nor does the mark of a set whose type is
 * being changed, until that write lands.
 *
 * The check of a row to log writes the numbers the next row opens with (`prefillNextSet`), and the check of a
 * logged row removes it. A row with no numbers to log opens that same set entry from its check. Add set adds
 * one more row, filled with the same again of the exercise's last set (its type, load, reps and effort), or
 * as the next row is when nothing is logged yet. The added rows are kept as the fewest rows the card must
 * show: logging any set raises the sets done and leaves the rows as many, and a row added while none is left
 * to log stays until a set is logged. The body icon button in the header, and the name, ask the screen to
 * show the muscles the exercise works.
 */
export function SessionExerciseCard({
  sessionId,
  name,
  target,
  plan,
  unit,
  exercise,
  sessionSets,
  isChangingType,
  logging,
  onEditSet,
  onEditSetType,
  onShowMuscles,
}: SessionExerciseCardProps) {
  const enabled = useReadsEnabled();
  const lastPerformance = useLastPerformance(exercise.exerciseId, {
    enabled,
    excludeSessionId: sessionId,
  });
  const [minimumRows, setMinimumRows] = useState(0);
  const [latestSession] = lastPerformance.data ?? [];
  const previousSets = latestSession?.sets ?? [];
  const { exerciseId } = exercise;
  const rows = exerciseSetRows(exercise, sessionSets, previousSets);
  const prefill = prefillNextSet(exerciseId, sessionSets, previousSets);
  const valuesToLog = setValuesOfPrefill(prefill);
  const lastSet = exercise.rows.flatMap(({ set }) => (set === null ? [] : [set])).at(-1);
  const valuesToAdd = lastSet === undefined ? valuesToLog : sameAgain(lastSet);
  const addedCount = Math.max(minimumRows - rows.length, 0);
  // A set is logged as the next free slot of its exercise, whichever row was pressed, so that is the set the
  // entry opens for: its number, and the same set of the earlier session.
  const nextFreeSlot = rows.find((row) => row.state !== "done");

  // A row that shows its own numbers (an added row) passes them as `shown`, and the entry opens with those and
  // their type. Without them it opens with the slot's type and the numbers the next set is filled from.
  const openEntry = (setType: SetType, setNumber: number, shown: SetValues | null = null) => {
    const slot = nextFreeSlot ?? { setType, setNumber, previous: null };
    onEditSet({
      exerciseId,
      exerciseName: name,
      setType: shown?.setType ?? slot.setType,
      setNumber: slot.setNumber,
      plan,
      prefill: shown === null ? prefill : prefillOfValues(shown),
      lastWeek: slot.previous,
    });
  };

  const checkOf = (
    values: SetValues | null,
    setType: SetType,
    setNumber: number,
  ): ExerciseCardRow["onCheck"] =>
    values === null
      ? () => {
          openEntry(setType, setNumber);
        }
      : () => {
          logging.logSet({ exerciseId, values });
        };

  // Removing a set takes a row away only when the sets done are beyond the plan, or it is a warm-up (which
  // the plan never counts), so only then does the fewest rows the card must show come down with it.
  const workingDoneCount = rows.filter(
    ({ state, setType }) => state === "done" && setType !== "warmup",
  ).length;
  const removalTakesARow = (setType: SetType) =>
    setType === "warmup" || plan === null || workingDoneCount > plan.sets;

  const loggedRows = rows.map(
    ({ setId, state, setType, setNumber, previous, entry }, index): ExerciseCardRow => {
      const copy = describeSetRow({ setType, setNumber, unit, previous, entry });
      if (setId === null) {
        return {
          key: `planned-${setNumber}`,
          state,
          setType,
          copy,
          edit: {
            name: describeSetEntryName(name, setType, setNumber),
            onPress: () => {
              openEntry(setType, setNumber);
            },
          },
          onCheck: checkOf(valuesToLog, setType, setNumber),
        };
      }
      // A warm-up has no number of its own, so it is shown the one it would have as a working set.
      const workingNumber =
        setType === "warmup"
          ? rows.slice(0, index).filter((row) => row.setType !== "warmup").length + 1
          : setNumber;
      return {
        key: setId,
        state,
        setType,
        copy,
        typeEdit:
          logging.isSaving(setId) || isChangingType(setId)
            ? undefined
            : {
                name: describeSetTypeSheet({
                  exerciseName: name,
                  setType,
                  setNumber: workingNumber,
                }).accessibleName,
                onPress: () => {
                  onEditSetType({ setId, exerciseName: name, setType, setNumber: workingNumber });
                },
              },
        onCheck: logging.isSaving(setId)
          ? undefined
          : () => {
              if (removalTakesARow(setType)) {
                setMinimumRows((current) => Math.max(current - 1, 0));
              }
              logging.removeSet({ setId, exerciseName: name, setType, setNumber });
            },
      };
    },
  );

  const workingRowCount = rows.filter(({ setType }) => setType !== "warmup").length;
  const addedRows = Array.from({ length: addedCount }, (_, index): ExerciseCardRow => {
    const setType = valuesToAdd?.setType ?? "working";
    const workingNumber = workingRowCount + index + 1;
    const setNumber = setType === "warmup" ? 0 : workingNumber;
    const entry: SetRowEntry =
      valuesToAdd === null
        ? { state: "empty" }
        : { state: "ready", loadKg: valuesToAdd.loadKg, reps: valuesToAdd.reps };

    return {
      key: `added-${index + 1}`,
      state: "todo",
      setType,
      copy: describeSetRow({ setType, setNumber, unit, previous: null, entry }),
      edit: {
        name: describeSetEntryName(name, setType, setNumber),
        onPress: () => {
          // With nothing logged yet the row's numbers are the next set's own, so the entry says where they came from.
          // A warm-up has no number, so the entry gets the one it would have as a working set.
          openEntry(setType, workingNumber, lastSet === undefined ? null : valuesToAdd);
        },
      },
      onCheck: checkOf(valuesToAdd, setType, setNumber),
    };
  });

  return (
    <ExerciseCard
      columns={describeSetColumns(unit)}
      name={name}
      rows={[...loggedRows, ...addedRows]}
      target={target}
      onAddSet={() => {
        setMinimumRows(rows.length + addedCount + 1);
      }}
      onShowMuscles={onShowMuscles}
    />
  );
}
