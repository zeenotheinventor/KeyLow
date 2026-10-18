import { loggedSets } from "./goldenWeekInputs";
import { rowId } from "./historyRows";
import goldenWeek from "../fixtures/training/goldenWeek.json";

import type { WorkoutSetRow } from "../../src/schemas";
import type { HeatSet } from "../../src/training";

/*
 * The sets of the golden week as full `workout_sets` rows for the live session tests: the heat inputs
 * of `goldenWeekInputs` (snapshot, effort and time) with the fields it leaves out (exercise, position,
 * reps and load), read from the same fixture. A set's position is its place in its own session.
 */

export type SessionSet = HeatSet &
  Pick<WorkoutSetRow, "id" | "exercise_id" | "position" | "reps" | "load_kg">;

const exerciseIdOf = (sourceRef: string): string => {
  const exercise = goldenWeek.exercises.find((candidate) => candidate.sourceRef === sourceRef);
  if (exercise === undefined) {
    throw new Error("The golden fixture names an exercise it does not hold");
  }
  return exercise.id;
};

const positionInSession = new Map<string, number>();

const goldenSessionSets: { sessionId: string; set: SessionSet }[] = goldenWeek.sets.map(
  (fixtureSet, index) => {
    const logged = loggedSets[index];
    if (logged === undefined) {
      throw new Error("The golden inputs hold fewer sets than the fixture");
    }
    const position = positionInSession.get(fixtureSet.sessionId) ?? 0;
    positionInSession.set(fixtureSet.sessionId, position + 1);
    return {
      sessionId: fixtureSet.sessionId,
      set: {
        id: rowId(5, index + 1),
        exercise_id: exerciseIdOf(fixtureSet.exercise),
        position,
        set_type: logged.set_type,
        reps: fixtureSet.reps,
        load_kg: fixtureSet.loadKg,
        rir: logged.rir,
        rpe: logged.rpe,
        performed_at: logged.performed_at,
        deleted_at: null,
        snapshot: logged.snapshot,
      },
    };
  },
);

const setsOfSession = (sessionId: string): SessionSet[] =>
  goldenSessionSets.filter((entry) => entry.sessionId === sessionId).map((entry) => entry.set);

/** Pull on Tuesday 13 October: 17 working sets and 1 warm-up, lat pulldown 5 against a target of 3. */
export const goldenPullSets: SessionSet[] = setsOfSession("00000004-0000-4000-8000-000000000002");

/** Legs on Thursday 15 October at 19:00: 8 working sets and 2 warm-ups. */
export const goldenLegsSets: SessionSet[] = setsOfSession("00000004-0000-4000-8000-000000000003");

/** The exercises of the golden Legs day, by the ids of the fixture. */
export const SQUAT_ID = "00000001-0000-4000-8000-000000000011";
export const ROMANIAN_DEADLIFT_ID = "00000001-0000-4000-8000-000000000012";
export const LEG_PRESS_ID = "00000001-0000-4000-8000-000000000013";
export const SEATED_LEG_CURL_ID = "00000001-0000-4000-8000-000000000014";
export const STANDING_CALF_RAISE_ID = "00000001-0000-4000-8000-000000000015";
export const LAT_PULLDOWN_ID = "00000001-0000-4000-8000-000000000008";
