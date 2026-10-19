import { useLastPerformance } from "@keylow/api-client";
import { describeSetColumns, describeSetRow } from "@keylow/core/copy";
import { exerciseSetRows } from "@keylow/core/training";

import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { ExerciseCard } from "../ExerciseCard";

import type { SessionExerciseCardProps } from "./types";

/**
 * One exercise of the session in progress: its card, with the Previous column read from the exercise's latest
 * earlier session. That read is not saved on the phone, so with no connection (or until it arrives, or if it
 * fails) every Previous is an en dash and the rest of the card is unchanged.
 */
export function SessionExerciseCard({
  sessionId,
  name,
  target,
  unit,
  exercise,
  sessionSets,
}: SessionExerciseCardProps) {
  const enabled = useReadsEnabled();
  const lastPerformance = useLastPerformance(exercise.exerciseId, {
    enabled,
    excludeSessionId: sessionId,
  });
  const [latestSession] = lastPerformance.data ?? [];
  const rows = exerciseSetRows(exercise, sessionSets, latestSession?.sets ?? []);

  return (
    <ExerciseCard
      columns={describeSetColumns(unit)}
      name={name}
      rows={rows.map(({ setId, state, setType, setNumber, previous, entry }) => ({
        key: setId ?? `planned-${setNumber}`,
        state,
        setType,
        copy: describeSetRow({ setType, setNumber, unit, previous, entry }),
      }))}
      target={target}
    />
  );
}
