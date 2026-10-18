import { heatPercentOf, heatStepOf, parseInstant, readyInHoursOf } from "./heatReadout";
import { muscleParams, parseMoment, volumeStatusOf } from "./muscleState";
import { setEffort } from "./setEffort";
import { targetedMuscles } from "./targetedMuscles";
import { isValidTimeZone } from "../dates/isValidTimeZone";
import { toLocalDate } from "../dates/toLocalDate";

import type { CompareParams } from "./compareParams";
import type { MusclePlanComparison } from "./compareWeek";
import type { MuscleId } from "./muscles";
import type { MuscleState, VolumeStatus } from "./muscleState";
import type { VolumeLandmarks } from "./params";
import type { LoggedSet } from "./projectWeek";
import type { TargetedMusclesInput } from "./targetedMuscles";
import type { SetSnapshot } from "../schemas/training";

/*
 * The muscle detail sheet of the body map (`body · muscle-sheet`, `body · muscle-sheet-not-targeted`) as
 * data: heat, ready in, sets this week against the target, why a muscle is not targeted, and when it was
 * last trained. Pure under the ADR 0002 rule: `now` is an argument. The screen writes its sentences from
 * these fields, so no maths lives in it.
 */

/** The view the sheet is opened from. Only the volume status depends on it. */
export type MuscleDetailView = "actual" | "projected";

/** A logged set with the exercise it was taken from, which a snapshot freezes with the set. */
export type MuscleDetailSet = LoggedSet & { snapshot: Pick<SetSnapshot, "ref" | "name"> };

/** The routine day a logged session was done as, by name, or null when it was not a routine day. */
export type MuscleDetailSession = Readonly<{ id: string; routine_day_name: string | null }>;

export type MuscleDetailInput = Readonly<{
  muscle: MuscleId;
  /** Heat and ready time of every muscle at `now`: Actual from `muscleState`, or Projected from `projectedState`. */
  state: Readonly<Record<MuscleId, Pick<MuscleState, "heat" | "readyAt">>>;
  /** `compareWeek` for the calendar week that holds `now`. */
  comparison: Readonly<
    Record<MuscleId, Pick<MusclePlanComparison, "actualWeeklySets" | "projectedWeeklySets">>
  >;
  /** The logged sets, of any week: the last trained entry reads back to the heat window. */
  sets: readonly MuscleDetailSet[];
  sessions: readonly MuscleDetailSession[];
  /** What `targetedMuscles` reads: the active routine and the goal's priority. */
  targeted: TargetedMusclesInput;
  view: MuscleDetailView;
  now: string;
  /** The user's IANA zone, which decides what day a set belongs to. */
  tz: string;
  params: CompareParams;
}>;

/** Where a figure sits against the target range, the productive range of 10 to 16 sets for a small muscle. */
export type RangePosition = "below" | "inside" | "above";

export type WeeklySetsDetail = {
  /** Effort-weighted sets logged this calendar week. */
  actual: number;
  /** Effort-weighted sets of the week's plan, the logged days in place of planned ones. */
  planned: number;
  /** The muscle's landmarks: its minimum, the productive range and its maximum. */
  target: VolumeLandmarks;
  actualPosition: RangePosition;
  plannedPosition: RangePosition;
  /** The status of the actual figure in the actual view, and of the planned one in the projected view. */
  volumeStatus: VolumeStatus;
};

export type LastTrainedExercise = {
  exerciseId: string;
  name: string;
  /** Sets of the exercise that day that worked the muscle, a warm-up left out. */
  sets: number;
};

export type LastTrained = {
  /** The user's calendar day, `YYYY-MM-DD`. */
  localDate: string;
  /** The session of the newest set that day. */
  sessionId: string;
  /** The routine day the session was done as, or null. */
  routineDayName: string | null;
  /** The exercises that worked the muscle that day, the one with the most sets first. */
  exercises: LastTrainedExercise[];
};

export type MuscleDetail = {
  muscle: MuscleId;
  heatPercent: number;
  heatStep: number;
  /** Whole hours until the muscle is ready, and 0 when it is ready now. */
  readyInHours: number;
  weeklySets: WeeklySetsDetail;
  targeting: {
    targeted: boolean;
    /** Some exercise of the routine holds the muscle in its map with a weight above 0. */
    routineTrains: boolean;
    /** The goal ranks the muscle above 0. */
    goalRanks: boolean;
  };
  /** The newest day of the heat window that worked the muscle, or null when none did. */
  lastTrained: LastTrained | null;
};

const MILLISECONDS_PER_DAY = 24 * 3_600_000;

const positionOf = (sets: number, { mav }: VolumeLandmarks): RangePosition => {
  if (sets < mav.low) {
    return "below";
  }
  return sets <= mav.high ? "inside" : "above";
};

const routineTrains = (routine: TargetedMusclesInput["routine"], muscle: MuscleId): boolean =>
  routine?.days.some((day) =>
    day.exercises.some((exercise) =>
      exercise.muscles.some((entry) => entry.muscle_id === muscle && entry.weight > 0),
    ),
  ) ?? false;

const compareText = (first: string, second: string): number => {
  if (first === second) {
    return 0;
  }
  return first < second ? -1 : 1;
};

type WorkedSet = { set: MuscleDetailSet; at: number; localDate: string };

// Newest first, and a tie on the instant settles on the session and then the name, so the input order never shows.
const newestFirst = (first: WorkedSet, second: WorkedSet): number =>
  second.at - first.at ||
  compareText(second.set.session_id, first.set.session_id) ||
  compareText(second.set.snapshot.name, first.set.snapshot.name);

const byMostSetsThenName = (first: LastTrainedExercise, second: LastTrainedExercise): number =>
  second.sets - first.sets ||
  compareText(first.name, second.name) ||
  compareText(first.exerciseId, second.exerciseId);

/** The live sets of the heat window that worked the muscle at an effort above 0, on the user's calendar days. */
const workedSets = (
  muscle: MuscleId,
  sets: readonly MuscleDetailSet[],
  now: number,
  tz: string,
  params: CompareParams,
): WorkedSet[] => {
  const windowStart = now - params.training.heatWindowDays * MILLISECONDS_PER_DAY;
  const worked: WorkedSet[] = [];
  for (const set of sets) {
    if (set.deleted_at !== null) {
      continue;
    }
    const at = parseInstant(
      set.performed_at,
      "A set's performed_at must be an ISO timestamp with a zone",
    );
    const weight = set.snapshot.muscles.find((entry) => entry.muscle_id === muscle)?.weight ?? 0;
    if (at <= windowStart || at > now || weight <= 0 || setEffort(set, params.training) === 0) {
      continue;
    }
    worked.push({ set, at, localDate: toLocalDate(new Date(at), tz) });
  }
  return worked;
};

const lastTrainedOf = (
  worked: readonly WorkedSet[],
  sessions: readonly MuscleDetailSession[],
): LastTrained | null => {
  const newestDate = worked.reduce<string | null>(
    (newest, { localDate }) => (newest === null || localDate > newest ? localDate : newest),
    null,
  );
  const thatDay = worked.filter(({ localDate }) => localDate === newestDate).sort(newestFirst);
  const newest = thatDay[0];
  if (newest === undefined) {
    return null;
  }
  const exercises = new Map<string, LastTrainedExercise>();
  for (const { set } of thatDay) {
    const exercise = exercises.get(set.snapshot.ref);
    if (exercise === undefined) {
      exercises.set(set.snapshot.ref, {
        exerciseId: set.snapshot.ref,
        name: set.snapshot.name,
        sets: 1,
      });
    } else {
      exercise.sets += 1;
    }
  }
  return {
    localDate: newest.localDate,
    sessionId: newest.set.session_id,
    routineDayName:
      sessions.find((session) => session.id === newest.set.session_id)?.routine_day_name ?? null,
    exercises: [...exercises.values()].sort(byMostSetsThenName),
  };
};

/**
 * What the muscle sheet shows for one muscle.
 *
 * - Heat is the rounded percent of `state` and its step, and ready in is the whole hours from `now` to
 *   its ready time (see `readyInHoursOf`).
 * - Sets this week are the calendar week's figures of `comparison`, never the rolling weekly sets of the
 *   state (ADR 0005, Zee's ruling B on KEY-339), with the muscle's landmarks and where each figure sits
 *   against the productive range. The volume status is `volumeStatusOf` on the actual figure in the
 *   actual view and on the planned one in the projected view, so the view never changes the actual figure.
 * - Targeting says whether the muscle is targeted, and which of the routine and the goal asks for it, so
 *   a muscle that is not targeted can say why and offer Edit routine and Edit goal.
 * - Last trained is the newest calendar day of the heat window (in `tz`, the window the heat counts, the
 *   start not included) on which a live set worked the muscle at an effort above 0, so a warm-up never
 *   counts. It names that day, the session of its newest set, the routine day's name, and the exercises
 *   of the day with their set counts, the most first. It is null when nothing in the window did.
 *
 * The output does not depend on the order of `sets`. Throws a `RangeError` naming the rule when `tz` is
 * not an IANA name, when `now`, a ready time or a set's time is not an ISO timestamp with a zone, or when
 * a goal priority breaks the rule `targetedMuscles` states.
 */
export const muscleDetail = ({
  muscle,
  state,
  comparison,
  sets,
  sessions,
  targeted,
  view,
  now,
  tz,
  params,
}: MuscleDetailInput): MuscleDetail => {
  const nowMilliseconds = parseMoment(now);
  if (!isValidTimeZone(tz)) {
    throw new RangeError("A time zone must be an IANA zone name");
  }
  const isTargeted = targetedMuscles(targeted).has(muscle);
  const heatPercent = heatPercentOf(state[muscle].heat);
  const { actualWeeklySets: actual, projectedWeeklySets: planned } = comparison[muscle];
  const landmarks = muscleParams(muscle, params.training);
  const target: VolumeLandmarks = { mev: landmarks.mev, mav: landmarks.mav, mrv: landmarks.mrv };
  return {
    muscle,
    heatPercent,
    heatStep: heatStepOf(heatPercent),
    readyInHours: readyInHoursOf(state[muscle].readyAt, now),
    weeklySets: {
      actual,
      planned,
      target,
      actualPosition: positionOf(actual, target),
      plannedPosition: positionOf(planned, target),
      volumeStatus: volumeStatusOf(view === "projected" ? planned : actual, target, isTargeted),
    },
    targeting: {
      targeted: isTargeted,
      routineTrains: routineTrains(targeted.routine, muscle),
      goalRanks: (targeted.priority?.[muscle] ?? 0) > 0,
    },
    lastTrained: lastTrainedOf(workedSets(muscle, sets, nowMilliseconds, tz, params), sessions),
  };
};
