import { ACHIEVEMENTS } from "./catalogue";
import { buildNotification } from "./notification";
import { unseenBackfilledIdsOf } from "./seen";

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
  run: Pick<RunResult, "newUnlocks" | "levelUp" | "freezeEventsToWrite">;
  /** The ids the database reported as new to it, which is all this device may call new. */
  recorded: readonly string[];
  /** The rows held before the run wrote. A row another device or the web recorded is among them. */
  held: readonly HeldRow[];
  isBackfill: boolean;
  /** The ids already waiting, or already celebrated this session, which are never queued twice. */
  alreadyQueued: readonly string[];
  /**
   * The ids this device already sent a notification for. They stay unseen in the database so the Achievements
   * screen marks them new, and this list is what keeps them from also being toasted after a restart.
   */
  notified: readonly string[];
}>;

/** What came with the badges a run recorded, as numbers: the freezes it earned and the level it reached. */
export type CelebrationExtras = Readonly<{ freezes: number; levelName: string | null }>;

export type CelebrationDecision = Readonly<{
  entries: CelebrationEntry[];
  /** For the badges this run recorded, null when it earned no freeze and reached no level. Never set on a backfill. */
  extras: CelebrationExtras | null;
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
  notified,
}: CelebrationInput): CelebrationDecision => {
  const quietCount = unseenBackfilledIdsOf(held).length;

  if (isBackfill) {
    const summary = quietCount + recorded.length;
    return {
      entries: [],
      extras: null,
      notification: null,
      backfillSummary: summary === 0 ? null : summary,
    };
  }

  const recordedIds = new Set(recorded);
  const newIds = run.newUnlocks.filter((id) => recordedIds.has(id));
  const waiting = new Set<string>([...alreadyQueued, ...notified]);
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

  const levelName = run.levelUp?.name ?? null;

  return {
    entries,
    extras: freezes === 0 && levelName === null ? null : { freezes, levelName },
    notification: buildNotification({
      newUnlocks: newIds,
      freezes,
      levelUp: run.levelUp,
    }),
    backfillSummary: quietCount === 0 ? null : quietCount,
  };
};
