import { ACHIEVEMENTS } from "./catalogue";
import { buildNotification } from "./notification";

import type { AchievementId } from "./catalogue";
import type { UnlockNotificationPayload } from "./notification";
import type { RunResult } from "./run";

const KNOWN_IDS: ReadonlySet<string> = new Set(ACHIEVEMENTS.map(({ id }) => id));

const isKnown = (id: string): id is AchievementId => KNOWN_IDS.has(id);

/** An achievement row the person holds, as the stats snapshot read it before this run wrote anything. */
export type HeldRow = Readonly<{ id: string; seenAt: string | null; backfilled: boolean }>;

/** A badge waiting to be celebrated. `isNew` is true when this device's run was the one that recorded it. */
export type CelebrationEntry = Readonly<{ id: AchievementId; isNew: boolean }>;

export type CelebrationInput = Readonly<{
  run: Pick<RunResult, "newUnlocks" | "points" | "levelUp" | "freezeEventsToWrite">;
  /** The ids the database reported as new to it, which is all this device may call new. */
  recorded: readonly string[];
  /** The rows held before the run wrote. A row another device or the web recorded is among them. */
  held: readonly HeldRow[];
  isBackfill: boolean;
  /** The ids already waiting, or already celebrated this session, which are never queued twice. */
  alreadyQueued: readonly string[];
}>;

export type CelebrationDecision = Readonly<{
  entries: CelebrationEntry[];
  /** For the badges this run recorded, and none on a backfill run. */
  notification: UnlockNotificationPayload | null;
  /** How many achievements the one summary card says were earned quietly, null when it has nothing to say. */
  backfillSummary: number | null;
}>;

/**
 * Which achievements one device celebrates after a run. The ones its own write recorded are new. Rows
 * another device or the web recorded and nobody has seen are held and queued too, but are not new, so
 * they get a toast and no notification. A backfilled row never celebrates: it only counts toward the
 * summary card, whether this run wrote it or the web did first. Pure.
 */
export const decideCelebrations = ({
  run,
  recorded,
  held,
  isBackfill,
  alreadyQueued,
}: CelebrationInput): CelebrationDecision => {
  const quietCount = held.filter(({ seenAt, backfilled }) => backfilled && seenAt === null).length;

  if (isBackfill) {
    const summary = quietCount + recorded.length;
    return {
      entries: [],
      notification: null,
      backfillSummary: summary === 0 ? null : summary,
    };
  }

  const recordedIds = new Set(recorded);
  const newIds = run.newUnlocks.filter((id) => recordedIds.has(id));
  const waiting = new Set<string>(alreadyQueued);
  const entries: CelebrationEntry[] = [];
  const queue = (id: string, isNew: boolean) => {
    if (isKnown(id) && !waiting.has(id)) {
      waiting.add(id);
      entries.push({ id, isNew });
    }
  };

  newIds.forEach((id) => {
    queue(id, true);
  });
  held
    .filter(({ seenAt, backfilled }) => seenAt === null && !backfilled)
    .forEach(({ id }) => {
      queue(id, false);
    });

  const freezes = run.freezeEventsToWrite
    .filter((row) => row.kind === "earned")
    .reduce((sum, row) => sum + row.count, 0);

  return {
    entries,
    notification: buildNotification({
      newUnlocks: newIds,
      points: run.points,
      freezes,
      levelUp: run.levelUp,
    }),
    backfillSummary: quietCount === 0 ? null : quietCount,
  };
};
