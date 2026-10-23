import {
  describeHistorySessionName,
  describeHistorySet,
  describeSessionExerciseNote,
  describeSessionStats,
  describeSessionWhen,
} from "@keylow/core/copy";
import { sessionExercises, summariseSession } from "@keylow/core/training";

import type { SessionDetailContent } from "./types";
import type { SessionWithSets } from "@keylow/api-client";
import type { LoadUnit } from "@keylow/core/training";

/** The time of the latest set, or null for none. Every set is a live one, since the read leaves the removed ones out. */
const latestSetTime = (sets: SessionWithSets["sets"]): string | null =>
  sets.reduce<string | null>(
    (latest, { performed_at }) =>
      latest === null || Date.parse(performed_at) > Date.parse(latest) ? performed_at : latest,
    null,
  );

/**
 * What the session detail draws, from the session alone: core's summary of the session, its three cards
 * (Time, Sets and Exercises), and each exercise with its sets. The exercises are in the order they were first
 * logged. Nothing is compared with a routine, so the detail reads the same whatever became of the routine the
 * session followed.
 */
export function describeSessionDetail(
  session: SessionWithSets,
  unit: LoadUnit,
  timeZone: string,
): SessionDetailContent {
  const summary = summariseSession(session, session.sets);
  const exercises = sessionExercises(null, session.sets).flatMap(({ exerciseId, rows }) => {
    const logged = rows.flatMap(({ set, setType, setNumber }) =>
      set === null ? [] : [{ set, setType, setNumber }],
    );
    const first = logged[0];
    if (first === undefined) {
      return [];
    }

    return [
      {
        exerciseId,
        name: first.set.snapshot.name,
        note: describeSessionExerciseNote({
          isBodyweight: logged.every(({ set }) => set.load_kg === null),
        }),
        rows: logged.map(({ set, setType, setNumber }) => ({
          key: set.id,
          setType,
          copy: describeHistorySet({
            setType,
            setNumber,
            loadKg: set.load_kg,
            reps: set.reps,
            rir: set.rir,
            unit,
          }),
        })),
      },
    ];
  });

  return {
    title: describeHistorySessionName(session.routine_day_name),
    when: describeSessionWhen({
      localDate: session.local_date,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      tz: timeZone,
    }),
    stats: describeSessionStats(summary, exercises.length),
    // A session still open has no end, so its heat is read at its latest set. The sets are listed by position, not by time.
    musclesTrained: {
      sets: session.sets,
      at: session.ended_at ?? latestSetTime(session.sets) ?? session.started_at,
    },
    exercises,
  };
}
