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
import type { HistoryPlanDay, LoadUnit } from "@keylow/core/training";

/** The time of the latest set, or null for none. Every set is a live one, since the read leaves the removed ones out. */
const latestSetTime = (sets: SessionWithSets["sets"]): string | null =>
  sets.reduce<string | null>(
    (latest, { performed_at }) =>
      latest === null || Date.parse(performed_at) > Date.parse(latest) ? performed_at : latest,
    null,
  );

/**
 * What the session detail draws, from the session and the routine day it was planned from (when the active
 * routine still holds it): core's summary of the session, its three cards, and each exercise with its sets.
 * The exercises are in the order they were first logged, and a set is "not in the plan" when its number is
 * beyond the sets the plan targets for the exercise, which is the sets logged less the sets over.
 */
export function describeSessionDetail(
  session: SessionWithSets,
  plannedDay: HistoryPlanDay | undefined,
  unit: LoadUnit,
  timeZone: string,
): SessionDetailContent {
  const summary = summariseSession(session, session.sets, plannedDay);
  const setsOverByExercise = new Map(
    summary.planComparison?.setsOverPlan.map(({ exerciseId, setsOver }) => [exerciseId, setsOver]),
  );

  return {
    title: describeHistorySessionName(session.routine_day_name),
    when: describeSessionWhen({
      localDate: session.local_date,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      tz: timeZone,
    }),
    stats: describeSessionStats(summary),
    // A session still open has no end, so its heat is read at its latest set. The sets are listed by position, not by time.
    musclesTrained: {
      sets: session.sets,
      at: session.ended_at ?? latestSetTime(session.sets) ?? session.started_at,
    },
    exercises: sessionExercises(null, session.sets).flatMap(({ exerciseId, rows }) => {
      const logged = rows.flatMap(({ set, setType, setNumber }) =>
        set === null ? [] : [{ set, setType, setNumber }],
      );
      const first = logged[0];
      if (first === undefined) {
        return [];
      }
      const workingCount = logged.filter(({ setType }) => setType !== "warmup").length;
      const setsOver = setsOverByExercise.get(exerciseId) ?? 0;

      return [
        {
          exerciseId,
          name: first.set.snapshot.name,
          note: describeSessionExerciseNote({
            isBodyweight: logged.every(({ set }) => set.load_kg === null),
            setsOver,
          }),
          rows: logged.map(({ set, setType, setNumber }) => {
            const isNotInPlan = setNumber > workingCount - setsOver;

            return {
              key: set.id,
              setType,
              isNotInPlan,
              copy: describeHistorySet({
                setType,
                setNumber,
                loadKg: set.load_kg,
                reps: set.reps,
                rir: set.rir,
                isNotInPlan,
                unit,
              }),
            };
          }),
        },
      ];
    }),
  };
}
