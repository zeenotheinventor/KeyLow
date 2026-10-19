import { useLastPerformance } from "@keylow/api-client";
import { describeSetColumns, describeSetEntryName, describeSetRow } from "@keylow/core/copy";
import { exerciseSetRows, prefillNextSet } from "@keylow/core/training";

import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { ExerciseCard } from "../ExerciseCard";

import type { SessionExerciseCardProps } from "./types";

/**
 * One exercise of the session in progress: its card, with the Previous column read from the exercise's latest
 * earlier session. That read is not saved on the phone, so with no connection (or until it arrives, or if it
 * fails) every Previous is an en dash and the rest of the card is unchanged. The cells of a set still to do
 * open the set entry, which the screen hosts, for the exercise's next free slot and with the numbers it is
 * filled from.
 */
export function SessionExerciseCard({
  sessionId,
  name,
  target,
  plan,
  unit,
  exercise,
  sessionSets,
  onEditSet,
}: SessionExerciseCardProps) {
  const enabled = useReadsEnabled();
  const lastPerformance = useLastPerformance(exercise.exerciseId, {
    enabled,
    excludeSessionId: sessionId,
  });
  const [latestSession] = lastPerformance.data ?? [];
  const previousSets = latestSession?.sets ?? [];
  const rows = exerciseSetRows(exercise, sessionSets, previousSets);
  // A set is logged as the next free slot of its exercise, whichever row was pressed, so that is the set the
  // entry opens for: its number, and the same set of the earlier session.
  const nextFreeSlot = rows.find((row) => row.state !== "done");

  return (
    <ExerciseCard
      columns={describeSetColumns(unit)}
      name={name}
      rows={rows.map(({ setId, state, setType, setNumber, previous, entry }) => ({
        key: setId ?? `planned-${setNumber}`,
        state,
        setType,
        copy: describeSetRow({ setType, setNumber, unit, previous, entry }),
        edit:
          state === "done" || nextFreeSlot === undefined
            ? undefined
            : {
                name: describeSetEntryName(name, setType, setNumber),
                onPress: () => {
                  onEditSet({
                    exerciseId: exercise.exerciseId,
                    exerciseName: name,
                    setType: nextFreeSlot.setType,
                    setNumber: nextFreeSlot.setNumber,
                    plan,
                    prefill: prefillNextSet(exercise.exerciseId, sessionSets, previousSets),
                    lastWeek: nextFreeSlot.previous,
                  });
                },
              },
      }))}
      target={target}
    />
  );
}
