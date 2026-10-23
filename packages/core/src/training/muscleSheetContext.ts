import type { PlanRoutine } from "./expandPlan";
import type { MuscleId } from "./muscles";
import type { VolumeLandmarks } from "./params";
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

/** Which edge of its anchor a label hangs from: its start at the anchor, its middle on it, or its end at it. */
export type LabelAnchor = "start" | "centre" | "end";

/** Where each mark of the weekly sets bar sits along its track, as a share of the track from 0 to 1, and its labels. */
export type SetsBarPositions = Readonly<{
  done: number;
  planned: number;
  minimum: number;
  /** The start of the productive range, where the target band begins. */
  bandStart: number;
  bandEnd: number;
  /**
   * How the planned label sits at its mark: a label near the start or the end hangs from the edge so it
   * never overflows. The Min label is always centred on its mark, because the minimum of every size class
   * of the training params is between a quarter and four tenths of the maximum, well clear of both ends.
   */
  plannedLabel: LabelAnchor;
  /** True when the planned label would meet the Min, 0 or Max label on the row under the bar, so it takes a row of its own. */
  isPlannedLabelBelow: boolean;
}>;

// A label is about a fifth of a phone's bar wide (72 points of about 358), so half of it is a tenth.
// The share of the track at each end where a centred label would overflow, and the gap between two marks
// under which their labels would meet.
const EDGE_SHARE = 0.12;
const LABELS_MEET_SHARE = 0.12;
// The share beyond which a centred planned label meets the Max label, which hangs from the end of the track
// and is about an eighth of it wide: the end, less the Max label and less half the planned label.
const PLANNED_MEETS_MAXIMUM_SHARE = 0.775;

const shareOf = (sets: number, maximum: number): number =>
  maximum > 0 ? Math.min(Math.max(sets / maximum, 0), 1) : 0;

const anchorOf = (share: number): LabelAnchor => {
  if (share < EDGE_SHARE) {
    return "start";
  }
  return share > 1 - EDGE_SHARE ? "end" : "centre";
};

/**
 * The marks of the weekly sets bar and how their labels sit. The track runs from 0 to the maximum, so a
 * figure above it is held at the end of the track. A track with no maximum puts every mark at the start.
 */
export const setsBarPositionsOf = ({
  actual,
  planned,
  target,
}: {
  actual: number;
  planned: number;
  target: VolumeLandmarks;
}): SetsBarPositions => {
  const plannedShare = shareOf(planned, target.mrv);
  const minimumShare = shareOf(target.mev, target.mrv);
  const plannedAnchor = anchorOf(plannedShare);

  return {
    done: shareOf(actual, target.mrv),
    planned: plannedShare,
    minimum: minimumShare,
    bandStart: shareOf(target.mav.low, target.mrv),
    bandEnd: shareOf(target.mav.high, target.mrv),
    plannedLabel: plannedAnchor,
    isPlannedLabelBelow:
      plannedAnchor !== "centre" ||
      plannedShare > PLANNED_MEETS_MAXIMUM_SHARE ||
      Math.abs(plannedShare - minimumShare) < LABELS_MEET_SHARE,
  };
};
