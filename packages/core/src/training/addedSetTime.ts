import { parseMoment } from "./muscleState";

import type { WorkoutSessionRow, WorkoutSetRow } from "../schemas/training";

const MILLISECONDS_PER_SECOND = 1000;

/**
 * When a set added to a session is stamped as performed. A session that has ended is a day that has
 * passed, and a set added to it belongs to that day: the body map counts a set from its `performed_at`
 * (so a stamp of now would heat the muscles today), while the week strip and the history place the
 * session by its `local_date`. So the set goes one second after the session's latest live set, and no
 * later than the end of the session, or at the end of the session when it holds no live set. Sets added
 * one after another at the end of a full session share that moment, and `orderSessionSets` keeps them in
 * the order they were added by their `position`. A session that has not ended is still being logged to,
 * so the set is stamped `now`, which the caller gives since core never reads the clock.
 *
 * Throws a `RangeError` naming the rule when a live set's `performed_at` or the session's `ended_at` is
 * not an ISO timestamp with a zone.
 */
export const addedSetTime = (
  session: Pick<WorkoutSessionRow, "ended_at">,
  sets: readonly Pick<WorkoutSetRow, "performed_at" | "deleted_at">[],
  now: Date,
): Date => {
  if (session.ended_at === null) {
    return now;
  }
  const endedAt = parseMoment(
    session.ended_at,
    "A session's ended_at must be an ISO timestamp with a zone",
  );
  const setTimes = sets
    .filter((set) => set.deleted_at === null)
    .map((set) =>
      parseMoment(set.performed_at, "A set's performed_at must be an ISO timestamp with a zone"),
    );
  if (setTimes.length === 0) {
    return new Date(endedAt);
  }
  return new Date(Math.min(Math.max(...setTimes) + MILLISECONDS_PER_SECOND, endedAt));
};
