import type {
  CelebrationDecision,
  CelebrationEntry,
  CelebrationExtras,
  UnlockNotificationPayload,
} from "@keylow/core";

/** What the last runs of this device left for the screens to celebrate. */
export type CelebrationState = Readonly<{
  /** The badges waiting for a toast or a screen, the ones this device recorded first. */
  entries: readonly CelebrationEntry[];
  /**
   * The freezes and the level that came with the waiting entries, kept only while they wait. A run that
   * queued no entries leaves nothing here, so a level reached with no badge never attaches to a later drain.
   */
  extras: CelebrationExtras | null;
  /** The one notification for the badges this device recorded, which a later ticket sends or shows as a toast. */
  notification: UnlockNotificationPayload | null;
  /** Whether the app was in front when the run that left the entries finished. */
  wasActive: boolean;
  /** How many achievements the one summary card says were earned quietly, null when there is no card. */
  backfillSummary: number | null;
}>;

const emptyState: CelebrationState = {
  entries: [],
  extras: null,
  notification: null,
  wasActive: false,
  backfillSummary: null,
};

/*
 * One copy for the whole app, so a run at the root reaches a toast or a screen anywhere. It is not saved:
 * a badge still unseen when the app closes comes back from the database as a held row with no `seenAt`,
 * and the next run queues it again. The ids a screen acknowledged are remembered for the session, so a run
 * that read the stats before the screen marked them seen does not queue them a second time.
 */
let state = emptyState;
let acknowledged = new Set<string>();
const listeners = new Set<() => void>();

const mergeExtras = (
  waiting: CelebrationExtras | null,
  incoming: CelebrationExtras | null,
): CelebrationExtras | null =>
  waiting === null || incoming === null
    ? (incoming ?? waiting)
    : {
        freezes: waiting.freezes + incoming.freezes,
        levelName: incoming.levelName ?? waiting.levelName,
      };

const publish = (next: CelebrationState): void => {
  state = next;
  listeners.forEach((listener) => {
    listener();
  });
};

export const subscribeToCelebrations = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getCelebrationState = (): CelebrationState => state;

/** The ids a new run must not queue: those waiting now and those a screen has already dealt with. */
export const getQueuedIds = (): string[] => [...state.entries.map(({ id }) => id), ...acknowledged];

/** Adds what a run decided. A run that decided nothing new leaves the state exactly as it was. */
export const recordCelebrations = (decision: CelebrationDecision, wasActive: boolean): void => {
  const hasNothingNew =
    decision.entries.length === 0 &&
    decision.notification === null &&
    decision.backfillSummary === state.backfillSummary;
  if (hasNothingNew) {
    return;
  }
  publish({
    entries: [...state.entries, ...decision.entries],
    // Tied to the entries of the run: a run that queued none adds none.
    extras:
      decision.entries.length === 0 ? state.extras : mergeExtras(state.extras, decision.extras),
    notification: decision.notification ?? state.notification,
    wasActive,
    backfillSummary: decision.backfillSummary,
  });
};

/**
 * Takes the given badges out of the queue once a toast or a screen has shown them. Marking them seen in
 * the database is the caller's own write (`markAchievementsSeen`).
 */
export const acknowledgeCelebrations = (ids: readonly string[]): void => {
  const entries = state.entries.filter(({ id }) => !ids.includes(id));
  ids.forEach((id) => acknowledged.add(id));
  publish({
    ...state,
    entries,
    extras: entries.length === 0 ? null : state.extras,
    notification: entries.length === 0 ? null : state.notification,
  });
};

/** Forgets everything, for when the signed in user goes away. */
export const resetCelebrations = (): void => {
  acknowledged = new Set();
  publish(emptyState);
};
