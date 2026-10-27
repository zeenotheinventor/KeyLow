import type { PlanRoutine } from "./expandPlan";
import type { MuscleId } from "./muscles";
import type { VolumeBands } from "./params";
import type { WeekDayStatus } from "./weekPlanDays";

/*
 * The two things the muscle sheet's words need that a muscle detail does not hold: which sessions of the
 * plan are still to come, and an exercise that makes the weighting note concrete. The branching lives here
 * so the screen only passes rows in and the copy only writes the sentence.
 */

/** A day of the week as the body map holds it. */
type UpcomingDay = Readonly<{
  date: string;
  status: WeekDayStatus;
  plannedDayName: string | null;
}>;

const UPCOMING_STATUSES: readonly WeekDayStatus[] = ["today", "planned"];

/** The sessions of the plan still to come, in date order: planned days, and today when it is not started. */
export const upcomingSessionsOf = (
  days: readonly UpcomingDay[],
): { localDate: string; routineDayName: string | null }[] =>
  days
    .filter(({ status }) => UPCOMING_STATUSES.includes(status))
    .map(({ date, plannedDayName }) => ({ localDate: date, routineDayName: plannedDayName }));

/**
 * The first exercise of the routine, in day and position order, that works the muscle at more than 0 and
 * less than a whole set, named in lower case with its weight. Null when there is none, and the note then
 * drops its example.
 */
export const weightingExampleOf = (
  routine: PlanRoutine | null,
  muscle: MuscleId,
): { exerciseName: string; weight: number } | null => {
  for (const day of routine?.days ?? []) {
    for (const { exercise, muscles } of day.exercises) {
      const entry = muscles.find(
        ({ muscle_id: id, weight }) => id === muscle && weight > 0 && weight < 1,
      );
      if (entry !== undefined) {
        return { exerciseName: exercise.name.toLowerCase(), weight: entry.weight };
      }
    }
  }
  return null;
};

/**
 * The sets the weekly sets bar's track runs to: the top of the High band and a fifth more, so a muscle
 * just past 20 sets is still on the track. A figure beyond it is held at the end. The draft of the
 * `body · muscle-sheet` board draws 24, and the board wins if it settles on another number.
 */
const SETS_BAR_TRACK_SETS = 24;

/** Where each mark of the weekly sets bar sits along its track, as a share of the track from 0 to 1. */
export type SetsBarPositions = Readonly<{
  done: number;
  planned: number;
  /** Where Growing starts, Productive starts, and High starts (above). */
  growingFrom: number;
  productiveFrom: number;
  highAbove: number;
}>;

const shareOf = (sets: number): number => Math.min(Math.max(sets / SETS_BAR_TRACK_SETS, 0), 1);

/** The marks of the weekly sets bar: the sets done, the sets planned, and the three edges of the bands. */
export const setsBarPositionsOf = ({
  actual,
  planned,
  bands,
}: {
  actual: number;
  planned: number;
  bands: VolumeBands;
}): SetsBarPositions => ({
  done: shareOf(actual),
  planned: shareOf(planned),
  growingFrom: shareOf(bands.growingFromSets),
  productiveFrom: shareOf(bands.productiveFromSets),
  highAbove: shareOf(bands.highAboveSets),
});
