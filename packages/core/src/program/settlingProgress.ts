import { dayNumber } from "../dates/calendarDay";

import type { ProgramSnapshot } from "./types";

/** The program as settling reads it: the date the schedule holds. While settling that is the first check-in. */
export type SettlingProgram = Readonly<{ nextCheckinDate: string | null }>;

export type SettlingProgress = Readonly<{
  /** True while the start snapshot is the user's newest snapshot. */
  settling: boolean;
  /** The first check-in's date. Null when not settling, or when no schedule is set yet. */
  firstCheckinDate: string | null;
  /** Whole days from today to the first check-in, 0 on the day and after it. Null as `firstCheckinDate` is. */
  daysLeft: number | null;
}>;

const NOT_SETTLING: SettlingProgress = { settling: false, firstCheckinDate: null, daysLeft: null };

/** The newest snapshot by date. A check-in wins over a start snapshot of the same date, whatever the order. */
function newestOf<Snapshot extends Pick<ProgramSnapshot, "kind" | "asOfDate">>(
  snapshots: readonly Snapshot[],
): Snapshot | undefined {
  return snapshots.reduce<Snapshot | undefined>(
    (newest, snapshot) =>
      newest === undefined ||
      snapshot.asOfDate > newest.asOfDate ||
      (snapshot.asOfDate === newest.asOfDate && snapshot.kind === "checkin")
        ? snapshot
        : newest,
    undefined,
  );
}

/**
 * Whether the user is still settling, and how long until the first check-in (ADR 0002, Amendment 2,
 * "The start snapshot and the schedule", points 3 and 4). Settling lasts while the start snapshot is the
 * newest snapshot: any check-in snapshot, eligible or not, ends it. A program with no snapshot yet, between
 * the wizard's save and the first recompute, is settling too. `today` is the user's local date, `YYYY-MM-DD`.
 * The snapshots may come in any order.
 */
export function settlingProgress(
  program: SettlingProgram,
  snapshots: readonly Pick<ProgramSnapshot, "kind" | "asOfDate">[],
  today: string,
): SettlingProgress {
  if (newestOf(snapshots)?.kind === "checkin") {
    return NOT_SETTLING;
  }
  const firstCheckinDate = program.nextCheckinDate;
  if (firstCheckinDate === null) {
    return { settling: true, firstCheckinDate: null, daysLeft: null };
  }
  return {
    settling: true,
    firstCheckinDate,
    daysLeft: Math.max(0, dayNumber(firstCheckinDate) - dayNumber(today)),
  };
}
